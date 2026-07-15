import 'server-only';
import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import type {
  GuildJoinRequestInfo,
  GuildMemberInfo,
  GuildSummary,
  MyGuildState,
} from './types';

interface GuildRow {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  capacity: number;
  points: number;
  created_at: string;
}

interface GuildMemberRow {
  guild_id: string;
  member_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

async function fetchNicknames(memberIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (memberIds.length === 0) return map;
  const sb = getSupabaseServiceRole();
  const { data } = await sb.from('members').select('id, nickname').in('id', memberIds);
  for (const r of (data ?? []) as { id: string; nickname: string }[]) map.set(r.id, r.nickname);
  return map;
}

/** 길드 목록 (버킷 분포 포함) */
export async function listGuilds(): Promise<GuildSummary[]> {
  const sb = getSupabaseServiceRole();
  const { data: guilds } = await sb
    .from('guilds')
    .select('*')
    .order('points', { ascending: false })
    .limit(100);
  const rows = (guilds ?? []) as GuildRow[];
  if (rows.length === 0) return [];

  const { data: membersData } = await sb
    .from('guild_members')
    .select('guild_id, member_id, role, joined_at')
    .in('guild_id', rows.map((g) => g.id));
  const memberRows = (membersData ?? []) as GuildMemberRow[];

  const nicknames = await fetchNicknames(rows.map((g) => g.owner_id));

  return rows.map((g) => {
    const members = memberRows.filter((m) => m.guild_id === g.id);
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      ownerNickname: nicknames.get(g.owner_id) ?? '',
      capacity: g.capacity,
      memberCount: members.length,
      points: Number(g.points),
      createdAt: g.created_at,
    };
  });
}

/** 내 길드 상태 (미가입이면 guild=null + 내 pending 신청/창설권 수) */
export async function getMyGuildState(memberId: string): Promise<MyGuildState> {
  const sb = getSupabaseServiceRole();

  const { data: charter } = await sb
    .from('shop_consumable_inventory')
    .select('count')
    .eq('member_id', memberId)
    .eq('kind', 'guild_charter')
    .maybeSingle();
  const charterCount = Number((charter as { count?: number } | null)?.count ?? 0);

  const { data: myRow } = await sb
    .from('guild_members')
    .select('guild_id, role')
    .eq('member_id', memberId)
    .maybeSingle();

  if (!myRow) {
    const { data: reqRow } = await sb
      .from('guild_join_requests')
      .select('id, guild_id, member_id, status, created_at, guilds(name)')
      .eq('member_id', memberId)
      .eq('status', 'pending')
      .maybeSingle();
    const req = reqRow as
      | { id: string; guild_id: string; member_id: string; status: string; created_at: string; guilds: { name: string } | null }
      | null;
    return {
      guild: null,
      role: null,
      members: [],
      pendingRequests: [],
      myRequest: req
        ? {
            id: req.id,
            guildId: req.guild_id,
            guildName: req.guilds?.name,
            memberId: req.member_id,
            status: 'pending',
            createdAt: req.created_at,
          }
        : null,
      charterCount,
    };
  }

  const my = myRow as { guild_id: string; role: 'owner' | 'member' };
  const [{ data: guildRow }, { data: membersData }] = await Promise.all([
    sb.from('guilds').select('*').eq('id', my.guild_id).single(),
    sb
      .from('guild_members')
      .select('guild_id, member_id, role, joined_at')
      .eq('guild_id', my.guild_id)
      .order('joined_at', { ascending: true }),
  ]);
  const g = guildRow as unknown as GuildRow;
  const memberRows = (membersData ?? []) as GuildMemberRow[];

  const memberIds = memberRows.map((m) => m.member_id);
  const nicknames = await fetchNicknames(memberIds);

  const members: GuildMemberInfo[] = memberRows.map((m) => ({
    memberId: m.member_id,
    nickname: nicknames.get(m.member_id) ?? '',
    role: m.role,
    joinedAt: m.joined_at,
  }));

  let pendingRequests: GuildJoinRequestInfo[] = [];
  if (my.role === 'owner') {
    const { data: reqs } = await sb
      .from('guild_join_requests')
      .select('id, guild_id, member_id, status, created_at')
      .eq('guild_id', my.guild_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    const reqRows = (reqs ?? []) as { id: string; guild_id: string; member_id: string; status: string; created_at: string }[];
    const reqNicknames = await fetchNicknames(reqRows.map((r) => r.member_id));
    pendingRequests = reqRows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      memberId: r.member_id,
      nickname: reqNicknames.get(r.member_id),
      status: 'pending',
      createdAt: r.created_at,
    }));
  }

  return {
    guild: {
      id: g.id,
      name: g.name,
      description: g.description,
      ownerNickname: nicknames.get(g.owner_id) ?? '',
      capacity: g.capacity,
      memberCount: members.length,
      points: Number(g.points),
      createdAt: g.created_at,
    },
    role: my.role,
    members,
    pendingRequests,
    myRequest: null,
    charterCount,
  };
}
