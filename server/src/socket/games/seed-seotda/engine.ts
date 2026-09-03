import {
  SEED_SEOTDA_ANTE,
  type SeedSeotdaAction,
  type SeedSeotdaEvaluation,
  type SeedSeotdaRoundResult,
} from '@shared/types/seed-seotda.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { IO } from '../../types.js';
import { chooseSeedSeotdaAiAction } from './ai.js';
import {
  SEED_SEOTDA_AI_DELAY_MAX_MS,
  SEED_SEOTDA_AI_DELAY_MIN_MS,
  SEED_SEOTDA_FINISH_DISPLAY_MS,
  SEED_SEOTDA_ROUND_RESULT_MS,
} from './constants.js';
import { shuffleSeedSeotdaDeck } from './deck.js';
import { compareSeedSeotdaHands, evaluateSeedSeotdaHand } from './judge.js';
import {
  broadcastSeedSeotdaState,
  clearSeedSeotdaTimers,
  otherSeedSeotdaPlayerId,
  seedSeotdaBettingBounds,
  seedSeotdaStates,
  toSeedSeotdaRecord,
} from './state.js';
import type { SeedSeotdaState } from './types.js';

function chipCounts(state: SeedSeotdaState) {
  return Object.fromEntries(
    state.players.map((player) => [player.id, state.playerStates[player.id].chips]),
  );
}

function clearDecisionTimers(state: SeedSeotdaState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.turnTimer = null;
  state.aiTimer = null;
}

function finishGame(io: IO, state: SeedSeotdaState, winnerId: string | null, reason: string) {
  if (state.gameOver) return;
  clearSeedSeotdaTimers(state);
  state.gameOver = true;
  state.phase = 'finished';
  state.currentTurnId = null;
  state.turnStartedAt = null;
  state.winnerId = winnerId;
  state.finishReason = reason;
  void broadcastSeedSeotdaState(io, state);

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
    gameResultData: toSeedSeotdaRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (seedSeotdaStates.get(state.roomId) !== state) return;
    seedSeotdaStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, SEED_SEOTDA_FINISH_DISPLAY_MS);
}

function finishForAnteLack(io: IO, state: SeedSeotdaState) {
  const [first, second] = state.players;
  const firstCanPay = state.playerStates[first.id].chips >= SEED_SEOTDA_ANTE;
  const secondCanPay = state.playerStates[second.id].chips >= SEED_SEOTDA_ANTE;
  let winnerId: string | null = null;
  if (firstCanPay !== secondCanPay) winnerId = firstCanPay ? first.id : second.id;
  else {
    const difference = state.playerStates[first.id].chips - state.playerStates[second.id].chips;
    if (difference !== 0) winnerId = difference > 0 ? first.id : second.id;
  }
  const winner = state.players.find((player) => player.id === winnerId);
  finishGame(
    io,
    state,
    winnerId,
    winner
      ? `기본 베팅 1칩을 낼 수 없는 상대를 상대로 ${winner.nickname} 님이 승리했습니다.`
      : '두 플레이어 모두 기본 베팅을 낼 수 없어 무승부입니다.',
  );
}

function scheduleDecision(io: IO, state: SeedSeotdaState) {
  clearDecisionTimers(state);
  if (state.gameOver || state.currentTurnId == null) return;
  state.turnStartedAt = Date.now();
  const actorId = state.currentTurnId;
  if (state.turnSeconds != null) {
    state.turnTimer = setTimeout(() => {
      if (
        seedSeotdaStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.currentTurnId !== actorId
      ) {
        return;
      }
      const action: SeedSeotdaAction =
        state.phase === 'seed-choice' ? { type: 'skip-seed' } : { type: 'die' };
      performSeedSeotdaAction(io, state, actorId, action);
    }, state.turnSeconds * 1000);
  }
  if (state.playMode === 'com' && actorId === AI_PLAYER_ID) {
    const delay =
      SEED_SEOTDA_AI_DELAY_MIN_MS +
      Math.random() * (SEED_SEOTDA_AI_DELAY_MAX_MS - SEED_SEOTDA_AI_DELAY_MIN_MS);
    state.aiTimer = setTimeout(() => {
      if (
        seedSeotdaStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.currentTurnId !== AI_PLAYER_ID
      ) {
        return;
      }
      performSeedSeotdaAction(io, state, AI_PLAYER_ID, chooseSeedSeotdaAiAction(state));
    }, delay);
  }
}

