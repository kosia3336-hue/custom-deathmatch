import 'server-only';

import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import { findGuildIdForMember } from '@/lib/guild-v4/server';
import type { GuildScoutInvitePayload, GuildScoutTarget } from './scoutTypes';

export type { GuildScoutInvitePayload, GuildScoutTarget };
export { GUILD_SCOUT_COST_GP } from './scoutTypes';

type Sb = ReturnType<typeof getSupabaseServiceRole>;

function from(sb: Sb, table: string) {
  return (sb as unknown as { from: (t: string) => ReturnType<Sb['from']> }).from(table);
}

type GuildJoin = { id: string; name: string; disbanded_at: string | null };

function unwrapGuild(raw: GuildJoin | GuildJoin[] | null | undefined): GuildJoin | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function listScoutTargets(
  actorId: string,
): Promise<GuildScoutTarget[] | { error: 'forbidden' }> {
  const sb = getSupabaseServiceRole();
  const myGuildId = await findGuildIdForMember(actorId);
  if (!myGuildId) return { error: 'forbidden' };

  const { data: mine } = await sb
    .from('guild_members')
    .select('role')
    .eq('guild_id', myGuildId)
    .eq('member_id', actorId)
    .maybeSingle();
  const role = (mine as { role?: string } | null)?.role;
  if (role !== 'owner' && role !== 'vice_owner') return { error: 'forbidden' };

  const { data: members, error } = await sb
    .from('members')
    .select('id, nickname')
    .is('withdrawn_at', null)
    .neq('id', actorId)
    .limit(400);
  if (error) {
    console.warn('[guild2:scout] members', error.message);
    return [];
  }
  if (!members?.length) return [];

  const rows = members as { id: string; nickname: string }[];
  const ids = rows.map((m) => m.id);

  const { data: memberships, error: memErr } = await from(sb, 'guild_members')
    .select('member_id, guild_id, role, guilds!inner(id, name, disbanded_at)')
    .in('member_id', ids);
  if (memErr) {
    console.warn('[guild2:scout] memberships', memErr.message);
    return [];
  }

  const active = new Map<string, { guildId: string; guildName: string; role: string }>();
  for (const row of (memberships ?? []) as Array<{
    member_id: string;
    guild_id: string;
    role: string;
    guilds: GuildJoin | GuildJoin[] | null;
  }>) {
    const g = unwrapGuild(row.guilds);
    if (!g || g.disbanded_at) continue;
    active.set(row.member_id, { guildId: row.guild_id, guildName: g.name, role: row.role });
  }

  const { data: invites } = await from(sb, 'guild_scout_invites_v4')
    .select('to_member_id')
    .eq('guild_id', myGuildId)
    .in('to_member_id', ids);
  const invited = new Set(
    ((invites ?? []) as { to_member_id: string }[]).map((r) => r.to_member_id),
  );

  const out: GuildScoutTarget[] = [];
  for (const m of rows) {
    const mem = active.get(m.id);
    if (mem?.guildId === myGuildId) continue;
    if (mem?.role === 'owner') continue;
    out.push({
      memberId: m.id,
      nickname: m.nickname,
      hasGuild: Boolean(mem),
      guildName: mem?.guildName ?? null,
      alreadyInvited: invited.has(m.id),
    });
  }
  out.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
  return out;
}

export async function listPendingScoutInvites(memberId: string): Promise<GuildScoutInvitePayload[]> {
  const sb = getSupabaseServiceRole();
  const { data: rows, error } = await from(sb, 'guild_scout_invites_v4')
    .select('id, guild_id, from_member_id, target_had_guild, target_guild_name')
    .eq('to_member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error || !rows?.length) return [];

  const invites = rows as Array<{
    id: string;
    guild_id: string;
    from_member_id: string;
    target_had_guild: boolean;
    target_guild_name: string | null;
  }>;

  const guildIds = [...new Set(invites.map((r) => r.guild_id))];
  const fromIds = [...new Set(invites.map((r) => r.from_member_id))];

  const [{ data: guilds }, { data: members }] = await Promise.all([
    sb.from('guilds').select('id, name, disbanded_at').in('id', guildIds),
    sb.from('members').select('id, nickname').in('id', fromIds),
  ]);

  const guildMap = new Map<string, { name: string; disbanded: boolean }>();
  for (const g of (guilds ?? []) as { id: string; name: string; disbanded_at: string | null }[]) {
    guildMap.set(g.id, { name: g.name, disbanded: Boolean(g.disbanded_at) });
  }
  const nickMap = new Map<string, string>();
  for (const m of (members ?? []) as { id: string; nickname: string }[]) {
    nickMap.set(m.id, m.nickname);
  }

  const out: GuildScoutInvitePayload[] = [];
  for (const row of invites) {
    const g = guildMap.get(row.guild_id);
    if (!g || g.disbanded) continue;
    out.push({
      inviteId: row.id,
      guildId: row.guild_id,
      guildName: g.name,
      fromNickname: nickMap.get(row.from_member_id) ?? '길드',
      targetHadGuild: row.target_had_guild,
      targetGuildName: row.target_guild_name,
    });
  }
  return out;
}

function asInvite(raw: unknown): (GuildScoutInvitePayload & { toMemberId: string }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const inviteId = String(o.invite_id ?? '');
  const guildId = String(o.guild_id ?? '');
  const guildName = String(o.guild_name ?? '');
  const toMemberId = String(o.to_member_id ?? '');
  if (!inviteId || !guildId || !guildName || !toMemberId) return null;
  return {
    inviteId,
    guildId,
    guildName,
    fromNickname: String(o.from_nickname ?? '길드'),
    targetHadGuild: o.target_had_guild === true,
    targetGuildName: o.target_guild_name == null ? null : String(o.target_guild_name),
    toMemberId,
  };
}

export function parseScoutBatchResult(data: unknown): {
  invites: Array<GuildScoutInvitePayload & { toMemberId: string }>;
  newGp: number;
} | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const list = Array.isArray(o.invites) ? o.invites : [];
  const invites = list
    .map(asInvite)
    .filter((x): x is GuildScoutInvitePayload & { toMemberId: string } => Boolean(x));
  if (invites.length === 0) return null;
  return { invites, newGp: Number(o.new_gp ?? 0) };
}
