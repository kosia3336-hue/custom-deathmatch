import { describe, it, expect } from 'vitest';
import {
  firstBetCandidates,
  firstBetTotals,
  leftoverTotals,
  pickSunMoonStar2ActionAsync,
  powderCandidates,
  powderSoftCap,
  secondBetCandidates,
  type SunMoonStar2DummyView,
} from '../dummy/ai/sun-moon-star-2.js';
import { sumBet, sumPowder, zeroPowder } from '@shared/types/sun-moon-star-2.js';

function view(over: Partial<SunMoonStar2DummyView> = {}): SunMoonStar2DummyView {
  return {
    gameOver: false,
    phase: 'powder',
    round: 1,
    maxRound: 10,
    suddenDeath: false,
    firstPlayerSide: 'p1',
    myId: 'dummy',
    oppId: 'human',
    mySide: 'p1',
    my: {
      chips: 8,
      powderRemain: 100,
      powderStage: 5,
      markContribution: zeroPowder(),
      submittedPowder: false,
      betConfirmed: false,
      pendingPowder: null,
      pendingBet: null,
      ...over.my,
    },
    opp: {
      chips: 8,
      powderStage: 5,
      submittedPowder: false,
      betConfirmed: false,
      publicBet: null,
      ...over.opp,
    },
    leftover: zeroPowder(),
    oppStageStart: 5,
    history: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
    my: {
      chips: 8,
      powderRemain: 100,
      powderStage: 5,
      markContribution: zeroPowder(),
      submittedPowder: false,
      betConfirmed: false,
      pendingPowder: null,
      pendingBet: null,
      ...over.my,
    },
    opp: {
      chips: 8,
      powderStage: 5,
      submittedPowder: false,
      betConfirmed: false,
      publicBet: null,
      ...over.opp,
    },
  };
}

describe('해달별2 더미 기보 축', () => {
  it('직전 점등 후 합산을 보드로 쓴다', () => {
    expect(leftoverTotals([])).toEqual({ sun: 0, moon: 0, star: 0 });
  });

  it('초반 빛가루 상한은 기보 p90 (R1에 100 없음)', () => {
    expect(powderSoftCap(100, 10)).toBeLessThanOrEqual(28);
    const cands = powderCandidates(view());
    expect(cands.every((c) => sumPowder(c.powder) <= 28)).toBe(true);
    expect(cands.some((c) => sumPowder(c.powder) === 0)).toBe(true);
  });

  it('선 베팅 후보는 0 또는 상한뿐 (8칩 상대면 4)', () => {
    expect(firstBetTotals(8, 8)).toEqual([0, 4]);
    const totals = new Set(firstBetCandidates(view({ phase: 'betFirst' })).map((c) => sumBet(c.bet)));
    expect([...totals].sort((a, b) => a - b)).toEqual([0, 4]);
  });

  it('후 베팅은 선 합의 2배 이상', () => {
    const v = view({
      phase: 'betSecond',
      mySide: 'p2',
      firstPlayerSide: 'p1',
      opp: { chips: 8, powderStage: 5, submittedPowder: true, betConfirmed: true, publicBet: { sun: 4, moon: 0, star: 0 } },
    });
    expect(secondBetCandidates(v).every((c) => sumBet(c.bet) >= 8)).toBe(true);
  });
});

describe('해달별2 더미 pick', () => {
  it.each(['하', '중', '상'] as const)('%s는 빛가루를 잔여·상한 안에서만 낸다', async (tier) => {
    const action = await pickSunMoonStar2ActionAsync(view(), 'dummy', tier, 0);
    expect(action?.type).toBe('submitPowder');
    if (action?.type === 'submitPowder') {
      expect(sumPowder(action.powder)).toBeGreaterThanOrEqual(0);
      expect(sumPowder(action.powder)).toBeLessThanOrEqual(28);
    }
  });

  it.each(['하', '중', '상'] as const)('%s 선 베팅은 0 또는 4 (8v8)', async (tier) => {
    const v = view({
      phase: 'betFirst',
      my: {
        chips: 8,
        powderRemain: 80,
        powderStage: 4,
        markContribution: { sun: 20, moon: 0, star: 0 },
        submittedPowder: true,
        betConfirmed: false,
        pendingPowder: { sun: 20, moon: 0, star: 0 },
        pendingBet: null,
      },
    });
    const action = await pickSunMoonStar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submitBet');
    if (action?.type === 'submitBet') {
      const t = sumBet(action.bet);
      expect(t === 0 || t === 4).toBe(true);
      expect(t).not.toBe(3);
    }
  });

  it.each(['하', '중', '상'] as const)('%s 후는 선 4칩이면 최소 8', async (tier) => {
    const v = view({
      phase: 'betSecond',
      mySide: 'p2',
      firstPlayerSide: 'p1',
      my: {
        chips: 8,
        powderRemain: 80,
        powderStage: 4,
        markContribution: { sun: 0, moon: 20, star: 0 },
        submittedPowder: true,
        betConfirmed: false,
        pendingPowder: { sun: 0, moon: 20, star: 0 },
        pendingBet: null,
      },
      opp: {
        chips: 8,
        powderStage: 4,
        submittedPowder: true,
        betConfirmed: true,
        publicBet: { sun: 4, moon: 0, star: 0 },
      },
    });
    const action = await pickSunMoonStar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submitBet');
    if (action?.type === 'submitBet') {
      expect(sumBet(action.bet)).toBeGreaterThanOrEqual(8);
      expect(sumBet(action.bet)).toBeLessThanOrEqual(8);
    }
  });

  it('뷰에 상대 정확 빛가루 필드가 없다', () => {
    const v = view();
    expect('powderRemain' in v.opp).toBe(false);
    expect('pendingPowder' in v.opp).toBe(false);
  });
});