/*
  패 버리기 단계는 동시 제출이다. 차례를 넘기지 않고 둘 다 낼 때까지 기다리므로
  제한시간도 사람마다가 아니라 단계 하나에 한 번만 건다. 시간이 다 되면 아직
  안 낸 사람은 '버리지 않음' 으로 처리한다.
*/
function scheduleSeedChoice(io: IO, state: SeedSeotdaState) {
  clearDecisionTimers(state);
  if (state.gameOver || state.phase !== 'seed-choice') return;
  state.turnStartedAt = Date.now();
  const pending = state.players.filter(
    (player) => state.playerStates[player.id].seedChoice === 'pending',
  );
  if (pending.length === 0) return;

  if (state.turnSeconds != null) {
    state.turnTimer = setTimeout(() => {
      if (seedSeotdaStates.get(state.roomId) !== state || state.gameOver) return;
      if (state.phase !== 'seed-choice') return;
      for (const player of state.players) {
        if (state.playerStates[player.id].seedChoice === 'pending') {
          performSeedSeotdaAction(io, state, player.id, { type: 'skip-seed' });
        }
      }
    }, state.turnSeconds * 1000);
  }

  if (state.playMode === 'com' && pending.some((player) => player.id === AI_PLAYER_ID)) {
    const delay =
      SEED_SEOTDA_AI_DELAY_MIN_MS +
      Math.random() * (SEED_SEOTDA_AI_DELAY_MAX_MS - SEED_SEOTDA_AI_DELAY_MIN_MS);
    state.aiTimer = setTimeout(() => {
      if (seedSeotdaStates.get(state.roomId) !== state || state.gameOver) return;
      if (state.phase !== 'seed-choice') return;
      if (state.playerStates[AI_PLAYER_ID].seedChoice !== 'pending') return;
      performSeedSeotdaAction(io, state, AI_PLAYER_ID, chooseSeedSeotdaAiAction(state));
    }, delay);
  }
}

function publishDecision(io: IO, state: SeedSeotdaState) {
  if (state.phase === 'seed-choice') scheduleSeedChoice(io, state);
  else scheduleDecision(io, state);
  void broadcastSeedSeotdaState(io, state);
}

export function beginSeedSeotdaRound(io: IO, state: SeedSeotdaState) {
  if (state.gameOver) return;
  clearDecisionTimers(state);
  state.ante = SEED_SEOTDA_ANTE;
  if (
    !state.carryRound &&
    state.players.some((player) => state.playerStates[player.id].chips < 1)
  ) {
    finishForAnteLack(io, state);
    return;
  }
  if (state.deck.length < 5) {
    state.deck = shuffleSeedSeotdaDeck();
    state.deckCycles += 1;
  }
  const take = () => {
    const card = state.deck.pop();
    if (!card) throw new Error('시드섯다 덱이 비어 있습니다.');
    return card;
  };

  state.seedCard = take();
  for (const player of state.players) {
    const playerState = state.playerStates[player.id];
    playerState.roundBet = 0;
    playerState.cards = [take(), take()];
    playerState.finalHand = [];
    playerState.seedChoice = 'pending';
    playerState.discardIndex = null;
    if (!state.carryRound) {
      playerState.chips -= SEED_SEOTDA_ANTE;
      playerState.roundBet = SEED_SEOTDA_ANTE;
      state.pot += SEED_SEOTDA_ANTE;
    }
  }
  state.bettingOpened = false;
  state.roundActions = [];
  state.lastRoundResult = null;
  state.roundStartedAt = Date.now();
  state.phase = 'seed-choice';
  // 동시 제출이라 '누구 차례' 가 없다.
  state.currentTurnId = null;
  publishDecision(io, state);
}

function evaluations(state: SeedSeotdaState) {
  return Object.fromEntries(
    state.players.map((player) => [
      player.id,
      evaluateSeedSeotdaHand(state.playerStates[player.id].finalHand),
    ]),
  ) as Record<string, SeedSeotdaEvaluation>;
}

function seedChoices(state: SeedSeotdaState) {
  return Object.fromEntries(
    state.players.map((player) => [
      player.id,
      state.playerStates[player.id].seedChoice === 'used' ? 'used' : 'unused',
    ]),
  ) as SeedSeotdaRoundResult['seedChoices'];
}

