import {
  CHOICE_HOLDEM_ANTE_INTERVAL,
  type ChoiceHoldemAction,
  type ChoiceHoldemBettingPhase,
  type ChoiceHoldemCard,
  type ChoiceHoldemEvaluation,
  type ChoiceHoldemRoundResult,
} from '@shared/types/choice-holdem.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { IO } from '../../types.js';
import { chooseChoiceHoldemAiAction } from './ai.js';
import {
  CHOICE_HOLDEM_AI_DELAY_MAX_MS,
  CHOICE_HOLDEM_AI_DELAY_MIN_MS,
  CHOICE_HOLDEM_FINISH_DISPLAY_MS,
  CHOICE_HOLDEM_ROUND_RESULT_MS,
} from './constants.js';
import { shuffleChoiceHoldemDeck } from './deck.js';
import { compareChoiceHoldemEvaluations, evaluateChoiceHoldemHand } from './judge.js';
import {
  broadcastChoiceHoldemState,
  choiceHoldemBettingBounds,
  choiceHoldemStates,
  clearChoiceHoldemTimers,
  toChoiceHoldemRecord,
} from './state.js';
import type { ChoiceHoldemState } from './types.js';

function otherPlayerId(state: ChoiceHoldemState, playerId: string) {
  return state.players.find((player) => player.id !== playerId)?.id ?? playerId;
}

function chipCounts(state: ChoiceHoldemState) {
  return Object.fromEntries(
    state.players.map((player) => [player.id, state.playerStates[player.id].chips]),
  );
}

function clearDecisionTimers(state: ChoiceHoldemState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.turnTimer = null;
  state.aiTimer = null;
}

function finishGame(io: IO, state: ChoiceHoldemState, winnerId: string | null, reason: string) {
  if (state.gameOver) return;
  clearChoiceHoldemTimers(state);
  state.gameOver = true;
  state.phase = 'finished';
  state.currentTurnId = null;
  state.turnStartedAt = null;
  state.winnerId = winnerId;
  state.finishReason = reason;
  void broadcastChoiceHoldemState(io, state);

  const rankings = state.players
    .map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      rank: winnerId == null ? 1 : player.id === winnerId ? 1 : 2,
      score: state.playerStates[player.id].chips,
    }))
    .sort((left, right) => left.rank - right.rank);
  const payload = {
    rankings,
    totalTurns: state.roundResults.length,
    gameResultData: toChoiceHoldemRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (choiceHoldemStates.get(state.roomId) !== state) return;
    choiceHoldemStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, CHOICE_HOLDEM_FINISH_DISPLAY_MS);
}

function finishForAnteLack(io: IO, state: ChoiceHoldemState, ante: number) {
  const [first, second] = state.players;
  const firstChips = state.playerStates[first.id].chips;
  const secondChips = state.playerStates[second.id].chips;
  const firstCanPay = firstChips >= ante;
  const secondCanPay = secondChips >= ante;
  let winnerId: string | null;
  if (firstCanPay !== secondCanPay) winnerId = firstCanPay ? first.id : second.id;
  else if (firstChips !== secondChips) winnerId = firstChips > secondChips ? first.id : second.id;
  else winnerId = null;
  const winner = state.players.find((player) => player.id === winnerId);
  finishGame(
    io,
    state,
    winnerId,
    winner
      ? `${ante}칩 기본 베팅을 낼 수 없는 상대를 상대로 ${winner.nickname} 님이 승리했습니다.`
      : `${ante}칩 기본 베팅을 두 플레이어 모두 낼 수 없어 무승부입니다.`,
  );
}

