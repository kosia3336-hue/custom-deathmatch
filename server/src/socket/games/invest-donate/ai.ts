import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { IDCoinAllocation, IDCoinStock } from '@shared/types/invest-donate.js';
import { AI_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, IDPlayerInternal } from './types.js';
import { gameStates, broadcastState, processRound } from './state.js';
import { stockTotal } from './judge.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

function noise(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

function getOpponent(s: InternalState, ai: IDPlayerInternal): IDPlayerInternal {
  return ai.id === s.player1.id ? s.player2 : s.player1;
}

interface UserPattern {
  avgInvest: number;
  avgDonate: number;
  aggressiveness: number;
}

function analyzeUserPattern(s: InternalState, userId: string): UserPattern {
  if (s.roundHistory.length === 0) {
    return { avgInvest: 20, avgDonate: 10, aggressiveness: 0.5 };
  }
  const records = s.roundHistory.map((r) => r.players[userId]);
  const invests = records.map((r) => r.investTotal);
  const donates = records.map((r) => r.donateTotal);
  const avgInvest = invests.reduce((a, b) => a + b, 0) / invests.length;
  const avgDonate = donates.reduce((a, b) => a + b, 0) / donates.length;
  const totalSpent = invests.map((inv, i) => inv + donates[i]);
  const ratios = invests.map((inv, i) => (totalSpent[i] > 0 ? inv / totalSpent[i] : 0.5));
  const aggressiveness = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { avgInvest, avgDonate, aggressiveness };
}

function allocateToCoinDenominations(
  targetInvest: number,
  targetDonate: number,
  stock: IDCoinStock,
): { invest: IDCoinAllocation; donate: IDCoinAllocation } {
  let rem50 = stock.coin50;
  let rem10 = stock.coin10;
  let rem1 = stock.coin1;

  const inv50 = Math.min(Math.floor(targetInvest / 50), rem50);
  rem50 -= inv50;
  let remaining = targetInvest - inv50 * 50;
  const inv10 = Math.min(Math.floor(remaining / 10), rem10);
  rem10 -= inv10;
  remaining -= inv10 * 10;
  const inv1 = Math.min(remaining, rem1);
  rem1 -= inv1;

  const don50 = Math.min(Math.floor(targetDonate / 50), rem50);
  remaining = targetDonate - don50 * 50;
  const don10 = Math.min(Math.floor(remaining / 10), rem10);
  remaining -= don10 * 10;
  const don1 = Math.min(remaining, rem1);

  return {
    invest: { coin50: inv50, coin10: inv10, coin1: inv1 },
    donate: { coin50: don50, coin10: don10, coin1: don1 },
  };
}

function decideAllocation(s: InternalState): {
  invest: IDCoinAllocation;
  donate: IDCoinAllocation;
} {
  const ai = s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
  const user = s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
  const aiTotal = stockTotal(ai.coinStock);
  const pattern = analyzeUserPattern(s, user.id);

  const roundsLeft = s.totalRounds - s.round + 1;
  const scoreDiff = ai.score - user.score;
  const aiScoreRisk = ai.score <= 1;
  const userScoreRisk = user.score <= 1;
  const isLateGame = roundsLeft <= 2;

  let targetInvest: number;
  let targetDonate: number;

  if (aiScoreRisk) {
    targetDonate = Math.min(Math.ceil(pattern.avgDonate * 1.3) + noise(5), aiTotal);
    targetInvest = Math.max(
      0,
      Math.min(Math.floor(pattern.avgInvest * 0.5), aiTotal - targetDonate),
    );
  } else if (userScoreRisk) {
    targetDonate = Math.min(Math.ceil(pattern.avgDonate * 1.5) + noise(10), aiTotal);
    targetInvest = Math.max(0, Math.min(noise(5), aiTotal - targetDonate));
  } else if (isLateGame) {
    if (scoreDiff > 0) {
      targetInvest = noise(3);
      targetDonate = noise(3);
    } else if (scoreDiff < 0) {
      targetInvest = Math.min(
        Math.ceil(pattern.avgInvest * 1.2) + noise(5),
        Math.floor(aiTotal * 0.5),
      );
      targetDonate = Math.min(Math.ceil(pattern.avgDonate * 1.1), aiTotal - targetInvest);
    } else {
      targetInvest = noise(5);
      targetDonate = noise(5);
    }
  } else {
    const budget = Math.floor(aiTotal * (0.1 + Math.random() * 0.2));
    if (pattern.aggressiveness > 0.6) {
      targetInvest = Math.floor(budget * 0.3) + noise(3);
      targetDonate = Math.max(0, budget - targetInvest + noise(3));
    } else if (pattern.aggressiveness < 0.4) {
      targetInvest = Math.floor(budget * 0.6) + noise(5);
      targetDonate = Math.max(0, budget - targetInvest);
    } else {
      targetInvest = Math.floor(budget * 0.5) + noise(5);
      targetDonate = Math.max(0, budget - targetInvest + noise(3));
    }
  }

  return allocateToCoinDenominations(targetInvest, targetDonate, ai.coinStock);
}

export async function aiSubmit(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'submit') return;
  const ai = s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
  if (ai.submitted) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (gameStates.get(s.roomId) !== s || s.gameOver) return;
  if (s.aiGeneration !== gen) return;
  if (s.phase !== 'submit' || ai.submitted || !getOpponent(s, ai).submitted) return;

  const { invest, donate } = decideAllocation(s);
  ai.investCoins = invest;
  ai.donateCoins = donate;
  ai.submitted = true;

  const other = ai.id === s.player1.id ? s.player2 : s.player1;
  if (other.submitted) {
    processRound(io, s);
  } else {
    broadcastState(io, s);
  }
}
