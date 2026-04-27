import type {
  BankBet,
  BankResolveStep,
  BankSide,
} from '@shared/types/bank-game.js';
import { sumBetAmount, sumBetCount } from '@shared/types/bank-game.js';

export interface BankResolveContext {
  firstSide: BankSide;
  firstBet: BankBet;
  secondBet: BankBet;
  scoreBefore: { p1: number; p2: number };
  inventoryTotalAfter: { p1: number; p2: number };
}

export interface BankResolveResult {
  steps: BankResolveStep[];
  outcome: 'first_win' | 'second_win' | 'draw';
  winnerSide: BankSide | null;
  loserSide: BankSide | null;
  scoreDelta: { p1: number; p2: number };
  scoreAfter: { p1: number; p2: number };
  /** 패자 금액 (동률 시 null, 그 외엔 패자의 금액) */
  loserAmount: number | null;
}

export function resolveRound(ctx: BankResolveContext): BankResolveResult {
  const steps: BankResolveStep[] = [];
  const firstAmount = sumBetAmount(ctx.firstBet);
  const secondAmount = sumBetAmount(ctx.secondBet);
  const firstCount = sumBetCount(ctx.firstBet);
  const secondCount = sumBetCount(ctx.secondBet);
  const secondSide: BankSide = ctx.firstSide === 'p1' ? 'p2' : 'p1';

  let outcome: 'first_win' | 'second_win' | 'draw';
  let winnerSide: BankSide | null;
  let loserSide: BankSide | null;
  let loserAmount: number | null;

  if (firstAmount === secondAmount) {
    outcome = 'draw';
    winnerSide = null;
    loserSide = null;
    loserAmount = null;
    steps.push({
      type: 'flipBoth',
      firstAmount,
      secondAmount,
      firstCount,
      secondCount,
    });
  } else if (firstAmount > secondAmount) {
    outcome = 'first_win';
    winnerSide = ctx.firstSide;
    loserSide = secondSide;
    loserAmount = secondAmount;
    steps.push({
      type: 'flipLoser',
      side: secondSide,
      amount: secondAmount,
      count: secondCount,
    });
    steps.push({
      type: 'crownWinner',
      side: ctx.firstSide,
      count: firstCount,
      privateAmount: firstAmount,
    });
  } else {
    outcome = 'second_win';
    winnerSide = secondSide;
    loserSide = ctx.firstSide;
    loserAmount = firstAmount;
    steps.push({
      type: 'flipLoser',
      side: ctx.firstSide,
      amount: firstAmount,
      count: firstCount,
    });
    steps.push({
      type: 'crownWinner',
      side: secondSide,
      count: secondCount,
      privateAmount: secondAmount,
    });
  }

  const scoreDelta = { p1: 0, p2: 0 };
  if (winnerSide) scoreDelta[winnerSide] = 1;

  const scoreAfter = {
    p1: ctx.scoreBefore.p1 + scoreDelta.p1,
    p2: ctx.scoreBefore.p2 + scoreDelta.p2,
  };

  steps.push({
    type: 'roundSummary',
    scoreAfter,
    scoreDelta,
    inventoryTotalAfter: ctx.inventoryTotalAfter,
  });

  return {
    steps,
    outcome,
    winnerSide,
    loserSide,
    scoreDelta,
    scoreAfter,
    loserAmount,
  };
}
