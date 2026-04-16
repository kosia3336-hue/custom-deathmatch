import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { WSCardType, WSMatchResult } from '@shared/types/winning-streak.js';
import { CARD_TYPES } from '@shared/types/winning-streak.js';
import { AI_CARD_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, WSPlayerInternal } from './types.js';
import {
  gameStates, broadcastState, trySubmitCard, getAvailableCards,
  resetTimeout,
} from './state.js';
import { getMatchupResult } from './judge.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

function getAI(s: InternalState): WSPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}

function getUser(s: InternalState): WSPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

/* ────────── expected win rate ────────── */

function getOpponentAvailableCards(opponent: WSPlayerInternal): { card: WSCardType; count: number }[] {
  const result: { card: WSCardType; count: number }[] = [];
  for (const ct of CARD_TYPES) {
    if (opponent.remainingCards[ct] <= 0) continue;
    if (ct === opponent.lastPlayedCard) continue;
    result.push({ card: ct, count: opponent.remainingCards[ct] });
  }
  if (result.length === 0 && opponent.lastPlayedCard && opponent.remainingCards[opponent.lastPlayedCard] > 0) {
    result.push({ card: opponent.lastPlayedCard, count: opponent.remainingCards[opponent.lastPlayedCard] });
  }
  return result;
}

function isWinResult(r: WSMatchResult): boolean {
  return r === 'win' || r === 'draw_win';
}

function calculateExpectedWinRate(card: WSCardType, opponent: WSPlayerInternal): number {
  const opCards = getOpponentAvailableCards(opponent);
  if (opCards.length === 0) return 0.5;

  let totalCount = 0;
  let winCount = 0;

  for (const { card: opCard, count } of opCards) {
    totalCount += count;
    const result = getMatchupResult(card, opCard);
    if (isWinResult(result)) winCount += count;
  }

  return totalCount > 0 ? winCount / totalCount : 0.5;
}

/* ────────── card selection ────────── */

function selectAICard(s: InternalState): WSCardType {
  const ai = getAI(s);
  const opponent = getUser(s);
  const candidates = getAvailableCards(ai);

  if (candidates.length === 1) return candidates[0];

  const weights = candidates.map((card) => {
    let weight = calculateExpectedWinRate(card, opponent);

    if (card === 'colorJoker') {
      if (ai.currentStreak >= 3) weight *= 2.5;
      else if (ai.currentStreak >= 2) weight *= 1.5;
      else if (ai.currentStreak === 0) weight *= 0.6;

      if (opponent.remainingCards.colorJoker === 0) weight *= 1.3;

      if (s.round >= 9) weight *= 1.8;
    }

    if (card === 'blackJoker') {
      weight = 0.05;

      if (s.round >= 8) weight = 0.15;

      if (opponent.currentStreak >= 3) weight = 0.20;
    }

    if (opponent.currentStreak >= 3) {
      const result = getMatchupResult(card, 'diamond');
      const result2 = getMatchupResult(card, 'club');
      if (isWinResult(result) || isWinResult(result2)) {
        weight *= 1.3;
      }
    }

    return Math.max(weight, 0.01);
  });

  return weightedRandom(candidates, weights);
}

function weightedRandom(items: WSCardType[], weights: number[]): WSCardType {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/* ────────── phase handler ────────── */

export async function handleAiTurn(io: IO, s: InternalState) {
  if (s.phase !== 'cardSelect') return;

  const ai = getAI(s);
  if (ai.submitted) return;

  const gen = s.aiGeneration;
  await wait(randDelay(AI_CARD_DELAY));

  if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'cardSelect') return;
  if (ai.submitted) return;

  const card = selectAICard(s);
  resetTimeout(s, ai.id);
  trySubmitCard(io, s, ai.id, card);
}
