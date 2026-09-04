import {
  DOUBLE_SIDED_POKER_ANTE,
  DOUBLE_SIDED_POKER_DOUBLE_BONUS,
  type DoubleSidedPokerAction,
  type DoubleSidedPokerBettingAction,
  type DoubleSidedPokerRoundResult,
  type DoubleSidedPokerSide,
} from '@shared/types/double-sided-poker.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { IO } from '../../types.js';
import { chooseDoubleSidedPokerAiAction } from './ai.js';
import {
  DOUBLE_SIDED_POKER_AI_DELAY_MAX_MS,
  DOUBLE_SIDED_POKER_AI_DELAY_MIN_MS,
  DOUBLE_SIDED_POKER_FINISH_DISPLAY_MS,
  DOUBLE_SIDED_POKER_ROUND_RESULT_MS,
} from './constants.js';
import { shuffleDoubleSidedPokerDeck } from './deck.js';
import {
  broadcastDoubleSidedPokerState,
  clearDoubleSidedPokerTimers,
  doubleSidedPokerBettingBounds,
  doubleSidedPokerStates,
  otherDoubleSidedPokerPlayerId,
  toDoubleSidedPokerRecord,
} from './state.js';
import type { DoubleSidedPokerInternalPlayer, DoubleSidedPokerState } from './types.js';

function chipCounts(state: DoubleSidedPokerState) {
  return Object.fromEntries(
    state.players.map((player) => [player.id, state.playerStates[player.id].chips]),
  );
}

function clearDecisionTimers(state: DoubleSidedPokerState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.turnTimer = null;
  state.aiTimer = null;
}

function finishGame(io: IO, state: DoubleSidedPokerState, winnerId: string | null, reason: string) {
  if (state.gameOver) return;
  clearDoubleSidedPokerTimers(state);
  state.gameOver = true;
  state.phase = 'finished';
  state.currentTurnId = null;
  state.turnStartedAt = null;
  state.winnerId = winnerId;
  state.finishReason = reason;
  void broadcastDoubleSidedPokerState(io, state);

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
    gameResultData: toDoubleSidedPokerRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (doubleSidedPokerStates.get(state.roomId) !== state) return;
    doubleSidedPokerStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, DOUBLE_SIDED_POKER_FINISH_DISPLAY_MS);
}

function finishForEmptyStack(io: IO, state: DoubleSidedPokerState) {
  const [first, second] = state.players;
  const firstChips = state.playerStates[first.id].chips;
  const secondChips = state.playerStates[second.id].chips;
  const winnerId =
    firstChips === secondChips ? null : firstChips > secondChips ? first.id : second.id;
  const winner = state.players.find((player) => player.id === winnerId);
  finishGame(
    io,
    state,
    winnerId,
    winner
      ? `${winner.nickname} 님이 상대의 모든 칩을 획득해 승리했습니다.`
      : '두 플레이어의 칩이 동시에 소진되어 무승부입니다.',
  );
}

function scheduleDecision(io: IO, state: DoubleSidedPokerState) {
  clearDecisionTimers(state);
  if (state.gameOver || state.currentTurnId == null || state.phase !== 'betting') return;
  state.turnStartedAt = Date.now();
  const actorId = state.currentTurnId;
  if (state.turnSeconds != null) {
    state.turnTimer = setTimeout(() => {
      if (
        doubleSidedPokerStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.currentTurnId !== actorId
      ) {
        return;
      }
      performDoubleSidedPokerAction(io, state, actorId, { type: 'fold' });
    }, state.turnSeconds * 1000);
  }
  if (state.playMode === 'com' && actorId === AI_PLAYER_ID) {
    const delay =
      DOUBLE_SIDED_POKER_AI_DELAY_MIN_MS +
      Math.random() * (DOUBLE_SIDED_POKER_AI_DELAY_MAX_MS - DOUBLE_SIDED_POKER_AI_DELAY_MIN_MS);
    state.aiTimer = setTimeout(() => {
      if (
        doubleSidedPokerStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.currentTurnId !== AI_PLAYER_ID
      ) {
        return;
      }
      performDoubleSidedPokerAction(io, state, AI_PLAYER_ID, chooseDoubleSidedPokerAiAction(state));
    }, delay);
  }
}

function publishDecision(io: IO, state: DoubleSidedPokerState) {
  scheduleDecision(io, state);
  void broadcastDoubleSidedPokerState(io, state);
}

