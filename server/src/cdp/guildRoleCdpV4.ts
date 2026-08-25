import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import type { CdpGrantInput } from './calc.js';

export const GUILD_OWNER_CDP_PCT = 20;
export const GUILD_VICE_CDP_PCT = 5;

type GuildCdpRole = 'owner' | 'vice_owner';

export function guildRoleCdpBonus(amount: number, role: string | null): number {
  if (amount <= 0) return 0;
  const pct = role === 'owner' ? GUILD_OWNER_CDP_PCT : role === 'vice_owner' ? GUILD_VICE_CDP_PCT : 0;
  if (pct <= 0) return 0;
  return Math.round((amount * pct) / 100);
}

async function fetchGuildRoles(memberIds: string[]): Promise<Map<string, GuildCdpRole>> {
  const map = new Map<string, GuildCdpRole>();
  if (!isSupabaseConfigured() || memberIds.length === 0) return map;
  const sb = getSupabaseAdmin();
  try {
    const { data, error } = await sb
      .from('guild_members')
      .select('member_id, role')
      .in('member_id', memberIds);
    if (error) {
      console.warn('[cdp:guildRoleV4] 조회 실패(무시):', error.message);
      return map;
    }
    for (const row of (data ?? []) as Array<{ member_id: string; role: string }>) {
      if (row.role === 'owner' || row.role === 'vice_owner') {
        map.set(row.member_id, row.role);
      }
    }
  } catch (err) {
    console.warn('[cdp:guildRoleV4] 조회 예외(무시):', (err as Error).message);
  }
  return map;
}

export async function applyGuildRoleCdpV4(inputs: CdpGrantInput[]): Promise<CdpGrantInput[]> {
  const targets = inputs.filter((i) => i.amount > 0).map((i) => i.memberId);
  if (targets.length === 0) return inputs;

  const roles = await fetchGuildRoles(targets);
  if (roles.size === 0) return inputs;

  return inputs.map((inp) => {
    const role = roles.get(inp.memberId) ?? null;
    const base = inp.breakdown.base + inp.breakdown.tierBonus;
    const bonus = guildRoleCdpBonus(base, role);
    if (bonus <= 0) return inp;
    return {
      ...inp,
      amount: inp.amount + bonus,
      breakdown: { ...inp.breakdown, guildRole: role ?? undefined, guildRoleBonus: bonus },
    };
  });
}
