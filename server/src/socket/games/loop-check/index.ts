import { randomUUID } from 'node:crypto';
import {
  LOOP_CHECK_REVEAL_MS,
  resolveLoopCheckOptions,
  type LoopCheckRoundResult,
} from '@shared/types/loop-check.js';
import { validateLoopCheckPath } from '@shared/logic/loop-check.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { generateLoopCheckBoard } from './generator.js';
import {
  broadcastLoopCheckState,
  clearLoopCheckTimers,
  loopCheckStates,
  toLoopCheckRecord,
} from './state.js';
import type { LoopCheckEndGameFn, LoopCheckState } from './types.js';

function isCurrent(state: LoopCheckState) {
  return loopCheckStates.get(state.roomId) === state && !state.gameOver;
}

function finish(io: IO, state: LoopCheckState) {
  clearLoopCheckTimers(state);
  state.phase = 'finished';
  state.gameOver = true;
  void broadcastLoopCheckState(io, state);
  const sorted = [...state.players].sort((a, b) => state.scores[b.id]! - state.scores[a.id]!);
  const rankings = sorted.map((player, index) => ({
    playerId: player.id,
    nickname: player.nickname,
    rank: index === 0 || state.scores[player.id] === state.scores[sorted[0]!.id] ? 1 : 2,
    score: state.scores[player.id]!,
  }));
  const payload = {
    rankings,
    totalTurns: state.history.length,
    gameResultData: toLoopCheckRecord(state),
  };
  state.transitionTimer = setTimeout(() => {
    if (loopCheckStates.get(state.roomId) !== state) return;
    loopCheckStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, 3000);
}

function startRound(io: IO, state: LoopCheckState) {
  const puzzle = generateLoopCheckBoard();
  state.board = puzzle.board;
  state.solution = puzzle.solution;
  state.roundId = randomUUID();
  state.roundStartedAt = Date.now();
  state.phase = 'playing';
  state.lastResult = null;
  state.feedbackByPlayer = {};
  state.lastAttemptAt = {};
  scheduleRound(io, state);
  void broadcastLoopCheckState(io, state);
}

function resolveRound(io: IO, state: LoopCheckState, winnerId: string | null, path: number[]) {
  if (!isCurrent(state) || state.phase !== 'playing') return;
  clearLoopCheckTimers(state);
  if (winnerId) state.scores[winnerId] = (state.scores[winnerId] ?? 0) + 1;
  const result: LoopCheckRoundResult = {
    round: state.round,
    board: { cells: [...state.board.cells] },
    winnerId,
    path: [...path],
    outcome: winnerId ? 'correct' : 'timeout',
    elapsedMs: winnerId ? Math.max(0, Date.now() - state.roundStartedAt) : null,
    scoresAfter: { ...state.scores },
  };
  state.lastResult = result;
  state.history.push(result);
  state.phase = 'reveal';
  void broadcastLoopCheckState(io, state);
  state.transitionTimer = setTimeout(() => {
    if (!isCurrent(state)) return;
    const won =
      state.playMode !== 'solo' &&
      Object.values(state.scores).some((score) => score >= state.winScore);
    if (won || (state.playMode === 'solo' && state.round >= state.bestOf)) return finish(io, state);
    // 시간 초과는 무득점 재출제. 승부가 난 라운드만 3·5·7전에 포함한다.
    if (winnerId || state.playMode === 'solo') state.round++;
    startRound(io, state);
  }, LOOP_CHECK_REVEAL_MS);
}

function scheduleRound(io: IO, state: LoopCheckState) {
  const roundId = state.roundId;
  if (state.roundSeconds != null)
    state.roundTimer = setTimeout(() => {
      if (isCurrent(state) && state.roundId === roundId && state.phase === 'playing')
        resolveRound(io, state, null, state.solution);
    }, state.roundSeconds * 1000);
  if (state.playMode === 'com') {
    const delay = 7500 + Math.random() * 6000;
    state.aiTimer = setTimeout(() => {
      if (!isCurrent(state) || state.roundId !== roundId || state.phase !== 'playing') return;
      if (
        state.roundSeconds != null &&
        Date.now() >= state.roundStartedAt + state.roundSeconds * 1000
      )
        return resolveRound(io, state, null, state.solution);
      resolveRound(io, state, AI_PLAYER_ID, state.solution);
    }, delay);
  }
}

export function initLoopCheck(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: LoopCheckEndGameFn,
  gameOptions: Record<string, unknown> = {},
) {
  cleanupLoopCheck(roomId);
  const activePlayers = players.slice(0, playMode === 'solo' ? 1 : 2);
  if (activePlayers.length !== (playMode === 'solo' ? 1 : 2))
    throw new Error('루프체크 플레이어 수가 올바르지 않습니다.');
  const options = resolveLoopCheckOptions(gameOptions);
  const puzzle = generateLoopCheckBoard();
  const state: LoopCheckState = {
    roomId,
    players: activePlayers,
    playMode,
    ...options,
    phase: 'playing',
    round: 1,
    roundId: randomUUID(),
    board: puzzle.board,
    solution: puzzle.solution,
    scores: Object.fromEntries(activePlayers.map((player) => [player.id, 0])),
    startedAt,
    roundStartedAt: Date.now(),
    roundSeconds:
      typeof timeLimitSeconds === 'number' &&
      Number.isFinite(timeLimitSeconds) &&
      timeLimitSeconds >= 10
        ? Math.min(600, timeLimitSeconds)
        : null,
    history: [],
    lastResult: null,
    feedbackByPlayer: {},
    lastAttemptAt: {},
    gameOver: false,
    roundTimer: null,
    transitionTimer: null,
    aiTimer: null,
    endGameCallback,
  };
  loopCheckStates.set(roomId, state);
  scheduleRound(io, state);
  void broadcastLoopCheckState(io, state);
}

export function handleLoopCheckAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  action: Record<string, unknown>,
) {
  const state = loopCheckStates.get(roomId);
  if (
    !state ||
    !isCurrent(state) ||
    state.phase !== 'playing' ||
    action.type !== 'submit' ||
    action.roundId !== state.roundId
  )
    return;
  const id = sessions.getToken(socket.id) ?? socket.id;
  if (id === AI_PLAYER_ID || !state.players.some((player) => player.id === id)) return;
  const now = Date.now();
  if (state.roundSeconds != null && now >= state.roundStartedAt + state.roundSeconds * 1000)
    return resolveRound(io, state, null, state.solution);
  if (now - (state.lastAttemptAt[id] ?? -Infinity) < 350) return;
  state.lastAttemptAt[id] = now;
  const error = validateLoopCheckPath(state.board, action.path);
  if (error) {
    state.feedbackByPlayer[id] = { message: error, attemptedAt: now };
    void broadcastLoopCheckState(io, state);
    return;
  }
  resolveRound(io, state, id, action.path as number[]);
}

export function cleanupLoopCheck(roomId: string) {
  const state = loopCheckStates.get(roomId);
  if (state) clearLoopCheckTimers(state);
  loopCheckStates.delete(roomId);
}
export function getLoopCheckState(roomId: string) {
  const state = loopCheckStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.history.length } : undefined;
}
export function getLoopCheckResultData(roomId: string) {
  const state = loopCheckStates.get(roomId);
  return state ? toLoopCheckRecord(state) : undefined;
}
export function performLoopCheckUndo(): boolean {
  return false;
}
export function canLoopCheckUndo(): boolean {
  return false;
}
export { emitLoopCheckStateToSocket } from './state.js';