export function beginDoubleSidedPokerRound(io: IO, state: DoubleSidedPokerState) {
  if (state.gameOver) return;
  clearDecisionTimers(state);
  /*
    팟이 이월된 라운드에서는 기본 베팅을 내지 않는다. 앞 라운드에 이미 건 칩이
    그대로 걸려 있고, 올인한 쪽은 더 낼 칩이 없기 때문이다. 그래서 이월
    라운드에서는 칩이 없다는 이유로 탈락시키지도 않는다.
  */
  const carried = state.carryRound;
  if (
    !carried &&
    state.players.some((player) => state.playerStates[player.id].chips < DOUBLE_SIDED_POKER_ANTE)
  ) {
    finishForEmptyStack(io, state);
    return;
  }
  if (state.deck.length < 2) {
    state.deck = shuffleDoubleSidedPokerDeck();
    state.deckCycles += 1;
  }
  for (const player of state.players) {
    const playerState = state.playerStates[player.id];
    const card = state.deck.pop();
    if (!card) throw new Error('양면포커 덱이 비어 있습니다.');
    playerState.card = card;
    playerState.selection = null;
    playerState.stake = 0;
    playerState.frontBet = 0;
    playerState.backBet = 0;
    if (!carried) {
      playerState.chips -= DOUBLE_SIDED_POKER_ANTE;
      state.pot += DOUBLE_SIDED_POKER_ANTE;
    }
  }
  state.ante = carried ? 0 : DOUBLE_SIDED_POKER_ANTE;
  state.bettingOpened = false;
  state.doubleBettorId = null;
  state.roundActions = [];
  state.lastRoundResult = null;
  state.phase = 'betting';
  state.currentTurnId = state.firstPlayerId;
  state.roundStartedAt = Date.now();

  /*
    기본 베팅을 내고 칩이 0 이 되어도 여기서 끝내지 않는다. 이미 낸 1칩이 팟에
    걸려 있으므로 그 라운드를 치러 되찾을 기회를 줘야 한다. 베팅할 칩이 없으면
    바로 아래에서 앞면끼리 겨뤄 팟 주인을 가린다. 정말 못 버티는 경우는 다음
    라운드 시작 때 기본 베팅을 못 내는 것으로 걸린다.
  */
  /*
    아무도 베팅할 칩이 없으면(이월 라운드에서 한쪽이 올인이었던 경우) 고를 면이
    없다. 공개된 앞면끼리 비교해 이월된 팟의 주인을 가린다.
  */
  if (doubleSidedPokerBettingBounds(state).maxBet == null) {
    resolveDoubleSidedPokerShowdown(io, state);
    return;
  }
  publishDecision(io, state);
}

function selectedValue(player: DoubleSidedPokerInternalPlayer) {
  if (!player.card || player.selection === 'both') return null;
  // 베팅할 칩이 없어 면을 고르지 못했다면 공개된 앞면으로 겨룬다.
  if (player.selection == null) return player.card.front;
  return player.selection === 'front' ? player.card.front : player.card.back;
}

function revealBack(player: DoubleSidedPokerInternalPlayer, showdown: boolean) {
  if (!showdown || !player.card) return null;
  return player.selection === 'back' || player.selection === 'both' ? player.card.back : null;
}

function applyPayment(
  state: DoubleSidedPokerState,
  player: DoubleSidedPokerInternalPlayer,
  targetStake: number,
) {
  const delta = targetStake - player.stake;
  const multiplier = player.selection === 'both' ? 2 : 1;
  const payment = delta * multiplier;
  player.chips -= payment;
  state.pot += payment;
  player.stake = targetStake;
  if (player.selection === 'front') player.frontBet += delta;
  if (player.selection === 'back') player.backBet += delta;
  if (player.selection === 'both') {
    player.frontBet += delta;
    player.backBet += delta;
  }
  return payment;
}

function pushAction(
  state: DoubleSidedPokerState,
  playerId: string,
  action: DoubleSidedPokerBettingAction['action'],
  payment: number,
) {
  const player = state.playerStates[playerId];
  state.roundActions.push({
    round: state.round,
    playerId,
    action,
    selection: player.selection,
    payment,
    stake: player.stake,
  });
}

