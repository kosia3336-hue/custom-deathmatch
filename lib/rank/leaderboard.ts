import type { RankTier } from '@/shared/types/rank';

export function rankTierSortScore(tier: RankTier): number {
  const m: Record<RankTier, number> = {
    unranked: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
    diamond: 4,
  };
  return m[tier] ?? 0;
}

/** 티어 우선, 동티어는 RP, 동RP는 시즌 승수 내림차순 */
export function compareRankRows(
  a: { tier: RankTier; rp: number; wins: number },
  b: { tier: RankTier; rp: number; wins: number },
): number {
  const td = rankTierSortScore(b.tier) - rankTierSortScore(a.tier);
  if (td !== 0) return td;
  const rd = b.rp - a.rp;
  if (rd !== 0) return rd;
  return b.wins - a.wins;
}

export const CHALLENGER_RP_MIN = 150;

/** 리더보드 순번 기준 챌린저 조건: 상위 3명 · 다이아 · RP 150 이상 */
export function isChallengerSlot(rank: number, tier: RankTier, rp: number): boolean {
  return rank <= 3 && tier === 'diamond' && rp >= CHALLENGER_RP_MIN;
}