function scheduleDecision(io: IO, state: ChoiceHoldemState) {
  clearDecisionTimers(state);
  if (state.gameOver || state.currentTurnId == null) return;
  state.turnStartedAt = Date.now();
  const actorId = state.currentTurnId;
  if (state.turnSeconds != null) {
    state.turnTimer = setTimeout(() => {
      if (
        choiceHoldemStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.currentTurnId !== actorId
      ) {
        return;
      }
      const timeoutAction: ChoiceHoldemAction =
        state.phase === 'arranging-choice'
          ? { type: 'arrange-choice', faceUpIndex: 0 }
          : state.phase === 'choosing-card'
            ? { type: 'pick-choice', choice: 'face-up' }
            : { type: 'fold' };
      performChoiceHoldemAction(io, state, actorId, timeoutAction);
    }, state.turnSeconds * 1000);
  }
  if (state.playMode === 'com' && actorId === AI_PLAYER_ID) {
    const delay =
      CHOICE_HOLDEM_AI_DELAY_MIN_MS +
      Math.random() * (CHOICE_HOLDEM_AI_DELAY_MAX_MS - CHOICE_HOLDEM_AI_DELAY_MIN_MS);
    state.aiTimer = setTimeout(() => {
      if (
        choiceHoldemStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.currentTurnId !== AI_PLAYER_ID
      ) {
        return;
      }
      performChoiceHoldemAction(io, state, AI_PLAYER_ID, chooseChoiceHoldemAiAction(state));
    }, delay);
  }
}

function publishDecision(io: IO, state: ChoiceHoldemState) {
  scheduleDecision(io, state);
  void broadcastChoiceHoldemState(io, state);
}

export function beginChoiceHoldemRound(io: IO, state: ChoiceHoldemState) {
  if (state.gameOver) return;
  clearDecisionTimers(state);
  const ante = Math.floor((state.round - 1) / CHOICE_HOLDEM_ANTE_INTERVAL) + 1;
  state.ante = ante;
  if (
    !state.carryRound &&
    state.players.some((player) => state.playerStates[player.id].chips < ante)
  ) {
    finishForAnteLack(io, state, ante);
    return;
  }

  const deck = shuffleChoiceHoldemDeck();
  const take = () => deck.pop() as ChoiceHoldemCard;
  for (const player of state.players) {
    const playerState = state.playerStates[player.id];
    playerState.roundBet = 0;
    playerState.cards = [take()];
    if (!state.carryRound) {
      playerState.chips -= ante;
      playerState.roundBet = ante;
      state.pot += ante;
    }
  }
  state.communityCards = [take(), take(), take()];
  state.choiceCards = [take(), take()];
  state.faceUpIndex = null;
  state.faceUpOwnerId = null;
  state.faceDownOwnerId = null;
  state.actedSinceRaise = new Set();
  state.roundActions = [];
  state.lastRoundResult = null;
  state.roundStartedAt = Date.now();
  state.phase = state.carryRound ? 'arranging-choice' : 'first-betting';
  state.currentTurnId = state.firstPlayerId;
  publishDecision(io, state);
}

function roundEvaluations(state: ChoiceHoldemState) {
  return Object.fromEntries(
    state.players.map((player) => [
      player.id,
      evaluateChoiceHoldemHand(state.communityCards, state.playerStates[player.id].cards),
    ]),
  ) as Record<string, ChoiceHoldemEvaluation>;
}

function settleRound(io: IO, state: ChoiceHoldemState, result: ChoiceHoldemRoundResult) {
  clearDecisionTimers(state);
  state.lastRoundResult = result;
  state.roundResults.push(result);
  state.phase = 'round-result';
  state.currentTurnId = null;
  state.turnStartedAt = null;
  void broadcastChoiceHoldemState(io, state);
  state.transitionTimer = setTimeout(() => {
    if (choiceHoldemStates.get(state.roomId) !== state || state.gameOver) return;
    state.transitionTimer = null;
    state.round += 1;
    if (result.reason === 'tie') {
      state.carryRound = true;
    } else {
      state.carryRound = false;
      state.firstPlayerId = otherPlayerId(state, state.firstPlayerId);
    }
    beginChoiceHoldemRound(io, state);
  }, CHOICE_HOLDEM_ROUND_RESULT_MS);
}