function settleRound(
  io: IO,
  state: DoubleSidedPokerState,
  winnerId: string | null,
  reason: DoubleSidedPokerRoundResult['reason'],
  foldedPlayerId: string | null,
) {
  clearDecisionTimers(state);
  const potAmount = state.pot;
  let doubleBonus = 0;
  if (winnerId) {
    state.playerStates[winnerId].chips += state.pot;
    state.pot = 0;
    if (winnerId === state.doubleBettorId) {
      const loserId = otherDoubleSidedPokerPlayerId(state, winnerId);
      doubleBonus = Math.min(DOUBLE_SIDED_POKER_DOUBLE_BONUS, state.playerStates[loserId].chips);
      state.playerStates[loserId].chips -= doubleBonus;
      state.playerStates[winnerId].chips += doubleBonus;
    }
  }
  const showdown = foldedPlayerId == null;
  const result: DoubleSidedPokerRoundResult = {
    round: state.round,
    winnerId,
    reason,
    foldedPlayerId,
    potAmount,
    carriedPotAtStart: state.carryRound,
    doubleBettorId: state.doubleBettorId,
    doubleBonus,
    cards: Object.fromEntries(
      state.players.map((player) => {
        const internal = state.playerStates[player.id];
        return [
          player.id,
          { front: internal.card?.front ?? 0, back: revealBack(internal, showdown) },
        ];
      }),
    ),
    selections: Object.fromEntries(
      state.players.map((player) => [player.id, state.playerStates[player.id].selection]),
    ),
    bets: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        {
          front: state.playerStates[player.id].frontBet,
          back: state.playerStates[player.id].backBet,
        },
      ]),
    ),
    chipCountsAfter: chipCounts(state),
    actions: state.roundActions.map((action) => ({ ...action })),
    deckRemainingAfter: state.deck.length,
  };
  state.lastRoundResult = result;
  state.roundResults.push(result);
  state.phase = 'round-result';
  state.currentTurnId = null;
  state.turnStartedAt = null;
  void broadcastDoubleSidedPokerState(io, state);
  state.transitionTimer = setTimeout(() => {
    if (doubleSidedPokerStates.get(state.roomId) !== state || state.gameOver) return;
    state.transitionTimer = null;
    /*
      무승부로 팟이 남았다면 칩이 0 이어도 여기서 끝내지 않는다. 올인한 쪽도
      다음 라운드를 치러 그 팟을 걸고 겨뤄야 한다. 끝내 버리면 이미 건 칩을
      돌려받을 기회 없이 패배 처리된다.
    */
    const willCarry = result.reason === 'tie';
    if (
      !willCarry &&
      state.players.some((player) => state.playerStates[player.id].chips <= 0)
    ) {
      finishForEmptyStack(io, state);
      return;
    }
    state.round += 1;
    state.carryRound = willCarry;
    // 선은 직전 라운드를 이긴 쪽이 잡는다. 무승부면 그대로 둔다.
    if (result.winnerId) state.firstPlayerId = result.winnerId;
    beginDoubleSidedPokerRound(io, state);
  }, DOUBLE_SIDED_POKER_ROUND_RESULT_MS);
}

export function resolveDoubleSidedPokerShowdown(io: IO, state: DoubleSidedPokerState) {
  const [first, second] = state.players;
  const firstState = state.playerStates[first.id];
  const secondState = state.playerStates[second.id];
  let winnerId: string | null;
  if (firstState.selection === 'both' && firstState.card) {
    const target = selectedValue(secondState);
    winnerId =
      target != null && firstState.card.front > target && firstState.card.back > target
        ? first.id
        : second.id;
  } else if (secondState.selection === 'both' && secondState.card) {
    const target = selectedValue(firstState);
    winnerId =
      target != null && secondState.card.front > target && secondState.card.back > target
        ? second.id
        : first.id;
  } else {
    const firstValue = selectedValue(firstState);
    const secondValue = selectedValue(secondState);
    if (firstValue == null || secondValue == null) return;
    winnerId = firstValue === secondValue ? null : firstValue > secondValue ? first.id : second.id;
  }
  settleRound(io, state, winnerId, winnerId == null ? 'tie' : 'showdown', null);
}

function setSelection(
  player: DoubleSidedPokerInternalPlayer,
  side: DoubleSidedPokerSide | undefined,
) {
  if (player.selection != null) return true;
  if (side !== 'front' && side !== 'back') return false;
  player.selection = side;
  return true;
}

