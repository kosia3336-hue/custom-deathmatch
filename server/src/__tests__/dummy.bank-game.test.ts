import { describe, it, expect } from 'vitest';
import {
  amountSoftCap,
  firstCandidates,
  maxCountForRound,
  oppRemainBounds,
  pickBankGameActionAsync,
  secondCandidates,
  type BankGameDummyView,
} from '../dummy/ai/bank-game.js';
import {
  initialInventory,
  sumBetAmount,
  sumBetCount,
  zeroBet,
} from '@shared/types/bank-game.js';

function view(over: Partial<BankGameDummyView> = {}): BankGameDummyView {
  const inv = over.my?.inventory ?? initialInventory();
  return {
    gameOver: false,
    phase: 'firstSubmit',
    round: 1,
    maxRound: 9,
    firstSide: 'p1',
    myId: 'dummy',
    oppId: 'human',
    mySide: 'p1',
    my: {
      score: 0,
      inventory: inv,
      inventoryCount: 38,
      inventoryAmount: 100_000,
      betConfirmed: false,
      ...over.my,
    },
    opp: {
      score: 0,
      inventoryCount: 38,
      betConfirmed: false,
      publicBetCount: null,
      ...over.opp,
    },
    firstPublicCount: null,
    history: [],
    loserAmountTotal: 0,
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
    my: {
      score: 0,
      inventory: inv,
      inventoryCount: over.my?.inventoryCount ?? 38,
      inventoryAmount: over.my?.inventoryAmount ?? 100_000,
      betConfirmed: false,
      ...over.my,
    },
    opp: {
      score: 0,
      inventoryCount: 38,
      betConfirmed: false,
      publicBetCount: null,
      ...over.opp,
    },
  };
}

describe('은행놀이 더미 기보 축', () => {
  it('공개 뷰 타입에 상대 권종·잔액·선 금액 필드가 없다', () => {
    const v = view();
    expect('inventory' in v.opp).toBe(false);
    expect('inventoryAmount' in v.opp).toBe(false);
    expect('pendingBet' in v.opp).toBe(false);
    expect(v.firstPublicCount).toBeNull();
  });

  it('초반 금액 상한은 기보 p90 (R1에 10만 없음)', () => {
    expect(amountSoftCap(100_000, 9, 0)).toBeLessThanOrEqual(24000);
    expect(amountSoftCap(100_000, 1, 0)).toBe(100_000);
    const cands = firstCandidates(view());
    expect(cands.every((c) => sumBetAmount(c.bet) <= 24000)).toBe(true);
    expect(cands.every((c) => sumBetCount(c.bet) >= 2 || sumBetCount(c.bet) === 0)).toBe(true);
  });

  it('선 후보는 잔여가 있으면 0장을 기본으로 두지 않는다', () => {
    const totals = firstCandidates(view()).map((c) => sumBetCount(c.bet));
    expect(totals.every((n) => n > 0)).toBe(true);
    expect(maxCountForRound(38, 9)).toBe(6);
  });

  it('선 후보에 1천장 블러프와 5천·3천 섞기가 있고, 그리디 1만만 있지 않다', () => {
    const cands = firstCandidates(view());
    const bluff4 = cands.some((c) => c.bet[1000] === 4 && sumBetCount(c.bet) === 4);
    const mix = cands.some((c) => c.bet[5000] >= 1 && c.bet[3000] >= 1 && c.bet[10000] === 0);
    const greedy3 = cands.some((c) => c.bet[10000] === 1 && c.bet[1000] === 2 && sumBetCount(c.bet) === 3);
    expect(bluff4).toBe(true);
    expect(mix).toBe(true);
    expect(greedy3).toBe(true);
  });

  it('후는 선 0장에 최소 1장으로 이기고, 폴드(0)도 후보에 둔다', () => {
    const v = view({
      phase: 'secondSubmit',
      mySide: 'p2',
      firstSide: 'p1',
      firstPublicCount: 0,
      my: {
        score: 0,
        inventory: initialInventory(),
        inventoryCount: 38,
        inventoryAmount: 100_000,
        betConfirmed: false,
      },
    });
    const cands = secondCandidates(v);
    const counts = cands.map((c) => sumBetCount(c.bet)).sort((a, b) => a - b);
    expect(counts).toContain(0);
    expect(counts).toContain(1);
    expect(cands.some((c) => sumBetAmount(c.bet) === 1000 && sumBetCount(c.bet) === 1)).toBe(true);
  });

  it('상대 잔액 구간은 시작 10만(장수 38)에서 점으로 닫힌다', () => {
    expect(oppRemainBounds(view())).toEqual({ min: 100_000, max: 100_000 });
  });

  it('승자 금액이 숨은 히스토리면 상대 잔액이 구간이 된다', () => {
    const v = view({
      opp: { score: 1, inventoryCount: 34, betConfirmed: false, publicBetCount: null },
      my: {
        score: 0,
        inventory: initialInventory(),
        inventoryCount: 34,
        inventoryAmount: 88_000,
        betConfirmed: false,
      },
      history: [{
        round: 1,
        firstSide: 'p2',
        outcome: 'first_win',
        winnerSide: 'p2',
        loserSide: 'p1',
        firstCount: 4,
        secondCount: 4,
        firstAmount: null,
        secondAmount: 12000,
        firstAuto: false,
        secondAuto: false,
        scoreAfter: { p1: 0, p2: 1 },
        scoreDelta: { p1: 0, p2: 1 },
        loserAmountThisRound: 12000,
        inventoryCountAfter: { p1: 34, p2: 34 },
      }],
    });
    const b = oppRemainBounds(v);
    expect(b.min).toBeLessThan(b.max);
    expect(b.max).toBeLessThanOrEqual(100_000);
  });
});

