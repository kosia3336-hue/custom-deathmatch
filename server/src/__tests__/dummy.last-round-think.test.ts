import { describe, it, expect } from 'vitest';
import { psychologyThinkKind } from '../dummy/thinkTime.js';
import { isNumberFourLastRound, type NumberFourDummyView } from '../dummy/ai/number4.js';
import { isMultipleBnwLastTile, type MultipleBnwDummyView } from '../dummy/ai/multiple-bnw.js';
import {
  isWinningStreakLastRound,
  pickWinningStreakActionAsync,
  type WinningStreakDummyView,
} from '../dummy/ai/winning-streak.js';
import { isBankGameLastRound, type BankGameDummyView } from '../dummy/ai/bank-game.js';
import { initialInventory } from '@shared/types/bank-game.js';

describe('psychologyThinkKind', () => {
  it('절망이 마지막 라운드보다 앞선다', () => {
    expect(psychologyThinkKind({ hopeless: true, lastRound: true })).toBe('hopeless');
  });

  it('마지막 라운드와 짧은 심리는 short', () => {
    expect(psychologyThinkKind({ lastRound: true })).toBe('short');
    expect(psychologyThinkKind({ short: true })).toBe('short');
  });

  it('기본은 full', () => {
    expect(psychologyThinkKind({})).toBe('full');
  });
});

describe('마지막 라운드 판정', () => {
  it('넘버4: 6R 또는 잔여 7장', () => {
    const base: NumberFourDummyView = {
      gameOver: false,
      phase: 'submit',
      round: 5,
      myId: 'dummy',
      oppId: 'human',
      my: { score: 5, remainingWhite: 8, remainingBlack: 6, submitted: false },
      opp: { score: 4, submitted: false },
      roundHistory: [],
      winner: null,
      turnStartedAt: Date.now(),
      timeLimitSeconds: 90,
    };
    expect(isNumberFourLastRound(base)).toBe(false);
    expect(isNumberFourLastRound({ ...base, round: 6 })).toBe(true);
    expect(isNumberFourLastRound({
      ...base,
      my: { ...base.my, remainingWhite: 4, remainingBlack: 3 },
    })).toBe(true);
  });

  it('배수 흑과 백: 잔여 1장 또는 9R', () => {
    const base: MultipleBnwDummyView = {
      gameOver: false,
      phase: 'tileSubmit',
      round: 8,
      totalRounds: 9,
      myId: 'dummy',
      oppId: 'human',
      firstPlayerId: 'dummy',
      my: { score: 2, remainingTiles: [3, 12], submitted: false, isFirst: true },
      opp: { score: 2, submitted: false, isFirst: false },
      colorReveal: null,
      myTile: null,
      roundHistory: [],
      winner: null,
      turnStartedAt: Date.now(),
      timeLimitSeconds: 90,
    };
    expect(isMultipleBnwLastTile(base)).toBe(false);
    expect(isMultipleBnwLastTile({
      ...base,
      my: { ...base.my, remainingTiles: [12] },
    })).toBe(true);
    expect(isMultipleBnwLastTile({ ...base, round: 9 })).toBe(true);
  });

  it('연승: 10R', () => {
    const empty = {
      spade: 0, diamond: 0, heart: 0, club: 0, blackJoker: 0, colorJoker: 0,
    };
    const v: WinningStreakDummyView = {
      gameOver: false,
      phase: 'cardSelect',
      round: 9,
      totalRounds: 10,
      myId: 'dummy',
      oppId: 'human',
      my: {
        currentStreak: 1,
        maxStreak: 3,
        totalWins: 4,
        remainingCards: { ...empty, spade: 1, heart: 1 },
        lastPlayedCard: null,
        submitted: false,
      },
      opp: {
        currentStreak: 0,
        maxStreak: 2,
        totalWins: 3,
        remainingCards: { ...empty, club: 2 },
        lastPlayedCard: null,
        submitted: false,
      },
      roundHistory: [],
      winner: null,
      turnStartedAt: Date.now(),
      timeLimitSeconds: 90,
    };
    expect(isWinningStreakLastRound(v)).toBe(false);
    expect(isWinningStreakLastRound({ ...v, round: 10 })).toBe(true);
  });

  it('은행놀이: maxRound', () => {
    const inv = initialInventory();
    const v = {
      gameOver: false,
      phase: 'firstSubmit' as const,
      round: 8,
      maxRound: 9,
      firstSide: 'p1' as const,
      myId: 'dummy',
      oppId: 'human',
      mySide: 'p1' as const,
      my: {
        score: 3,
        inventory: inv,
        inventoryCount: 10,
        inventoryAmount: 20000,
        betConfirmed: false,
      },
      opp: { score: 3, inventoryCount: 10, betConfirmed: false, publicBetCount: null },
      firstPublicCount: null,
      history: [],
      loserAmountTotal: 0,
      winner: null,
      turnStartedAt: Date.now(),
      timeLimitSeconds: 180,
    } satisfies BankGameDummyView;
    expect(isBankGameLastRound(v)).toBe(false);
    expect(isBankGameLastRound({ ...v, round: 9 })).toBe(true);
  });
});

describe('연승 마지막 1장', () => {
  it('후보 1장이면 그 카드를 낸다', async () => {
    const empty = {
      spade: 0, diamond: 0, heart: 0, club: 0, blackJoker: 0, colorJoker: 0,
    };
    const v: WinningStreakDummyView = {
      gameOver: false,
      phase: 'cardSelect',
      round: 10,
      totalRounds: 10,
      myId: 'dummy',
      oppId: 'human',
      my: {
        currentStreak: 1,
        maxStreak: 3,
        totalWins: 4,
        remainingCards: { ...empty, heart: 1 },
        lastPlayedCard: 'spade',
        submitted: false,
      },
      opp: {
        currentStreak: 0,
        maxStreak: 2,
        totalWins: 3,
        remainingCards: { ...empty, club: 1 },
        lastPlayedCard: null,
        submitted: false,
      },
      roundHistory: [],
      winner: null,
      turnStartedAt: Date.now(),
      timeLimitSeconds: 90,
    };
    const action = await pickWinningStreakActionAsync(v, 'dummy', '상', 0);
    expect(action).toEqual({ type: 'selectCard', card: 'heart' });
  });
});