function performBettingAction(
  io: IO,
  state: DoubleSidedPokerState,
  playerId: string,
  action: DoubleSidedPokerAction,
) {
  const actor = state.playerStates[playerId];
  const opponentId = otherDoubleSidedPokerPlayerId(state, playerId);

  if (action.type === 'fold') {
    pushAction(state, playerId, 'fold', 0);
    settleRound(io, state, opponentId, 'fold', playerId);
    return null;
  }

  const bounds = doubleSidedPokerBettingBounds(state);
  if (action.type === 'bet') {
    if (
      state.bettingOpened ||
      (action.side !== 'front' && action.side !== 'back') ||
      !Number.isInteger(action.amount) ||
      bounds.minBet == null ||
      bounds.maxBet == null ||
      action.amount < bounds.minBet ||
      action.amount > bounds.maxBet
    ) {
      return '앞면 또는 뒷면에 가능한 범위의 칩을 베팅해 주세요.';
    }
    actor.selection = action.side;
    const payment = applyPayment(state, actor, action.amount);
    state.bettingOpened = true;
    pushAction(state, playerId, 'bet', payment);
    state.currentTurnId = opponentId;
    publishDecision(io, state);
    return null;
  }

  if (action.type === 'double') {
    if (!bounds.canDouble) return '지금은 양면베팅할 수 없습니다.';
    if (!state.bettingOpened) {
      /*
        여는 수로 선언하는 경우. 기준이 될 상대 베팅이 없으므로 한 면에 걸 칩을
        직접 고른다. 앞뒤 두 칸에 각각 내므로 실제로는 두 배가 나간다.
      */
      const amount = action.amount;
      if (
        !Number.isInteger(amount) ||
        bounds.maxDouble == null ||
        amount == null ||
        amount < 1 ||
        amount > bounds.maxDouble
      ) {
        return '양면베팅에 가능한 범위의 칩을 골라 주세요.';
      }
      actor.selection = 'both';
      const openPayment = applyPayment(state, actor, amount);
      state.bettingOpened = true;
      state.doubleBettorId = playerId;
      pushAction(state, playerId, 'double', openPayment);
      state.currentTurnId = opponentId;
      publishDecision(io, state);
      return null;
    }
    if (bounds.doubleCost == null || bounds.maxDouble == null) {
      return '지금은 양면베팅할 수 없습니다.';
    }
    /*
      금액을 안 주면 기준액을 그대로 맞춘다(예전 동작). 더 높이 주면 양면
      레이즈가 되어 상대에게 다시 차례가 넘어간다.
    */
    const stake = action.amount ?? bounds.currentStake;
    if (!Number.isInteger(stake) || stake < bounds.currentStake || stake > bounds.maxDouble) {
      return '양면베팅에 가능한 범위의 칩을 골라 주세요.';
    }
    actor.selection = 'both';
    const payment = applyPayment(state, actor, stake);
    state.doubleBettorId = playerId;
    pushAction(state, playerId, 'double', payment);
    state.currentTurnId = opponentId;
    publishDecision(io, state);
    return null;
  }

  if (!state.bettingOpened) return '먼저 최소 1칩을 베팅해야 합니다.';

  if (action.type === 'raise') {
    if (
      !setSelection(actor, action.side) ||
      !Number.isInteger(action.amount) ||
      bounds.minRaise == null ||
      bounds.maxRaise == null ||
      action.amount < bounds.minRaise ||
      action.amount > bounds.maxRaise
    ) {
      return '선택한 면과 가능한 레이즈 범위를 확인해 주세요.';
    }
    const payment = applyPayment(state, actor, action.amount);
    pushAction(state, playerId, 'raise', payment);
    state.currentTurnId = opponentId;
    publishDecision(io, state);
    return null;
  }

  if (action.type !== 'call') return '현재 선택할 수 없는 행동입니다.';
  if (!setSelection(actor, action.side)) return '베팅할 앞면 또는 뒷면을 선택해 주세요.';
  const payment =
    bounds.currentStake > actor.stake ? applyPayment(state, actor, bounds.currentStake) : 0;
  const mayCloseAfterDouble = state.doubleBettorId != null && playerId !== state.doubleBettorId;
  if (payment <= 0 && !mayCloseAfterDouble) return '콜할 베팅이 없습니다.';
  pushAction(state, playerId, 'call', payment);
  resolveDoubleSidedPokerShowdown(io, state);
  return null;
}

function isAction(value: unknown): value is DoubleSidedPokerAction {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === 'bet' || type === 'call' || type === 'raise' || type === 'double' || type === 'fold'
  );
}

export function performDoubleSidedPokerAction(
  io: IO,
  state: DoubleSidedPokerState,
  playerId: string,
  action: unknown,
): string | null {
  if (state.gameOver || state.phase !== 'betting' || state.currentTurnId !== playerId) {
    return '현재 행동 차례가 아닙니다.';
  }
  if (!isAction(action)) return '올바르지 않은 베팅 요청입니다.';
  return performBettingAction(io, state, playerId, action);
}