describe('은행놀이 더미 pick', () => {
  it.each(['하', '중', '상'] as const)('%s 선은 잔여·상한 안에서만 낸다', async (tier) => {
    const action = await pickBankGameActionAsync(view(), 'dummy', tier, 0);
    expect(action?.type).toBe('submitBet');
    if (action?.type === 'submitBet') {
      expect(sumBetAmount(action.bet)).toBeGreaterThan(0);
      expect(sumBetAmount(action.bet)).toBeLessThanOrEqual(24000);
      expect(sumBetCount(action.bet)).toBeGreaterThanOrEqual(2);
      expect(sumBetCount(action.bet)).toBeLessThanOrEqual(6);
    }
  });

  it.each(['하', '중', '상'] as const)('%s 후는 선 0장에 0 또는 최소 1장', async (tier) => {
    const v = view({
      phase: 'secondSubmit',
      mySide: 'p2',
      firstSide: 'p1',
      firstPublicCount: 0,
      my: {
        score: 0,
        inventory: initialInventory(),
        inventoryCount: 38,
        inventoryAmount: 100_000,
        betConfirmed: false,
      },
    });
    const action = await pickBankGameActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submitBet');
    if (action?.type === 'submitBet') {
      const n = sumBetCount(action.bet);
      expect(n === 0 || n === 1).toBe(true);
      expect(sumBetAmount(action.bet)).toBeLessThanOrEqual(10000);
    }
  });

  it('마지막 라운드 선수는 잔여 전부를 후보에 넣는다', () => {
    const inv = { 1000: 3, 3000: 1, 5000: 0, 10000: 0 };
    const v = view({
      round: 9,
      my: {
        score: 4,
        inventory: inv,
        inventoryCount: 4,
        inventoryAmount: 6000,
        betConfirmed: false,
      },
      opp: { score: 4, inventoryCount: 5, betConfirmed: false, publicBetCount: null },
    });
    const cands = firstCandidates(v);
    expect(cands.some((c) => sumBetAmount(c.bet) === 6000 && sumBetCount(c.bet) === 4)).toBe(true);
  });

  it('빈 손은 0장만', async () => {
    const v = view({
      my: {
        score: 4,
        inventory: zeroBet(),
        inventoryCount: 0,
        inventoryAmount: 0,
        betConfirmed: false,
      },
    });
    const action = await pickBankGameActionAsync(v, 'dummy', '중', 0);
    expect(action).toEqual({ type: 'submitBet', bet: zeroBet() });
  });
});
