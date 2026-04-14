import type { BRPSResult, BRPSBetOutcome } from '@shared/types/betting-rps.js';
import { BRPS_BET_MULTIPLIER } from '@shared/types/betting-rps.js';

/**
 * 베팅 결과를 판정한다.
 *
 * 반환(refund) 조건:
 *   승부 플레이어가 'draw'를 선택했고, 베팅 플레이어가 'win' 또는 'lose'에 베팅한 경우.
 *
 * 성공(success):
 *   예측 === 승부 결과
 *
 * 실패(fail):
 *   그 외 모든 경우
 */
export function judgeBet(
  matchResult: BRPSResult,
  prediction: BRPSResult,
): BRPSBetOutcome {
  if (matchResult === 'draw' && prediction !== 'draw') {
    return 'refund';
  }
  if (prediction === matchResult) {
    return 'success';
  }
  return 'fail';
}

/**
 * 칩 정산.
 * 성공: 승/패 예측 → 2배 (net +betChips), 무 예측 → 3배 (net +betChips*2)
 * 실패: Math.max(0, betPlayerChips - betChips)
 * 반환: betPlayerChips (변동 없음)
 *
 * multiplier: 2 = 일반 성공, 3 = 무 성공
 */
export function settleChips(
  currentChips: number,
  betChips: number,
  outcome: BRPSBetOutcome,
  multiplier: number = 2,
): number {
  switch (outcome) {
    case 'success':
      return currentChips + betChips * (multiplier - 1);
    case 'fail':
      return Math.max(0, currentChips - betChips);
    case 'refund':
      return currentChips;
  }
}
