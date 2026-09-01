import type { SeedSeotdaAction } from '@shared/types/seed-seotda.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { evaluateSeedSeotdaHand, seedSeotdaEvaluationScore } from './judge.js';
import { seedSeotdaBettingBounds } from './state.js';
import type { SeedSeotdaState } from './types.js';

function chooseSeed(state: SeedSeotdaState): SeedSeotdaAction {
  const player = state.playerStates[AI_PLAYER_ID];
  if (!state.seedCard || player.cards.length !== 2) return { type: 'skip-seed' };
  const candidates: Array<{ action: SeedSeotdaAction; score: number }> = [
    {
      action: { type: 'skip-seed' },
      score: seedSeotdaEvaluationScore(evaluateSeedSeotdaHand(player.cards)),
    },
    {
      action: { type: 'use-seed', discardIndex: 0 },
      score: seedSeotdaEvaluationScore(evaluateSeedSeotdaHand([state.seedCard, player.cards[1]])),
    },
    {
      action: { type: 'use-seed', discardIndex: 1 },
      score: seedSeotdaEvaluationScore(evaluateSeedSeotdaHand([state.seedCard, player.cards[0]])),
    },
  ];
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.action ?? { type: 'skip-seed' };
}

function chooseBetting(state: SeedSeotdaState): SeedSeotdaAction {
  const player = state.playerStates[AI_PLAYER_ID];
  if (player.finalHand.length !== 2) return { type: 'die' };
  const strength = seedSeotdaEvaluationScore(evaluateSeedSeotdaHand(player.finalHand));
  const bounds = seedSeotdaBettingBounds(state);

  if (!state.bettingOpened) {
    if (bounds.maxBet == null) return { type: 'die' };
    const preferred = strength >= 360 ? 4 : strength >= 300 ? 3 : strength >= 240 ? 2 : 1;
    return { type: 'bet', amount: Math.min(bounds.maxBet, preferred) };
  }

  const pressure = bounds.toCall / Math.max(1, player.chips + player.roundBet);
  if (strength < 205 && (bounds.toCall >= 3 || pressure > 0.25)) return { type: 'die' };
  if (strength < 240 && bounds.toCall >= 6) return { type: 'die' };
  if (strength >= 300 && bounds.minRaise != null && bounds.maxRaise != null) {
    const target = Math.min(bounds.maxRaise, bounds.minRaise + (strength >= 380 ? 2 : 0));
    return { type: 'raise', amount: target };
  }
  return { type: 'call' };
}

export function chooseSeedSeotdaAiAction(state: SeedSeotdaState): SeedSeotdaAction {
  return state.phase === 'seed-choice' ? chooseSeed(state) : chooseBetting(state);
}
