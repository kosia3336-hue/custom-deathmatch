/**
 * 길드 버프(CDP 수완 증가) 적용.
 *  - 길드가 buff_cdp_level 을 1 올릴 때마다 매 게임 CDP 적립량 +1%
 *  - 길드 미가입/버프 0레벨이면 변동 없음
 *  - 보너스는 반올림한 정수로 더한다 (적립 CDP 는 정수)
 */
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import type { CdpGrantInput } from './calc.js';

export const GUILD_BUFF_MAX_LEVEL = 9;

/** 적립 base(=amount) 와 버프 레벨로 추가 보너스 계산 */
export function guildBuffBonus(amount: number, level: number): number {
  const lv = Math.max(0, Math.min(GUILD_BUFF_MAX_LEVEL, level));
  if (lv <= 0 || amount <= 0) return 0;
  return Math.round((amount * lv) / 100);
}

/** memberId → 길드 CDP 버프 레벨 */
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
      // 컬럼 미배포 등 — 버프 없이 진행
      console.warn('[cdp:guildBuff] 조회 실패(무시):', error.message);
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
    console.warn('[cdp:guildBuff] 조회 예외(무시):', (err as Error).message);
  }
  return map;
}

/**
 * CDP 적립 입력에 길드 버프 보너스를 반영한 새 배열을 돌려준다.
 * 실패 시 원본을 그대로 반환 (적립 자체를 막지 않는다).
 */
export async function applyGuildCdpBuff(inputs: CdpGrantInput[]): Promise<CdpGrantInput[]> {
  const targets = inputs.filter((i) => i.amount > 0).map((i) => i.memberId);
  if (targets.length === 0) return inputs;

  const levels = await fetchBuffLevels(targets);
  if (levels.size === 0) return inputs;

  return inputs.map((inp) => {
    const lv = levels.get(inp.memberId) ?? 0;
    const bonus = guildBuffBonus(inp.amount, lv);
    if (bonus <= 0) return inp;
    console.log(
      `[cdp:guildBuff] member=${inp.memberId} level=${lv} base=${inp.amount} bonus=+${bonus}`,
    );
    return {
      ...inp,
      amount: inp.amount + bonus,
      breakdown: { ...inp.breakdown, guildBuffLevel: lv, guildBuffBonus: bonus },
    };
  });
}
