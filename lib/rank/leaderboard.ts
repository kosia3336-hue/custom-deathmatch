import type { RankTier } from '@/shared/types/rank';

export function rankTierSortScore(tier: RankTier): number {
  const m: Record<RankTier, number> = {
    unranked: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
    diamond: 4,
    challenger: 5,
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

/** DB에 챌린저 티어로 저장된 플레이어 판별 */
export function isChallengerSlot(_rank: number, tier: RankTier, _rp: number): boolean {
  return tier === 'challenger';
}
