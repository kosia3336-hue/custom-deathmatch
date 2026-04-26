import type {
  SMS2ChipBet,
  SMS2MarkId,
  SMS2PowderStage,
  SMS2ResolveStep,
  SMS2Side,
} from '@shared/types/sun-moon-star-2.js';
import { MARK_IDS, decideLitMark, sumBet } from '@shared/types/sun-moon-star-2.js';

export interface SMS2ResolveContext {
  firstSide: SMS2Side;
  firstBet: SMS2ChipBet;
  secondSide: SMS2Side;
  secondBet: SMS2ChipBet;
  /** 빛가루 반영 후 표식별 합산량 (p1 + p2) */
  totals: { sun: number; moon: number; star: number };
  /** 정산 전 각자의 칩 (베팅 전 시점 — 이 함수는 칩 차감도 계산한다) */
  chipsBefore: { p1: number; p2: number };
  /** 이 라운드 빛가루 제출 이전의 단계 (칸 감소 계산용) */
  stageBefore: { p1: SMS2PowderStage; p2: SMS2PowderStage };
  /** 반영 후 양측 표시등 단계 */
  stageAfter: { p1: SMS2PowderStage; p2: SMS2PowderStage };
}

export interface SMS2ResolveResult {
  steps: SMS2ResolveStep[];
  litMark: SMS2MarkId;
  tieBreak: boolean;
  /** 베팅으로 인한 칩 순증감 (초기 보유 대비) */
  chipDelta: { p1: number; p2: number };
  /** 최종 칩 잔량 */
  chipAfter: { p1: number; p2: number };
  /** 점등 표식에서 소멸된 총 빛가루량 */
  burnedTotal: number;
}

/**
 * 한 라운드의 정산을 계산한다.
 * - 점등 표식 결정
 * - 베팅 환급/몰수 계산
 * - 결과를 ResolveStep 시퀀스로 반환
 */
export function resolveRound(ctx: SMS2ResolveContext): SMS2ResolveResult {
  const steps: SMS2ResolveStep[] = [];
  const bets: Record<SMS2Side, SMS2ChipBet> = {
    p1: ctx.firstSide === 'p1' ? ctx.firstBet : ctx.secondBet,
    p2: ctx.firstSide === 'p2' ? ctx.firstBet : ctx.secondBet,
  };

  // 1. 베팅 공개
  steps.push({
    type: 'betReveal',
    firstSide: ctx.firstSide,
    firstBet: ctx.firstBet,
    secondSide: ctx.secondSide,
    secondBet: ctx.secondBet,
  });

  // 2. 점등 판정
  const { mark: litMark, tieBreak } = decideLitMark(ctx.totals);
  steps.push({
    type: 'litDecision',
    litMark,
    tieBreak,
    totals: { ...ctx.totals },
  });

  // 3. 베팅 정산 (점등 표식은 2배 환급, 비점등 표식은 몰수)
  const chipDelta: Record<SMS2Side, number> = { p1: 0, p2: 0 };
  const sides: SMS2Side[] = ['p1', 'p2'];
  const betTotals: Record<SMS2Side, number> = {
    p1: sumBet(bets.p1),
    p2: sumBet(bets.p2),
  };

  for (const side of sides) {
    for (const mark of MARK_IDS) {
      const staked = bets[side][mark];
      if (staked <= 0) continue;
      if (mark === litMark) {
        const returned = staked * 2;
        chipDelta[side] += returned - staked;
        steps.push({
          type: 'payout',
          side,
          mark,
          staked,
          returned,
        });
      } else {
        chipDelta[side] -= staked;
        steps.push({
          type: 'forfeit',
          side,
          mark,
          amount: staked,
        });
      }
    }
  }

  // 4. 빛가루 소멸
  const burnedTotal = ctx.totals[litMark];
  steps.push({
    type: 'powderBurn',
    mark: litMark,
    total: burnedTotal,
  });

  // 5. 라운드 요약
  const chipAfter: Record<SMS2Side, number> = {
    p1: ctx.chipsBefore.p1 + chipDelta.p1,
    p2: ctx.chipsBefore.p2 + chipDelta.p2,
  };
  steps.push({
    type: 'roundSummary',
    chipAfter,
    chipDelta,
    stageBefore: ctx.stageBefore,
    stageAfter: ctx.stageAfter,
  });

  // betTotals는 currently unused for steps but kept for clarity / future extension
  void betTotals;

  return {
    steps,
    litMark,
    tieBreak,
    chipDelta,
    chipAfter,
    burnedTotal,
  };
}
