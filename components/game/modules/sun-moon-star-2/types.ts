import type { SMS2MarkId, SMS2PowderStage } from '@/shared/types/sun-moon-star-2';

/* ════════════════════════════════════════════════════════════
 * 프론트 전용 타입
 * - OpponentPowderEstimate: 상대 빛가루 추리 (서버 미전송, 클라 로컬)
 * ════════════════════════════════════════════════════════════ */

export interface OpponentPowderEstimate {
  /** 표식별 상대 기여 추정치 */
  perMark: Record<SMS2MarkId, number>;
  /** 추정 계산 시 기준이 된 직전 단계 (라운드 시작 시점) */
  basedOnStagePrev: SMS2PowderStage;
  /** 추정 계산 시 기준이 된 현재 단계 (reflect 후) */
  basedOnStageNow: SMS2PowderStage;
}

export function zeroOpponentEstimate(
  stagePrev: SMS2PowderStage,
  stageNow: SMS2PowderStage,
): OpponentPowderEstimate {
  return {
    perMark: { sun: 0, moon: 0, star: 0 },
    basedOnStagePrev: stagePrev,
    basedOnStageNow: stageNow,
  };
}

/** 이번 라운드에 상대가 사용한 빛가루 추정 범위 계산 */
export function opponentUsedRange(
  stagePrev: SMS2PowderStage,
  stageNow: SMS2PowderStage,
): { min: number; max: number; median: number } {
  const prevMin = (stagePrev - 1) * 20 + (stagePrev === 1 ? 0 : 1);
  const prevMax = stagePrev * 20;
  const nowMin = (stageNow - 1) * 20 + (stageNow === 1 ? 0 : 1);
  const nowMax = stageNow * 20;
  const min = Math.max(0, prevMin - nowMax);
  const max = Math.max(0, prevMax - nowMin);
  const median = Math.round((min + max) / 2);
  return { min, max, median };
}