export function resolveChoiceHoldemShowdown(io: IO, state: ChoiceHoldemState) {
  const evaluations = roundEvaluations(state);
  const [first, second] = state.players;
  const comparison = compareChoiceHoldemEvaluations(evaluations[first.id], evaluations[second.id]);
  const winnerId = comparison === 0 ? null : comparison > 0 ? first.id : second.id;
  const potAmount = state.pot;
  if (winnerId != null) {
    state.playerStates[winnerId].chips += state.pot;
    state.pot = 0;
  }
  settleRound(io, state, {
    round: state.round,
    winnerId,
    reason: winnerId == null ? 'tie' : 'showdown',
    foldedPlayerId: null,
    potAmount,
    ante: state.ante,
    carryRound: state.carryRound,
    communityCards: [...state.communityCards],
    holeCards: Object.fromEntries(
      state.players.map((player) => [player.id, [...state.playerStates[player.id].cards]]),
    ),
    evaluations,
    choiceFaceUp: state.faceUpIndex == null ? null : state.choiceCards[state.faceUpIndex],
    choiceFaceUpOwnerId: state.faceUpOwnerId,
    chipCountsAfter: chipCounts(state),
    actions: state.roundActions.map((action) => ({ ...action })),
  });
}

function settleFold(io: IO, state: ChoiceHoldemState, foldedPlayerId: string) {
  const winnerId = otherPlayerId(state, foldedPlayerId);
  const potAmount = state.pot;
  state.playerStates[winnerId].chips += state.pot;
  state.pot = 0;
  settleRound(io, state, {
    round: state.round,
    winnerId,
    reason: 'fold',
    foldedPlayerId,
    potAmount,
    ante: state.ante,
    carryRound: state.carryRound,
    communityCards: [...state.communityCards],
    holeCards: null,
    evaluations: null,
    choiceFaceUp: state.faceUpIndex == null ? null : state.choiceCards[state.faceUpIndex],
    choiceFaceUpOwnerId: state.faceUpOwnerId,
    chipCountsAfter: chipCounts(state),
    actions: state.roundActions.map((action) => ({ ...action })),
  });
}

function finishBettingPhase(io: IO, state: ChoiceHoldemState) {
  state.actedSinceRaise = new Set();
  if (state.phase === 'first-betting') {
    state.phase = 'arranging-choice';
    state.currentTurnId = state.firstPlayerId;
    publishDecision(io, state);
    return;
  }
  resolveChoiceHoldemShowdown(io, state);
}

function bettingPhaseLabel(state: ChoiceHoldemState): ChoiceHoldemBettingPhase {
  return state.phase === 'first-betting' ? 'first' : 'second';
}

function performBettingAction(
  io: IO,
  state: ChoiceHoldemState,
  playerId: string,
  action: Extract<ChoiceHoldemAction, { type: 'call' | 'raise' | 'fold' }>,
): string | null {
  const actor = state.playerStates[playerId];
  const opponent = state.playerStates[otherPlayerId(state, playerId)];
  const phase = bettingPhaseLabel(state);
  if (action.type === 'fold') {
    state.roundActions.push({
      round: state.round,
      phase,
      playerId,
      action: 'fold',
      amount: 0,
      totalBet: actor.roundBet,
    });
    settleFold(io, state, playerId);
    return null;
  }

  if (action.type === 'raise') {
    const bounds = choiceHoldemBettingBounds(state);
    if (
      !Number.isInteger(action.amount) ||
      bounds.minRaise == null ||
      bounds.maxRaise == null ||
      action.amount < bounds.minRaise ||
      action.amount > bounds.maxRaise
    ) {
      return '가능한 레이즈 범위를 확인해 주세요.';
    }
    const payment = action.amount - actor.roundBet;
    actor.chips -= payment;
    actor.roundBet = action.amount;
    state.pot += payment;
    state.actedSinceRaise = new Set([playerId]);
    state.roundActions.push({
      round: state.round,
      phase,
      playerId,
      action: 'raise',
      amount: payment,
      totalBet: actor.roundBet,
    });
    state.currentTurnId = otherPlayerId(state, playerId);
    publishDecision(io, state);
    return null;
  }

  const payment = Math.max(0, opponent.roundBet - actor.roundBet);
  if (payment > actor.chips) return '콜에 필요한 칩이 부족합니다.';
  actor.chips -= payment;
  actor.roundBet += payment;
  state.pot += payment;
  state.actedSinceRaise.add(playerId);
  state.roundActions.push({
    round: state.round,
    phase,
    playerId,
    action: 'call',
    amount: payment,
    totalBet: actor.roundBet,
  });
  const betsMatch = actor.roundBet === opponent.roundBet;
  if (betsMatch && state.actedSinceRaise.size === state.players.length) {
    finishBettingPhase(io, state);
  } else {
    state.currentTurnId = otherPlayerId(state, playerId);
    publishDecision(io, state);
  }
  return null;
}

