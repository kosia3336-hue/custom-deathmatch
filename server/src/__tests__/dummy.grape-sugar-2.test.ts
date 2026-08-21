import { describe, it, expect } from 'vitest';
import {
  candidates,
  isFatalChicken,
  isWastedBreath,
  pickGrapeSugar2ActionAsync,
  sugarCandidates,
  sugarSoftCap,
  type GrapeSugar2DummyView,
} from '../dummy/ai/grape-sugar-2.js';
import type { GS2CardId } from '@shared/types/grape-sugar-2.js';
import { CARD_IDS } from '@shared/types/grape-sugar-2.js';

function view(over: Partial<GrapeSugar2DummyView> = {}): GrapeSugar2DummyView {
  const myHand = over.my?.hand ?? [...CARD_IDS];
  const oppHand = over.opp?.hand ?? [...CARD_IDS];
  return {
    gameOver: false,
    phase: 'input',
    round: 1,
    maxRound: 8,
    extension: 0,
    myId: 'dummy',
    oppId: 'human',
    mySide: 'p1',
    my: {
      score: 0,
      sugarRemain: 35,
      hand: myHand,
      submitted: false,
      hrPenaltyPending: 0,
      ...over.my,
    },
    opp: {
      score: 0,
      sugarRemain: 35,
      hand: oppHand,
      submitted: false,
      hrPenaltyPending: 0,
      ...over.opp,
    },
    breathAvailable: true,
    history: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
    my: {
      score: 0,
      sugarRemain: 35,
      hand: myHand,
      submitted: false,
      hrPenaltyPending: 0,
      ...over.my,
    },
    opp: {
      score: 0,
      sugarRemain: 35,
      hand: oppHand,
      submitted: false,
      hrPenaltyPending: 0,
      ...over.opp,
    },
  };
}

describe('포도설탕2 더미 기보 축', () => {
  it('공개 뷰에 pending 카드/설탕 필드가 없다', () => {
    const v = view();
    expect('pendingCard' in v.my).toBe(false);
    expect('pendingSugar' in v.my).toBe(false);
    expect('pendingCard' in v.opp).toBe(false);
  });

  it('상대 잔여가 무행동뿐이면 우주뿌셔는 치명', () => {
    const v = view({
      my: { score: 0, sugarRemain: 20, hand: ['spaceCrush', 'plus5'], submitted: false, hrPenaltyPending: 0 },
      opp: { score: 0, sugarRemain: 20, hand: ['noAction'], submitted: false, hrPenaltyPending: 0 },
    });
    expect(isFatalChicken(v, 'spaceCrush')).toBe(true);
    expect(isFatalChicken(v, 'plus5')).toBe(false);
    expect(candidates(v).every((c) => c.action.card !== 'spaceCrush')).toBe(true);
  });

  it('상대 잔여가 우주뿌셔뿐이면 무행동은 치명', () => {
    const v = view({
      my: { score: 0, sugarRemain: 20, hand: ['noAction', 'plus5'], submitted: false, hrPenaltyPending: 0 },
      opp: { score: 0, sugarRemain: 20, hand: ['spaceCrush'], submitted: false, hrPenaltyPending: 0 },
    });
    expect(isFatalChicken(v, 'noAction')).toBe(true);
    expect(candidates(v).every((c) => c.action.card !== 'noAction')).toBe(true);
  });

  it('리드인 마지막 예정 라운드에서 숨고르기는 버린다', () => {
    const v = view({
      round: 8,
      maxRound: 8,
      breathAvailable: true,
      my: { score: 3, sugarRemain: 10, hand: ['breath', 'plus5'], submitted: false, hrPenaltyPending: 0 },
      opp: { score: 1, sugarRemain: 10, hand: ['minus3'], submitted: false, hrPenaltyPending: 0 },
    });
    expect(isWastedBreath(v, 'breath')).toBe(true);
    expect(candidates(v).every((c) => c.action.card !== 'breath')).toBe(true);
  });

  it('마지막 라운드 복사는 남은 설탕을 후보에 넣는다', () => {
    const sugars = sugarCandidates('copy', 10, 1, true);
    expect(sugars).toContain(10);
    expect(sugars.every((s) => s >= 1)).toBe(true);
  });

  it('초반 설탕 상한은 기보 p95 (R1에 20 없음)', () => {
    expect(sugarSoftCap('grapeBless', 35, 8, false, 0)).toBeLessThanOrEqual(13);
    expect(sugarSoftCap('copy', 35, 8, false, 0)).toBeLessThanOrEqual(10);
    expect(sugarSoftCap('highRisk', 35, 8, false, 0)).toBeLessThanOrEqual(11);
    const v = view({ round: 1, maxRound: 8 });
    expect(candidates(v).every((c) => c.action.sugar <= 12)).toBe(true);
    expect(candidates(v).some((c) => c.action.sugar >= 20)).toBe(false);
  });
});

