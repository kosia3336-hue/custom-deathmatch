import { describe, it, expect } from 'vitest';
import {
  allocateToCoinDenominations,
  buildCandidates,
  coinCount,
  humanPiles,
  isHumanPile,
  maxOnesPerPile,
  pickInvestDonateActionAsync,
  type InvestDonateDummyView,
} from '../dummy/ai/invest-donate.js';
import { ID_INITIAL_COIN_STOCK, ID_INITIAL_SCORE, ID_TOTAL_ROUNDS } from '@shared/types/invest-donate.js';

const INITIAL = { ...ID_INITIAL_COIN_STOCK };

function view(over: Partial<InvestDonateDummyView> = {}): InvestDonateDummyView {
  return {
    gameOver: false,
    phase: 'submit',
    round: 1,
    totalRounds: ID_TOTAL_ROUNDS,
    myId: 'dummy',
    oppId: 'human',
    my: {
      score: ID_INITIAL_SCORE,
      coinStock: { ...INITIAL },
      submitted: false,
      ...over.my,
    },
    opp: {
      score: ID_INITIAL_SCORE,
      coinStock: { ...INITIAL },
      submitted: false,
      ...over.opp,
    },
    roundHistory: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
    my: {
      score: ID_INITIAL_SCORE,
      coinStock: { ...INITIAL },
      submitted: false,
      ...over.my,
    },
    opp: {
      score: ID_INITIAL_SCORE,
      coinStock: { ...INITIAL },
      submitted: false,
      ...over.opp,
    },
  };
}

const CANONICAL = new Set([0, 1, 2, 10, 11, 12, 50, 51]);

describe('투자와 기부 더미 기보 축', () => {
  it('공개 뷰 타입에 이번 라운드 상대 배분 필드가 없다', () => {
    const v = view();
    expect('investCoins' in v.opp).toBe(false);
    expect('donateCoins' in v.opp).toBe(false);
    expect(v.roundHistory).toEqual([]);
  });

  it('초반 한 칸 1원은 최대 2장 (3원 몰아넣기 없음)', () => {
    expect(maxOnesPerPile(INITIAL, 7)).toBe(2);
    const piles = humanPiles(INITIAL, 7);
    expect(piles.every((p) => p.coin1 <= 2)).toBe(true);
    expect(piles.every((p) => p.coin50 <= 1)).toBe(true);
    expect(piles.every((p) => p.coin10 <= 1)).toBe(true);
    expect(piles.some((p) => p.coin1 === 3)).toBe(false);
  });

  it('마지막에 1원만 남으면 잔여 3장도 한 칸에 허용', () => {
    const leftover = { coin50: 0, coin10: 0, coin1: 3 };
    expect(maxOnesPerPile(leftover, 1)).toBe(3);
    expect(isHumanPile({ coin50: 0, coin10: 0, coin1: 3 }, leftover, 1)).toBe(true);
    expect(isHumanPile({ coin50: 0, coin10: 0, coin1: 3 }, leftover, 7)).toBe(false);
  });

  it('R1 후보에 3원·13원·한 칸 1원 3장이 없다', () => {
    const plans = buildCandidates(view(), '상');
    expect(plans.length).toBeGreaterThan(8);
    for (const p of plans) {
      expect(p.invest.coin1).toBeLessThanOrEqual(2);
      expect(p.donate.coin1).toBeLessThanOrEqual(2);
      expect(p.investTotal).not.toBe(3);
      expect(p.donateTotal).not.toBe(3);
      expect(p.investTotal).not.toBe(13);
      expect(p.donateTotal).not.toBe(13);
      expect(CANONICAL.has(p.investTotal)).toBe(true);
      expect(CANONICAL.has(p.donateTotal)).toBe(true);
    }
  });

  it('R1 후보는 라운드당 동전 4장 이하 (50 없는 12+12는 중반)', () => {
    const plans = buildCandidates(view(), '상');
    expect(plans.every((p) => coinCount(p.invest) + coinCount(p.donate) <= 4)).toBe(true);
  });

  it('13원·3원 목표는 12·2로 스냅한다', () => {
    const a = allocateToCoinDenominations(13, 3, INITIAL);
    expect(a.invest).toEqual({ coin50: 0, coin10: 1, coin1: 2 });
    expect(a.donate).toEqual({ coin50: 0, coin10: 0, coin1: 2 });
  });

  it('실제 선택도 R1에서 한 칸 3원을 내지 않는다', async () => {
    for (let i = 0; i < 20; i++) {
      const action = await pickInvestDonateActionAsync(view(), 'dummy', '상', 0);
      expect(action?.type).toBe('submit');
      if (action?.type !== 'submit') continue;
      expect(action.invest.coin1).toBeLessThanOrEqual(2);
      expect(action.donate.coin1).toBeLessThanOrEqual(2);
      expect(action.invest.coin50 * 50 + action.invest.coin10 * 10 + action.invest.coin1).not.toBe(3);
      expect(action.invest.coin50 * 50 + action.invest.coin10 * 10 + action.invest.coin1).not.toBe(13);
    }
  });
});
