import type {
  DoubleSidedPokerAction,
  DoubleSidedPokerSelection,
} from '@shared/types/double-sided-poker.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { doubleSidedPokerBettingBounds, otherDoubleSidedPokerPlayerId } from './state.js';
import type { DoubleSidedPokerState } from './types.js';

const ODD_VALUES = [1, 3, 5, 7, 9];
const EVEN_VALUES = [2, 4, 6, 8, 10];

function possibleBackValues(front: number) {
  return front % 2 === 0 ? ODD_VALUES : EVEN_VALUES;
}

function valueForSelection(
  state: DoubleSidedPokerState,
  playerId: string,
  selection: Exclude<DoubleSidedPokerSelection, 'both' | null>,
) {
  const card = state.playerStates[playerId].card;
  if (!card) return 0;
  return selection === 'front' ? card.front : card.back;
}

function chanceSingleBeatsOpponent(
  ownValue: number,
  opponentFront: number,
  opponentSelection: DoubleSidedPokerSelection,
) {
  if (opponentSelection === 'front') return ownValue > opponentFront ? 1 : 0;
  if (opponentSelection === 'back') {
    const values = possibleBackValues(opponentFront);
    return values.filter((value) => ownValue > value).length / values.length;
  }
  return 0;
}

function chanceDoubleSucceeds(
  ownFront: number,
  ownBack: number,
  opponentFront: number,
  opponentSelection: DoubleSidedPokerSelection,
) {
  const lowerOwnValue = Math.min(ownFront, ownBack);
  return chanceSingleBeatsOpponent(lowerOwnValue, opponentFront, opponentSelection);
}

function bestSide(front: number, back: number): 'front' | 'back' {
  return front >= back ? 'front' : 'back';
}

function chooseRaiseAmount(minRaise: number, maxRaise: number, strength: number) {
  const extra = strength >= 0.9 ? 2 : 0;
  return Math.min(maxRaise, minRaise + extra);
}

export function chooseDoubleSidedPokerAiAction(
  state: DoubleSidedPokerState,
): DoubleSidedPokerAction {
  const actor = state.playerStates[AI_PLAYER_ID];
  const opponentId = otherDoubleSidedPokerPlayerId(state, AI_PLAYER_ID);
  const opponent = state.playerStates[opponentId];
  const bounds = doubleSidedPokerBettingBounds(state);
  if (!actor?.card || !opponent?.card) return { type: 'fold' };

  const side = bestSide(actor.card.front, actor.card.back);
  const ownValue = valueForSelection(state, AI_PLAYER_ID, side);

  // 걸 칩이 없는 이월 라운드 — 고를 것은 겨룰 면뿐이니 큰 쪽을 고른다.
  if (state.selectOnly) return { type: 'select', side };

  if (!state.bettingOpened) {
    const amount =
      bounds.maxBet == null
        ? 1
        : Math.min(bounds.maxBet, ownValue >= 9 ? 3 : ownValue >= 7 ? 2 : 1);
    return { type: 'bet', side, amount };
  }

  const opponentStrength = chanceSingleBeatsOpponent(
    ownValue,
    opponent.card.front,
    opponent.selection,
  );
  const pressure = bounds.toCall / Math.max(1, actor.chips + bounds.toCall);

  if (actor.selection == null) {
    const doubleChance = chanceDoubleSucceeds(
      actor.card.front,
      actor.card.back,
      opponent.card.front,
      opponent.selection,
    );
    if (bounds.canDouble && doubleChance >= 0.72) return { type: 'double' };
    if (bounds.toCall > 0 && opponentStrength < 0.3 && pressure > 0.12) {
      return { type: 'fold' };
    }
    if (
      opponentStrength >= 0.78 &&
      bounds.minRaise != null &&
      bounds.maxRaise != null &&
      Math.random() < 0.42
    ) {
      return {
        type: 'raise',
        side,
        amount: chooseRaiseAmount(bounds.minRaise, bounds.maxRaise, opponentStrength),
      };
    }
    return { type: 'call', side };
  }

  let strength = opponentStrength;
  if (actor.selection === 'both') {
    strength = chanceDoubleSucceeds(
      actor.card.front,
      actor.card.back,
      opponent.card.front,
      opponent.selection,
    );
  } else if (opponent.selection === 'both') {
    const possibleOpponentBacks = possibleBackValues(opponent.card.front);
    strength =
      possibleOpponentBacks.filter((back) => ownValue >= opponent.card!.front || ownValue >= back)
        .length / possibleOpponentBacks.length;
  }

  if (bounds.toCall > 0 && strength < 0.28 && pressure > 0.13) return { type: 'fold' };
  if (
    strength >= 0.82 &&
    bounds.minRaise != null &&
    bounds.maxRaise != null &&
    Math.random() < 0.38
  ) {
    return {
      type: 'raise',
      amount: chooseRaiseAmount(bounds.minRaise, bounds.maxRaise, strength),
    };
  }
  return { type: 'call' };
}
