/**
 * 길드 버프 v4 — 레벨당 랭크전 CDP +2%.
 * 기존 guildBuff.ts(+1%)는 그대로 둔다.
 */
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import type { CdpGrantInput } from './calc.js';

export const GUILD_BUFF_MAX_LEVEL = 9;

/** 적립 base(=amount) 와 버프 레벨로 추가 보너스. 레벨당 +2%. */
export function guildBuffBonusV4(amount: number, level: number): number {
  const lv = Math.max(0, Math.min(GUILD_BUFF_MAX_LEVEL, level));
  if (lv <= 0 || amount <= 0) return 0;
  return Math.round((amount * lv * 2) / 100);
}

async function fetchBuffLevels(memberIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!isSupabaseConfigured() || memberIds.length === 0) return map;
  const sb = getSupabaseAdmin();
  try {
    const { data, error } = await sb
      .from('guild_members')
      .select('member_id, guilds!inner(buff_cdp_level)')
      .in('member_id', memberIds);
    if (error) {
      console.warn('[cdp:guildBuffV4] 조회 실패(무시):', error.message);
      return map;
    }
    for (const row of (data ?? []) as Array<{
      member_id: string;
      guilds: { buff_cdp_level: number } | { buff_cdp_level: number }[] | null;
    }>) {
      const g = Array.isArray(row.guilds) ? row.guilds[0] : row.guilds;
      const lv = Number(g?.buff_cdp_level ?? 0);
      if (lv > 0) map.set(row.member_id, lv);
    }
  } catch (err) {
    console.warn('[cdp:guildBuffV4] 조회 예외(무시):', (err as Error).message);
  }
  return map;
}

export async function applyGuildCdpBuffV4(inputs: CdpGrantInput[]): Promise<CdpGrantInput[]> {
  const targets = inputs.filter((i) => i.amount > 0).map((i) => i.memberId);
  if (targets.length === 0) return inputs;

  const levels = await fetchBuffLevels(targets);
  if (levels.size === 0) return inputs;

  return inputs.map((inp) => {
    const lv = levels.get(inp.memberId) ?? 0;
    const bonus = guildBuffBonusV4(inp.amount, lv);
    if (bonus <= 0) return inp;
    console.log(
      `[cdp:guildBuffV4] member=${inp.memberId} level=${lv} base=${inp.amount} bonus=+${bonus}`,
    );
    return {
      ...inp,
      amount: inp.amount + bonus,
      breakdown: { ...inp.breakdown, guildBuffLevel: lv, guildBuffBonus: bonus },
    };
  });
}