function performArrangement(
  io: IO,
  state: ChoiceHoldemState,
  playerId: string,
  faceUpIndex: unknown,
): string | null {
  if (playerId !== state.firstPlayerId) return '선 플레이어만 카드를 배치할 수 있습니다.';
  if (faceUpIndex !== 0 && faceUpIndex !== 1) return '앞면으로 놓을 카드를 선택해 주세요.';
  state.faceUpIndex = faceUpIndex;
  state.phase = 'choosing-card';
  state.currentTurnId = otherPlayerId(state, state.firstPlayerId);
  publishDecision(io, state);
  return null;
}

function performPick(
  io: IO,
  state: ChoiceHoldemState,
  playerId: string,
  choice: unknown,
): string | null {
  if (state.faceUpIndex == null) return '아직 카드가 배치되지 않았습니다.';
  if (choice !== 'face-up' && choice !== 'face-down') return '가져갈 카드를 선택해 주세요.';
  const firstPlayerId = state.firstPlayerId;
  const selectorId = otherPlayerId(state, firstPlayerId);
  if (playerId !== selectorId) return '후 플레이어만 카드를 선택할 수 있습니다.';
  const faceDownIndex = state.faceUpIndex === 0 ? 1 : 0;
  const faceUpCard = state.choiceCards[state.faceUpIndex];
  const faceDownCard = state.choiceCards[faceDownIndex];
  if (choice === 'face-up') {
    state.playerStates[selectorId].cards.push(faceUpCard);
    state.playerStates[firstPlayerId].cards.push(faceDownCard);
    state.faceUpOwnerId = selectorId;
    state.faceDownOwnerId = firstPlayerId;
  } else {
    state.playerStates[selectorId].cards.push(faceDownCard);
    state.playerStates[firstPlayerId].cards.push(faceUpCard);
    state.faceUpOwnerId = firstPlayerId;
    state.faceDownOwnerId = selectorId;
  }
  if (state.carryRound) {
    resolveChoiceHoldemShowdown(io, state);
  } else {
    state.phase = 'second-betting';
    state.currentTurnId = state.firstPlayerId;
    state.actedSinceRaise = new Set();
    publishDecision(io, state);
  }
  return null;
}

export function performChoiceHoldemAction(
  io: IO,
  state: ChoiceHoldemState,
  playerId: string,
  action: ChoiceHoldemAction,
): string | null {
  if (state.gameOver || state.currentTurnId !== playerId) return '현재 행동 차례가 아닙니다.';
  const betting = state.phase === 'first-betting' || state.phase === 'second-betting';
  const actionIsBetting =
    action.type === 'call' || action.type === 'raise' || action.type === 'fold';
  if (betting !== actionIsBetting) return '현재 단계에서 할 수 없는 행동입니다.';
  if (state.phase === 'arranging-choice' && action.type !== 'arrange-choice') {
    return '앞면으로 놓을 카드를 선택해 주세요.';
  }
  if (state.phase === 'choosing-card' && action.type !== 'pick-choice') {
    return '가져갈 카드를 선택해 주세요.';
  }

  if (actionIsBetting) return performBettingAction(io, state, playerId, action);
  if (action.type === 'arrange-choice') {
    return performArrangement(io, state, playerId, action.faceUpIndex);
  }
  return performPick(io, state, playerId, action.choice);
}
