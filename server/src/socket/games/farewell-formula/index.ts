/** 이별 공식 — 지정 횟수만큼 문자를 삭제해 올바른 등식을 만드는 7라운드 선착순 게임. */
import {
  buildFarewellExpression,
  evaluateFarewellEquation,
} from '@shared/logic/farewell-formula.js';
import {
  FF_REVEAL_MS,
  FF_TOTAL_ROUNDS,
  FF_WIN_SCORE,
  type FarewellFormulaAction,
  type FarewellFormulaRoundResult,
} from '@shared/types/farewell-formula.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { generateFarewellFormulaPuzzle } from './generator.js';
import {
  broadcastFarewellFormulaState,
  clearFarewellFormulaTimers,
  emitFarewellFormulaStateToSocket,
  farewellFormulaStates,
  toFarewellFormulaRecord,
} from './state.js';
import type { FarewellFormulaEndGameFn, FarewellFormulaState } from './types.js';

const FINISH_DISPLAY_MS = 3000;
const ATTEMPT_COOLDOWN_MS = 350;

function setFeedback(state: FarewellFormulaState, playerId: string, message: string) {
  state.feedbackByPlayer[playerId] = { message, attemptedAt: Date.now() };
}

function dealRound(state: FarewellFormulaState) {
  const puzzle = generateFarewellFormulaPuzzle(state.round, state.usedPuzzleKeys);
  state.usedPuzzleKeys.add(puzzle.key);
  state.puzzle = puzzle;
  state.phase = 'playing';
  state.lastResult = null;
  state.feedbackByPlayer = {};
  state.roundStartedAt = Date.now();
}

function rankingsFor(state: FarewellFormulaState) {
  const [first, second] = state.players;
  const firstScore = state.scores[first.id] ?? 0;
  if (state.playMode === 'solo') {
    return [{ playerId: first.id, nickname: first.nickname, rank: 1, score: firstScore }];
  }
  const secondScore = state.scores[second.id] ?? 0;
  if (firstScore === secondScore) {
    return [
      { playerId: first.id, nickname: first.nickname, rank: 1, score: firstScore },
      { playerId: second.id, nickname: second.nickname, rank: 1, score: secondScore },
    ];
  }
  const winner = firstScore > secondScore ? first : second;
  const loser = winner.id === first.id ? second : first;
  return [
    {
      playerId: winner.id,
      nickname: winner.nickname,
      rank: 1,
      score: state.scores[winner.id] ?? 0,
    },
    { playerId: loser.id, nickname: loser.nickname, rank: 2, score: state.scores[loser.id] ?? 0 },
  ];
}

function hasClinched(state: FarewellFormulaState) {
  return (
    state.playMode !== 'solo' && Object.values(state.scores).some((score) => score >= FF_WIN_SCORE)
  );
}