function settleRound(io: IO, state: SeedSeotdaState, result: SeedSeotdaRoundResult) {
  clearDecisionTimers(state);
  state.lastRoundResult = result;
  state.roundResults.push(result);
  state.phase = 'round-result';
  state.currentTurnId = null;
  state.turnStartedAt = null;
  void broadcastSeedSeotdaState(io, state);
  state.transitionTimer = setTimeout(() => {
    if (seedSeotdaStates.get(state.roomId) !== state || state.gameOver) return;
    state.transitionTimer = null;
    state.round += 1;
    const replay =
      result.reason === 'tie' ||
      result.reason === 'gusa-rematch' ||
      result.reason === 'mung-gusa-rematch';
    state.carryRound = replay;
    if (!replay) state.firstPlayerId = otherSeedSeotdaPlayerId(state, state.firstPlayerId);
    beginSeedSeotdaRound(io, state);
  }, SEED_SEOTDA_ROUND_RESULT_MS);
}

export function resolveSeedSeotdaShowdown(io: IO, state: SeedSeotdaState) {
  if (!state.seedCard) return;
  const hands = evaluations(state);
  const [first, second] = state.players;
  const outcome = compareSeedSeotdaHands(hands[first.id], hands[second.id]);
  const winnerId = outcome.comparison === 0 ? null : outcome.comparison > 0 ? first.id : second.id;
  const potAmount = state.pot;
  if (winnerId != null) {
    state.playerStates[winnerId].chips += state.pot;
    state.pot = 0;
  }
  settleRound(io, state, {
    round: state.round,
    winnerId,
    reason: outcome.reason,
    foldedPlayerId: null,
    potAmount,
    carryRound: state.carryRound,
    seedCard: { ...state.seedCard },
    hands: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        state.playerStates[player.id].finalHand.map((card) => ({ ...card })),
      ]),
    ),
    evaluations: hands,
    seedChoices: seedChoices(state),
    diePenalty: 0,
    chipCountsAfter: chipCounts(state),
    actions: state.roundActions.map((action) => ({ ...action })),
    deckRemainingAfter: state.deck.length,
  });
}

function settleDie(io: IO, state: SeedSeotdaState, foldedPlayerId: string) {
  if (!state.seedCard) return;
  const winnerId = otherSeedSeotdaPlayerId(state, foldedPlayerId);
  const hands = evaluations(state);
  const potAmount = state.pot;
  state.playerStates[winnerId].chips += state.pot;
  state.pot = 0;

  const foldedOutcome = compareSeedSeotdaHands(hands[foldedPlayerId], hands[winnerId]);
  const diePenalty =
    foldedOutcome.reason === 'showdown' && foldedOutcome.comparison > 0
      ? Math.min(5, state.playerStates[foldedPlayerId].chips)
      : 0;
  if (diePenalty > 0) {
    state.playerStates[foldedPlayerId].chips -= diePenalty;
    state.playerStates[winnerId].chips += diePenalty;
  }

  settleRound(io, state, {
    round: state.round,
    winnerId,
    reason: 'die',
    foldedPlayerId,
    potAmount,
    carryRound: state.carryRound,
    seedCard: { ...state.seedCard },
    hands: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        player.id === foldedPlayerId
          ? state.playerStates[player.id].finalHand.map((card) => ({ ...card }))
          : null,
      ]),
    ),
    evaluations: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        player.id === foldedPlayerId ? hands[player.id] : null,
      ]),
    ),
    seedChoices: seedChoices(state),
    diePenalty,
    chipCountsAfter: chipCounts(state),
    actions: state.roundActions.map((action) => ({ ...action })),
    deckRemainingAfter: state.deck.length,
  });
}

function startBetting(io: IO, state: SeedSeotdaState) {
  state.phase = 'betting';
  state.currentTurnId = state.firstPlayerId;
  state.bettingOpened = false;
  if (seedSeotdaBettingBounds(state).maxBet == null) {
    resolveSeedSeotdaShowdown(io, state);
    return;
  }
  publishDecision(io, state);
}