describe('포도설탕2 더미 pick', () => {
  it.each(['하', '중', '상'] as const)('%s는 손패·설탕 범위만 낸다', async (tier) => {
    const hand: GS2CardId[] = ['plus5', 'copy', 'grapeBless'];
    const v = view({
      my: { score: 0, sugarRemain: 8, hand, submitted: false, hrPenaltyPending: 0 },
    });
    const action = await pickGrapeSugar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submit');
    if (action?.type === 'submit') {
      expect(hand).toContain(action.card);
      expect(action.sugar).toBeGreaterThanOrEqual(0);
      expect(action.sugar).toBeLessThanOrEqual(8);
    }
  });

  it.each(['하', '중', '상'] as const)('%s는 상대 무행동뿐이면 우주뿌셔를 안 낸다', async (tier) => {
    const v = view({
      my: { score: 0, sugarRemain: 12, hand: ['spaceCrush', 'plus5'], submitted: false, hrPenaltyPending: 0 },
      opp: { score: 0, sugarRemain: 12, hand: ['noAction'], submitted: false, hrPenaltyPending: 0 },
    });
    const action = await pickGrapeSugar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submit');
    if (action?.type === 'submit') {
      expect(action.card).not.toBe('spaceCrush');
      expect(action.card).toBe('plus5');
    }
  });

  it.each(['하', '중', '상'] as const)('%s는 마지막 라운드 복사만 있으면 설탕을 충분히 쓴다', async (tier) => {
    const v = view({
      round: 8,
      maxRound: 8,
      breathAvailable: false,
      my: { score: 1, sugarRemain: 10, hand: ['copy'], submitted: false, hrPenaltyPending: 0 },
      opp: { score: 1, sugarRemain: 4, hand: ['plus5'], submitted: false, hrPenaltyPending: 0 },
    });
    const action = await pickGrapeSugar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submit');
    if (action?.type === 'submit') {
      expect(action.card).toBe('copy');
      expect(action.sugar).toBeGreaterThanOrEqual(tier === '상' ? 9 : 4);
      expect(action.sugar).toBeLessThanOrEqual(10);
    }
  });

  it.each(['하', '중', '상'] as const)('%s는 리드 마지막에 숨고르기로 연장하지 않는다', async (tier) => {
    const v = view({
      round: 8,
      maxRound: 8,
      breathAvailable: true,
      my: { score: 3, sugarRemain: 8, hand: ['breath', 'plus5'], submitted: false, hrPenaltyPending: 0 },
      opp: { score: 0, sugarRemain: 8, hand: ['minus3'], submitted: false, hrPenaltyPending: 0 },
    });
    const action = await pickGrapeSugar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submit');
    if (action?.type === 'submit') {
      expect(action.card).toBe('plus5');
    }
  });

  it.each(['하', '중', '상'] as const)('%s는 1라운드에 설탕 20을 안 쓴다', async (tier) => {
    const v = view({ round: 1, maxRound: 8 });
    const action = await pickGrapeSugar2ActionAsync(v, 'dummy', tier, 0);
    expect(action?.type).toBe('submit');
    if (action?.type === 'submit') {
      expect(action.sugar).toBeLessThanOrEqual(13);
    }
  });
});