function finishGame(io: IO, state: FarewellFormulaState) {
  if (state.gameOver) return;
  clearFarewellFormulaTimers(state);
  state.phase = 'finished';
  state.gameOver = true;
  void broadcastFarewellFormulaState(io, state);
  const payload = {
    rankings: rankingsFor(state),
    totalTurns: state.history.length,
    gameResultData: toFarewellFormulaRecord(state),
  };
  state.transitionTimer = setTimeout(() => {
    if (farewellFormulaStates.get(state.roomId) !== state) return;
    farewellFormulaStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function scheduleAi(io: IO, state: FarewellFormulaState) {
  if (state.playMode !== 'com' || state.phase !== 'playing' || state.gameOver) return;
  if (state.aiTimer) clearTimeout(state.aiTimer);
  const baseDelay = 2200 + state.puzzle.goodbyeCount * 1900 + Math.random() * 2400;
  const deadlineDelay =
    state.roundSeconds == null
      ? baseDelay
      : Math.min(baseDelay, Math.max(900, state.roundSeconds * 1000 - 700));
  const round = state.round;
  state.aiTimer = setTimeout(() => {
    if (
      farewellFormulaStates.get(state.roomId) !== state ||
      state.gameOver ||
      state.phase !== 'playing' ||
      state.round !== round
    )
      return;
    const answer = state.puzzle.solutions[0]!;
    resolveCorrect(io, state, AI_PLAYER_ID, answer.removedUnitIds, answer.expression);
  }, deadlineDelay);
}

function startRoundTimer(io: IO, state: FarewellFormulaState) {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  state.roundTimer = null;
  if (state.roundSeconds != null) {
    const round = state.round;
    state.roundTimer = setTimeout(() => {
      if (
        farewellFormulaStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.phase !== 'playing' ||
        state.round !== round
      )
        return;
      resolveTimeout(io, state);
    }, state.roundSeconds * 1000);
  }
  scheduleAi(io, state);
}

function revealThenAdvance(io: IO, state: FarewellFormulaState) {
  state.transitionTimer = setTimeout(() => {
    if (farewellFormulaStates.get(state.roomId) !== state || state.gameOver) return;
    if (hasClinched(state) || state.round >= FF_TOTAL_ROUNDS) {
      finishGame(io, state);
      return;
    }
    state.round++;
    dealRound(state);
    startRoundTimer(io, state);
    void broadcastFarewellFormulaState(io, state);
  }, FF_REVEAL_MS);
}

function stopRoundTimers(state: FarewellFormulaState) {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.roundTimer = null;
  state.aiTimer = null;
}

function resolveCorrect(
  io: IO,
  state: FarewellFormulaState,
  callerId: string,
  removedUnitIds: number[],
  expression: string,
) {
  if (state.gameOver || state.phase !== 'playing') return;
  stopRoundTimers(state);
  state.scores[callerId] = (state.scores[callerId] ?? 0) + 1;
  const answer = state.puzzle.solutions[0]!;
  const result: FarewellFormulaRoundResult = {
    round: state.round,
    source: state.puzzle.source,
    goodbyeCount: state.puzzle.goodbyeCount,
    callerId,
    outcome: 'correct',
    removedUnitIds: [...removedUnitIds],
    correctedExpression: expression,
    answerRemovedUnitIds: [...answer.removedUnitIds],
    answerExpression: answer.expression,
    reason: '올바른 수식을 먼저 완성했습니다.',
    elapsedMs: Math.max(0, Date.now() - state.roundStartedAt),
    scoresAfter: { ...state.scores },
  };
  state.history.push(result);
  state.lastResult = result;
  state.phase = 'reveal';
  void broadcastFarewellFormulaState(io, state);
  revealThenAdvance(io, state);
}

function resolveTimeout(io: IO, state: FarewellFormulaState) {
  if (state.gameOver || state.phase !== 'playing') return;
  stopRoundTimers(state);
  const answer = state.puzzle.solutions[0]!;
  const result: FarewellFormulaRoundResult = {
    round: state.round,
    source: state.puzzle.source,
    goodbyeCount: state.puzzle.goodbyeCount,
    callerId: null,
    outcome: 'timeout',
    removedUnitIds: [],
    correctedExpression: answer.expression,
    answerRemovedUnitIds: [...answer.removedUnitIds],
    answerExpression: answer.expression,
    reason: '제한시간이 끝났습니다.',
    elapsedMs: null,
    scoresAfter: { ...state.scores },
  };
  state.history.push(result);
  state.lastResult = result;
  state.phase = 'reveal';
  void broadcastFarewellFormulaState(io, state);
  revealThenAdvance(io, state);
}

function parseRemovedUnitIds(value: unknown, state: FarewellFormulaState) {
  if (!Array.isArray(value) || value.length > state.puzzle.tokens.length) return null;
  const unitIds = value.map((entry) =>
    typeof entry === 'number' && Number.isInteger(entry) ? entry : -1,
  );
  if (new Set(unitIds).size !== unitIds.length) return null;
  const allowed = new Set(state.puzzle.tokens.map((token) => token.unitId));
  if (unitIds.some((unitId) => !allowed.has(unitId))) return null;
  return unitIds.sort((a, b) => a - b);
}

export function initFarewellFormula(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: FarewellFormulaEndGameFn,
) {
  const previous = farewellFormulaStates.get(roomId);
  if (previous) clearFarewellFormulaTimers(previous);
  farewellFormulaStates.delete(roomId);

  const first = players[0];
  if (!first) throw new Error('이별 공식을 시작할 플레이어가 필요합니다.');
  const second = playMode === 'solo' ? first : players[1];
  if (!second) throw new Error('멀티/COM 이별 공식은 두 명의 플레이어가 필요합니다.');
  const state: FarewellFormulaState = {
    roomId,
    playMode,
    players: [first, second],
    phase: 'playing',
    round: 1,
    puzzle: generateFarewellFormulaPuzzle(1),
    usedPuzzleKeys: new Set(),
    scores: { [first.id]: 0, [second.id]: 0 },
    history: [],
    lastResult: null,
    feedbackByPlayer: {},
    lastAttemptAt: {},
    roundStartedAt: Date.now(),
    roundSeconds: timeLimitSeconds,
    startedAt,
    gameOver: false,
    roundTimer: null,
    transitionTimer: null,
    aiTimer: null,
    endGameCallback,
  };
  state.usedPuzzleKeys.add(state.puzzle.key);
  farewellFormulaStates.set(roomId, state);
  startRoundTimer(io, state);
  void broadcastFarewellFormulaState(io, state);
}

export function handleFarewellFormulaAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = farewellFormulaStates.get(roomId);
  if (!state || state.gameOver || state.phase !== 'playing') return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId) || playerId === AI_PLAYER_ID) return;
  const action = rawData as FarewellFormulaAction;
  if (action.type !== 'submit') return;

  const now = Date.now();
  if (now - (state.lastAttemptAt[playerId] ?? 0) < ATTEMPT_COOLDOWN_MS) return;
  state.lastAttemptAt[playerId] = now;

  const removedUnitIds = parseRemovedUnitIds(action.removedUnitIds, state);
  if (!removedUnitIds) {
    setFeedback(state, playerId, '삭제 정보가 올바르지 않습니다.');
    void broadcastFarewellFormulaState(io, state);
    return;
  }
  if (removedUnitIds.length !== state.puzzle.goodbyeCount) {
    setFeedback(state, playerId, `정확히 ${state.puzzle.goodbyeCount}번 이별해야 합니다.`);
    void broadcastFarewellFormulaState(io, state);
    return;
  }

  const expression = buildFarewellExpression(state.puzzle.tokens, removedUnitIds);
  const evaluation = evaluateFarewellEquation(expression);
  if (!evaluation.correct) {
    setFeedback(state, playerId, evaluation.reason);
    void broadcastFarewellFormulaState(io, state);
    return;
  }
  resolveCorrect(io, state, playerId, removedUnitIds, expression);
}

export function cleanupFarewellFormula(roomId: string) {
  const state = farewellFormulaStates.get(roomId);
  if (state) clearFarewellFormulaTimers(state);
  farewellFormulaStates.delete(roomId);
}

export function getFarewellFormulaState(roomId: string) {
  const state = farewellFormulaStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.history.length } : undefined;
}

export function getFarewellFormulaResultData(roomId: string) {
  const state = farewellFormulaStates.get(roomId);
  return state ? toFarewellFormulaRecord(state) : undefined;
}

export function performFarewellFormulaUndo(): boolean {
  return false;
}

export function canFarewellFormulaUndo(): boolean {
  return false;
}

export { emitFarewellFormulaStateToSocket };
