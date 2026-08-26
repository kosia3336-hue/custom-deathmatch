import { describe, it, expect } from 'vitest';
import { WS_INITIAL_CARDS, type WSCardType } from '@shared/types/winning-streak.js';
import { CARD_IDS, type GS2CardId } from '@shared/types/grape-sugar-2.js';
import {
  pickWinningStreakActionAsync,
  type WinningStreakDummyView,
} from '../dummy/ai/winning-streak.js';
import {
  pickGrapeSugar2ActionAsync,
  type GrapeSugar2DummyView,
} from '../dummy/ai/grape-sugar-2.js';

function wsView(): WinningStreakDummyView {
  return {
    gameOver: false,
    phase: 'cardSelect',
    round: 1,
    totalRounds: 10,
    myId: 'dummy',
    oppId: 'human',
    my: {
      currentStreak: 0,
      maxStreak: 0,
      totalWins: 0,
      remainingCards: { ...WS_INITIAL_CARDS },
      lastPlayedCard: null,
      submitted: false,
    },
    opp: {
      currentStreak: 0,
      maxStreak: 0,
      totalWins: 0,
      remainingCards: { ...WS_INITIAL_CARDS },
      lastPlayedCard: null,
      submitted: false,
    },
    roundHistory: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 90,
  };
}

function gsView(): GrapeSugar2DummyView {
  const hand = [...CARD_IDS] as GS2CardId[];
  return {
    gameOver: false,
    phase: 'input',
    round: 1,
    maxRound: 8,
    extension: 0,
    myId: 'dummy',
    oppId: 'human',
    mySide: 'p1',
    my: { score: 0, sugarRemain: 35, hand, submitted: false, hrPenaltyPending: 0 },
    opp: { score: 0, sugarRemain: 35, hand: [...hand], submitted: false, hrPenaltyPending: 0 },
    breathAvailable: true,
    history: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
  };
}

describe('연승 R1 오프닝 풀', () => {
  it('흑백 몰빵이 아니고 ♥/♠가 가장 많다', async () => {
    const counts: Record<WSCardType, number> = {
      spade: 0, diamond: 0, heart: 0, club: 0, blackJoker: 0, colorJoker: 0,
    };
    for (let i = 0; i < 80; i++) {
      const action = await pickWinningStreakActionAsync(wsView(), 'dummy', '상', 0);
      expect(action?.type).toBe('selectCard');
      if (action?.type === 'selectCard') counts[action.card] += 1;
    }
    expect(counts.blackJoker).toBeLessThanOrEqual(18);
    expect(counts.colorJoker).toBeLessThanOrEqual(8);
    expect(counts.heart + counts.spade).toBeGreaterThan(counts.blackJoker);
    expect(counts.heart + counts.spade).toBeGreaterThanOrEqual(28);
    const used = Object.values(counts).filter((n) => n > 0).length;
    expect(used).toBeGreaterThanOrEqual(3);
  });
});

describe('포도설탕2 R1 오프닝 풀', () => {
  it('주사위 몰빵이 아니고 무행동·가호·우주뿌셔가 많다', async () => {
    const counts: Partial<Record<GS2CardId, number>> = {};
    for (let i = 0; i < 48; i++) {
      const action = await pickGrapeSugar2ActionAsync(gsView(), 'dummy', '상', 0);
      expect(action?.type).toBe('submit');
      if (action?.type !== 'submit') continue;
      counts[action.card] = (counts[action.card] ?? 0) + 1;
      expect(action.sugar).toBeLessThanOrEqual(13);
    }
    expect(counts.dice ?? 0).toBeLessThanOrEqual(6);
    const strong = (counts.grapeBless ?? 0) + (counts.noAction ?? 0) + (counts.spaceCrush ?? 0);
    expect(strong).toBeGreaterThan(counts.dice ?? 0);
    expect(strong).toBeGreaterThanOrEqual(12);
  });
});