function performSeedChoice(
  io: IO,
  state: SeedSeotdaState,
  playerId: string,
  action: Extract<SeedSeotdaAction, { type: 'use-seed' | 'skip-seed' }>,
) {
  const player = state.playerStates[playerId];
  if (!state.seedCard || player.cards.length !== 2) return '카드가 아직 준비되지 않았습니다.';
  if (action.type === 'use-seed') {
    if (action.discardIndex !== 0 && action.discardIndex !== 1) {
      return '버릴 카드 한 장을 선택해 주세요.';
    }
    const keptIndex = action.discardIndex === 0 ? 1 : 0;
    player.finalHand = [{ ...state.seedCard }, { ...player.cards[keptIndex] }];
    player.seedChoice = 'used';
    player.discardIndex = action.discardIndex;
  } else {
    player.finalHand = [{ ...player.cards[0] }, { ...player.cards[1] }];
    player.seedChoice = 'unused';
    player.discardIndex = null;
  }

  const opponentId = otherSeedSeotdaPlayerId(state, playerId);
  if (state.playerStates[opponentId].seedChoice === 'pending') {
    /*
      아직 안 낸 사람이 있으면 화면만 갱신한다. 여기서 다시 스케줄하면 제한시간이
      먼저 낸 쪽 때문에 늘어난다.
    */
    void broadcastSeedSeotdaState(io, state);
    return null;
  }
  startBetting(io, state);
  return null;
}

function performBetting(
  io: IO,
  state: SeedSeotdaState,
  playerId: string,
  action: Extract<SeedSeotdaAction, { type: 'bet' | 'call' | 'raise' | 'die' }>,
) {
  const actor = state.playerStates[playerId];
  const opponentId = otherSeedSeotdaPlayerId(state, playerId);
  const opponent = state.playerStates[opponentId];
  if (action.type === 'die') {
    state.roundActions.push({
      round: state.round,
      playerId,
      action: 'die',
      amount: 0,
      totalBet: actor.roundBet,
    });
    settleDie(io, state, playerId);
    return null;
  }

  const bounds = seedSeotdaBettingBounds(state);
  if (action.type === 'bet') {
    if (
      state.bettingOpened ||
      !Number.isInteger(action.amount) ||
      bounds.minBet == null ||
      bounds.maxBet == null ||
      action.amount < bounds.minBet ||
      action.amount > bounds.maxBet
    ) {
      return '가능한 베팅 범위를 확인해 주세요.';
    }
    actor.chips -= action.amount;
    actor.roundBet += action.amount;
    state.pot += action.amount;
    state.bettingOpened = true;
    state.roundActions.push({
      round: state.round,
      playerId,
      action: 'bet',
      amount: action.amount,
      totalBet: actor.roundBet,
    });
    state.currentTurnId = opponentId;
    publishDecision(io, state);
    return null;
  }

  if (!state.bettingOpened) return '먼저 베팅을 시작해야 합니다.';
  if (action.type === 'raise') {
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
    state.roundActions.push({
      round: state.round,
      playerId,
      action: 'raise',
      amount: payment,
      totalBet: actor.roundBet,
    });
    state.currentTurnId = opponentId;
    publishDecision(io, state);
    return null;
  }

  const payment = Math.max(0, opponent.roundBet - actor.roundBet);
  if (payment <= 0) return '콜할 베팅이 없습니다.';
  if (payment > actor.chips) return '콜에 필요한 칩이 부족합니다.';
  actor.chips -= payment;
  actor.roundBet += payment;
  state.pot += payment;
  state.roundActions.push({
    round: state.round,
    playerId,
    action: 'call',
    amount: payment,
    totalBet: actor.roundBet,
  });
  resolveSeedSeotdaShowdown(io, state);
  return null;
}

export function performSeedSeotdaAction(
  io: IO,
  state: SeedSeotdaState,
  playerId: string,
  action: SeedSeotdaAction,
): string | null {
  if (state.gameOver) return '현재 행동 차례가 아닙니다.';
  if (state.phase === 'seed-choice') {
    // 동시 제출이라 차례를 따지지 않는다. 아직 안 낸 사람만 낼 수 있다.
    if (!state.playerStates[playerId]) return '현재 행동 차례가 아닙니다.';
    if (state.playerStates[playerId].seedChoice !== 'pending') return '이미 제출했습니다.';
    if (action.type !== 'use-seed' && action.type !== 'skip-seed') {
      return '버릴 패를 고르거나 버리지 않기를 선택해 주세요.';
    }
    return performSeedChoice(io, state, playerId, action);
  }
  if (state.currentTurnId !== playerId) return '현재 행동 차례가 아닙니다.';
  if (state.phase === 'betting') {
    if (!['bet', 'call', 'raise', 'die'].includes(action.type)) {
      return '현재 베팅 단계에서 할 수 없는 행동입니다.';
    }
    return performBetting(
      io,
      state,
      playerId,
      action as Extract<SeedSeotdaAction, { type: 'bet' | 'call' | 'raise' | 'die' }>,
    );
  }
  return '현재 행동할 수 없는 단계입니다.';
}
