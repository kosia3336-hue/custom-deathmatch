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
