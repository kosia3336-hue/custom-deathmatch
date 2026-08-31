import type { ChoiceHoldemAction, ChoiceHoldemCard } from '@shared/types/choice-holdem.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { choiceHoldemEvaluationScore, evaluateChoiceHoldemHand } from './judge.js';
import { choiceHoldemBettingBounds } from './state.js';
import type { ChoiceHoldemState } from './types.js';

function scoreWithCard(state: ChoiceHoldemState, playerId: string, card: ChoiceHoldemCard) {
  const privateCards = [...state.playerStates[playerId].cards, card].slice(0, 2);
  return choiceHoldemEvaluationScore(evaluateChoiceHoldemHand(state.communityCards, privateCards));
}

function bettingStrength(state: ChoiceHoldemState, playerId: string) {
  const cards = state.playerStates[playerId].cards;
  if (cards.length >= 2) {
    return choiceHoldemEvaluationScore(evaluateChoiceHoldemHand(state.communityCards, cards));
  }
  return ([1, 2, 3, 4, 5] as ChoiceHoldemCard[]).reduce(
    (sum, card) => sum + scoreWithCard(state, playerId, card) / 5,
    0,
  );
}

function chooseArrangement(state: ChoiceHoldemState): ChoiceHoldemAction {
  const [first, second] = state.choiceCards;
  const expectedOwnCard = (faceUp: ChoiceHoldemCard, faceDown: ChoiceHoldemCard) =>
    faceUp >= 3 ? faceDown : faceUp;
  const scoreFirstUp = scoreWithCard(state, AI_PLAYER_ID, expectedOwnCard(first, second));
  const scoreSecondUp = scoreWithCard(state, AI_PLAYER_ID, expectedOwnCard(second, first));
  return { type: 'arrange-choice', faceUpIndex: scoreFirstUp >= scoreSecondUp ? 0 : 1 };
}

function chooseCardWithoutPeeking(state: ChoiceHoldemState): ChoiceHoldemAction {
  const faceUp = state.faceUpIndex == null ? null : state.choiceCards[state.faceUpIndex];
  if (faceUp == null) return { type: 'pick-choice', choice: 'face-up' };
  const visibleScore = scoreWithCard(state, AI_PLAYER_ID, faceUp);
  const publicCards = [...state.communityCards, ...state.playerStates[AI_PLAYER_ID].cards, faceUp];
  const remaining = ([1, 2, 3, 4, 5] as ChoiceHoldemCard[]).flatMap((card) =>
    Array.from(
      { length: Math.max(0, 4 - publicCards.filter((visible) => visible === card).length) },
      () => card,
    ),
  );
  const hiddenExpected =
    remaining.reduce((sum, card) => sum + scoreWithCard(state, AI_PLAYER_ID, card), 0) /
    Math.max(1, remaining.length);
  return {
    type: 'pick-choice',
    choice: visibleScore >= hiddenExpected ? 'face-up' : 'face-down',
  };
}

function chooseBettingAction(state: ChoiceHoldemState): ChoiceHoldemAction {
  const bounds = choiceHoldemBettingBounds(state);
  const strength = bettingStrength(state, AI_PLAYER_ID);
  const chips = state.playerStates[AI_PLAYER_ID].chips;
  const pressure = bounds.toCall / Math.max(1, chips + bounds.toCall);
  if (bounds.toCall > 0 && pressure > 0.28 && strength < 1.25) return { type: 'fold' };

  const shouldRaise = strength >= 1.75 || (strength >= 0.45 && Math.random() < 0.08);
  if (shouldRaise && bounds.minRaise != null && bounds.maxRaise != null) {
    const step = Math.max(1, Math.min(3, Math.floor(strength)));
    return {
      type: 'raise',
      amount: Math.min(bounds.maxRaise, bounds.minRaise + step - 1),
    };
  }
  return { type: 'call' };
}

export function chooseChoiceHoldemAiAction(state: ChoiceHoldemState): ChoiceHoldemAction {
  if (state.phase === 'arranging-choice') return chooseArrangement(state);
  if (state.phase === 'choosing-card') return chooseCardWithoutPeeking(state);
  return chooseBettingAction(state);
}
