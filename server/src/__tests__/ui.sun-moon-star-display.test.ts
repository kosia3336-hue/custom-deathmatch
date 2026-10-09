import { describe, expect, it } from 'vitest';
import { powderDisplayForRound, resolveStepsForDisplay } from '../../../lib/sunMoonStarDisplay';
import type { SMS2GameData, SMS2RoundRecord } from '../../../shared/types/sun-moon-star-2';
import { resolveRound } from '../socket/games/sun-moon-star-2/resolve';

const draft = { sun: 3, moon: 2, star: 0 };
function data(): SMS2GameData {
  return {
    phase: 'powder',
    round: 2,
    maxRound: 10,
    suddenDeath: false,
    firstPlayerSide: 'p1',
    players: {
      p1: {
        id: 'me',
        nickname: '나',
        side: 'p1',
        chips: 8,
        powderStage: 4,
        submittedPowder: false,
        betConfirmed: false,
        publicBet: null,
      },
      p2: {
        id: 'other',
        nickname: '상대',
        side: 'p2',
        chips: 8,
        powderStage: 4,
        submittedPowder: false,
        betConfirmed: false,
        publicBet: null,
      },
    },
    selfPrivate: {
      side: 'p1',
      powderRemain: 75,
      pendingPowder: null,
      pendingBet: null,
      myMarkContribution: { sun: 10, moon: 5, star: 0 },
    },
    history: [],
    finalWinner: null,
    winType: null,
    isFinalRound: false,
  };
}

describe('해달별2 이번 라운드 빛가루 표시', () => {
  it('입력 중과 제출 후 상대 대기 중 모두 기존 누적에 이번 분배량이 표시된다', () => {
    const current = data();
    const before = powderDisplayForRound(current, draft);
    current.players.p1.submittedPowder = true;
    current.selfPrivate!.pendingPowder = draft;
    const waiting = powderDisplayForRound(current, { sun: 0, moon: 0, star: 0 });
    expect(waiting).toEqual(before);
    expect(current.selfPrivate!.myMarkContribution.sun + waiting.preview!.sun).toBe(13);
    expect(waiting.submitted!.sun).toBe(3);
  });
  it('양측 제출 후 서버 누적 반영값을 중복 합산하지 않는다', () => {
    const current = data();
    current.phase = 'betFirst';
    current.selfPrivate!.pendingPowder = draft;
    current.selfPrivate!.myMarkContribution = { sun: 13, moon: 7, star: 0 };
    const display = powderDisplayForRound(current, draft);
    expect(display.preview).toBeNull();
    expect(display.submitted).toEqual(draft);
    expect(current.selfPrivate!.myMarkContribution.sun + (display.preview?.sun ?? 0)).toBe(13);
  });
  it('취소 후 입력과 새 라운드는 이전 제출값을 표시하지 않는다', () => {
    const current = data();
    const nextDraft = { sun: 0, moon: 1, star: 0 };
    expect(powderDisplayForRound(current, nextDraft).submitted).toEqual(nextDraft);
    current.round = 3;
    expect(powderDisplayForRound(current, { sun: 0, moon: 0, star: 0 }).submitted).toEqual({
      sun: 0,
      moon: 0,
      star: 0,
    });
  });
  it('관전자에게는 본인 분배량을 만들지 않는다', () => {
    const current = data();
    current.selfPrivate = null;
    expect(powderDisplayForRound(current, draft)).toEqual({ preview: null, submitted: null });
  });
});

describe('해달별2 전체 정산 표시', () => {
  it.each(['p1', 'p2'] as const)(
    'resolve 스텝 없이 재접속해도 %s 선의 이번 결과를 그대로 복원한다',
    (firstSide) => {
      const firstBet = { sun: 1, moon: 2, star: 0 };
      const secondBet = { sun: 2, moon: 0, star: 1 };
      const result = resolveRound({
        firstSide,
        secondSide: firstSide === 'p1' ? 'p2' : 'p1',
        firstBet,
        secondBet,
        totals: { sun: 30, moon: 10, star: 5 },
        chipsBefore: { p1: 8, p2: 8 },
        stageBefore: { p1: 4, p2: 4 },
        stageAfter: { p1: 3, p2: 4 },
      });
      const record: SMS2RoundRecord = {
        round: 2,
        firstPlayerSide: firstSide,
        powderSubmission: { p1: draft, p2: { sun: 0, moon: 0, star: 0 } },
        markTotalsBefore: { sun: 30, moon: 10, star: 5 },
        markTotalsAfter: { sun: 0, moon: 10, star: 5 },
        bets:
          firstSide === 'p1' ? { p1: firstBet, p2: secondBet } : { p1: secondBet, p2: firstBet },
        firstBetTotal: 3,
        secondBetTotal: 3,
        litMark: result.litMark,
        tieBreak: result.tieBreak,
        chipDelta: result.chipDelta,
        chipAfter: result.chipAfter,
        stageBefore: { p1: 4, p2: 4 },
        stageAfter: { p1: 3, p2: 4 },
        auto: { p1: false, p2: false },
      };
      const current = {
        ...data(),
        phase: 'roundEnd' as const,
        roundResult: record,
        history: [record],
      };
      // 양쪽 빛가루 합산(판정 합계·소멸량)은 비공개라 복원 스텝에도 넣지 않는다
      const publicSteps = result.steps.map((step) => {
        if (step.type === 'litDecision') {
          const { totals: _totals, ...rest } = step;
          return rest;
        }
        if (step.type === 'powderBurn') {
          const { total: _total, ...rest } = step;
          return rest;
        }
        return step;
      });
      expect(resolveStepsForDisplay(current)).toEqual(publicSteps);
      current.roundResult = { ...record, round: 1 };
      expect(resolveStepsForDisplay(current)).toEqual(publicSteps);
      current.history = [{ ...record, round: 1 }];
      expect(resolveStepsForDisplay(current)).toBeNull();
    },
  );
  it('서버 스텝을 그대로 사용하고 다음 라운드 입력에는 지난 결과를 표시하지 않는다', () => {
    const current = data();
    const steps = [{ type: 'powderBurn' as const, mark: 'sun' as const, total: 30 }];
    expect(resolveStepsForDisplay({ ...current, phase: 'resolve', resolveSteps: steps })).toBe(
      steps,
    );
    expect(resolveStepsForDisplay({ ...current, resolveSteps: steps })).toBeNull();
  });
});
