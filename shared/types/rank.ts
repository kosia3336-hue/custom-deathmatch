/**
 * 랭크게임 공통 타입·RP 산정 (기획 02·03·04).
 */

export type RankTier = 'unranked' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'challenger';

/** @deprecated challenger가 RankTier에 포함되어 동일한 타입. 호환성 유지용 alias. */
export type DisplayRankTier = RankTier;

/** 매칭·RP 티어 수치: 언랭(배치 중)=브론즈(1) 취급 */
export function rankTierNumericForRp(tier: RankTier, placementDone: boolean): number {
  if (tier === 'unranked' && !placementDone) return 1;
  switch (tier) {
    case 'unranked':
      return 0;
    case 'bronze':
      return 1;
    case 'silver':
      return 2;
    case 'gold':
      return 3;
    case 'diamond':
      return 4;
    case 'challenger':
      return 5;
    default:
      return 0;
  }
}

/**
 * 단판 RP 변동 (배치 완료 플레이어 간만).
 * @returns winnerGain / loserLoss 모두 양수 — 패배 차감은 caller 가 음수로 적용
 */

/** RP 테이블·스트릭 분해 (결과 화면 세부 내역용) */
export interface RankRpParts {
  winnerGain: number;
  loserLoss: number;
  winnerBaseTable: number;
  winnerStreakBonus: number;
  loserBaseTable: number;
  loserStreakPenalty: number;
}

export function calcRankRpParts(
  winnerTierVal: number,
  loserTierVal: number,
  winnerWinStreak: number,
  loserLossStreak: number,
): RankRpParts {
  const tierDiff = winnerTierVal - loserTierVal;
  const gainTable = [20, 17, 14, 12, 10, 8, 6];
  const idx = Math.max(0, Math.min(6, tierDiff + 3));
  const winnerBaseTable = gainTable[idx];
  const loserBaseTable = gainTable[idx];

  const winnerStreakBonus =
    winnerWinStreak >= 6 ? 20
    : winnerWinStreak === 5 ? 15
    : winnerWinStreak === 4 ? 10
    : winnerWinStreak === 3 ? 6
    : 0;

  const loserStreakPenalty =
    loserLossStreak >= 6 ? 20
    : loserLossStreak === 5 ? 15
    : loserLossStreak === 4 ? 10
    : loserLossStreak === 3 ? 6
    : 0;

  return {
    winnerGain: Math.max(3, winnerBaseTable + winnerStreakBonus),
    loserLoss: Math.max(5, loserBaseTable + loserStreakPenalty),
    winnerBaseTable,
    winnerStreakBonus,
    loserBaseTable,
    loserStreakPenalty,
  };
}

export function calcRankRpChange(
  winnerTierVal: number,
  loserTierVal: number,
  winnerWinStreak: number,
  loserLossStreak: number,
): { winnerGain: number; loserLoss: number } {
  const p = calcRankRpParts(winnerTierVal, loserTierVal, winnerWinStreak, loserLossStreak);
  return { winnerGain: p.winnerGain, loserLoss: p.loserLoss };
}

/** 배치전 5판 완료 후 최종 티어·RP (기획 04) */
export function placementTierAndRp(placementWins: number): {
  tier: Exclude<RankTier, 'unranked' | 'diamond' | 'challenger'>;
  rp: number;
} {
  const w = Math.max(0, Math.min(5, placementWins));
  if (w >= 5) return { tier: 'gold', rp: 50 };
  if (w === 4) return { tier: 'gold', rp: 0 };
  if (w === 3) return { tier: 'silver', rp: 50 };
  if (w === 2) return { tier: 'silver', rp: 0 };
  if (w === 1) return { tier: 'bronze', rp: 50 };
  return { tier: 'bronze', rp: 0 };
}

/**
 * 매칭용 누적 RP — 티어를 100 단위로 환산해 단일 수치로 비교
 * unranked(배치 중) = 브론즈 취급
 */
export function matchRp(tier: RankTier, rp: number, placementDone: boolean): number {
  if (tier === 'unranked' && !placementDone) return rp;
  const base: Record<RankTier, number> = {
    unranked: 0,
    bronze: 0,
    silver: 100,
    gold: 200,
    diamond: 300,
    // 챌린저 base = 300 + 150(진입 임계값) — 다이아 최고점(449)보다 항상 높음
    challenger: 450,
  };
  return base[tier] + rp;
}

export function tierOrder(t: RankTier): number {
  const o: Record<RankTier, number> = {
    unranked: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
    diamond: 4,
    challenger: 5,
  };
  return o[t];
}

export function peakTierMax(a: RankTier, b: RankTier): RankTier {
  return tierOrder(a) >= tierOrder(b) ? a : b;
}

/** 정식 랭크 구간 승리 후 RP·승급 (챌린저는 상한 없음) */
export function applyRankWin(
  currentTier: RankTier,
  currentRp: number,
  gain: number,
): { tier: RankTier; rp: number; promoted: boolean } {
  if (currentTier === 'unranked') {
    return { tier: 'unranked', rp: currentRp, promoted: false };
  }
  if (currentTier === 'challenger') {
    return { tier: 'challenger', rp: currentRp + gain, promoted: false };
  }
  if (currentTier === 'diamond') {
    const newRp = currentRp + gain;
    if (newRp >= 150) return { tier: 'challenger', rp: newRp, promoted: true };
    return { tier: 'diamond', rp: newRp, promoted: false };
  }

  const up: Record<'bronze' | 'silver' | 'gold', RankTier> = {
    bronze: 'silver',
    silver: 'gold',
    gold: 'diamond',
  };

  let tier: RankTier = currentTier;
  let rp = currentRp + gain;
  let promoted = false;

  while (tier === 'bronze' || tier === 'silver' || tier === 'gold') {
    if (rp < 100) break;
    rp -= 100;
    tier = up[tier];
    promoted = true;
    if (tier === 'diamond') break;
  }

  return { tier, rp, promoted };
}

/** 정식 랭크 구간 패배 후 RP·강등 (브론즈 0은 고정)
 *  챌린저는 RP 차감만 수행 — 강등 판정(150 미만 + 3위 밖)은 processRankedGameEnd 에서 처리 */
export function applyRankLoss(
  currentTier: RankTier,
  currentRp: number,
  loss: number,
): { tier: RankTier; rp: number; demoted: boolean } {
  if (currentTier === 'unranked') {
    return { tier: 'unranked', rp: currentRp, demoted: false };
  }
  if (currentTier === 'challenger') {
    return { tier: 'challenger', rp: Math.max(0, currentRp - loss), demoted: false };
  }
  const demoteMap: Partial<Record<RankTier, RankTier>> = {
    diamond: 'gold',
    gold: 'silver',
    silver: 'bronze',
  };

  const next = currentRp - loss;
  if (next >= 0) return { tier: currentTier, rp: next, demoted: false };

  // RP가 음수 → 즉시 강등, 잔여 RP 이월
  if (currentTier === 'bronze') {
    return { tier: 'bronze', rp: 0, demoted: false };
  }
  const prev = demoteMap[currentTier];
  if (!prev) return { tier: currentTier, rp: 0, demoted: false };
  return { tier: prev, rp: 100 + next, demoted: true };
}
