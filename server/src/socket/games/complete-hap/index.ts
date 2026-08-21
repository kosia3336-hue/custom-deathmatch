import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import {
  CH_CALL_SECONDS,
  CH_GYUL_SCORE,
  CH_HAP_SCORE,
  CH_MATCH_SECONDS,
  CH_TURN_SECONDS,
  type CompleteHapAction,
  type CompleteHapActionKind,
} from '@shared/types/complete-hap.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { completeHapSetKey, dealCompleteHapBoards } from './generator.js';
import {
  broadcastCompleteHapState,
  clearCompleteHapTimers,
  completeHapStates,
  emitCompleteHapStateToSocket,
  toCompleteHapRecord,
} from './state.js';
import type { CompleteHapEndGameFn, CompleteHapState } from './types.js';

const FINISH_DISPLAY_MS = 3000;
const AI_THINK_MIN_MS = 1200;
const AI_THINK_MAX_MS = 4200;
const AI_CALL_MIN_MS = 600;
const AI_CALL_MAX_MS = 1500;

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum);
}

function clearPhaseTimers(state: CompleteHapState) {
  if (state.phaseTimer) clearTimeout(state.phaseTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.phaseTimer = null;
  state.aiTimer = null;
}

function activeBoardIndexes(state: CompleteHapState) {
  return state.boards.flatMap((board, index) => (board.completed ? [] : [index]));
}

function remainingSets(state: CompleteHapState, boardIndex: number) {
  const board = state.boards[boardIndex];
  if (!board || board.completed) return [];
  return board.allSets.filter((set) => !board.claimedSetKeys.has(completeHapSetKey(set)));
}

function allBoardsCompleted(state: CompleteHapState) {
  return state.boards.every((board) => board.completed);
}

function addRecord(
  state: CompleteHapState,
  kind: CompleteHapActionKind,
  playerId: string,
  boardIndex: number | null,
  cardIndexes: number[] | null,
  scoreDelta: number,
  elapsedMs: number,
  correct: boolean,
) {
  state.scores[playerId] = (state.scores[playerId] ?? 0) + scoreDelta;
  if (correct) {
    state.correctElapsedMs[playerId] = (state.correctElapsedMs[playerId] ?? 0) + elapsedMs;
    state.firstCorrectAt[playerId] ??= Date.now();
  }
  const record = {
    turn: state.turn,
    playerId,
    kind,
    boardIndex,
    cardIndexes: cardIndexes ? [...cardIndexes] : null,
    scoreDelta,
    scoreAfter: state.scores[playerId] ?? 0,
    elapsedMs,
    createdAt: Date.now(),
  };
  state.actionLog.push(record);
  state.lastAction = record;
}

function winnerFor(state: CompleteHapState) {
  const [first, second] = state.players;
  if (state.playMode === 'solo') return first;

  const firstScore = state.scores[first.id] ?? 0;
  const secondScore = state.scores[second.id] ?? 0;
  if (firstScore !== secondScore) return firstScore > secondScore ? first : second;
  if (firstScore === 0) return null;

  const firstElapsed = state.correctElapsedMs[first.id] ?? 0;
  const secondElapsed = state.correctElapsedMs[second.id] ?? 0;
  if (firstElapsed !== secondElapsed) return firstElapsed < secondElapsed ? first : second;

  const firstCorrectAt = state.firstCorrectAt[first.id] ?? Number.POSITIVE_INFINITY;
  const secondCorrectAt = state.firstCorrectAt[second.id] ?? Number.POSITIVE_INFINITY;
  if (firstCorrectAt !== secondCorrectAt) return firstCorrectAt < secondCorrectAt ? first : second;

  // 0:0 이외에는 무승부가 없다는 규칙의 마지막 안정적 우위 조건.
  return first;
}

function rankingsFor(state: CompleteHapState) {
  const [first, second] = state.players;
  if (state.playMode === 'solo') {
    return [
      {
        playerId: first.id,
        nickname: first.nickname,
        rank: 1,
        score: state.scores[first.id] ?? 0,
      },
    ];
  }
  const winner = winnerFor(state);
  if (!winner) {
    return [first, second].map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      rank: 1,
      score: state.scores[player.id] ?? 0,
    }));
  }
  const loser = winner.id === first.id ? second : first;
  return [winner, loser].map((player, index) => ({
    playerId: player.id,
    nickname: player.nickname,
    rank: index + 1,
    score: state.scores[player.id] ?? 0,
  }));
}

function finishGame(io: IO, state: CompleteHapState, baseReason: string) {
  if (state.gameOver) return;
  clearCompleteHapTimers(state);
  const winner = winnerFor(state);
  state.gameOver = true;
  state.phase = 'finished';
  state.selectedBoardIndex = null;
  state.phaseStartedAt = Date.now();
  state.winnerId = winner?.id ?? null;
  state.finishReason =
    state.playMode === 'solo'
      ? `${baseReason} 최종 ${state.scores[state.players[0].id] ?? 0}점입니다.`
      : winner
        ? `${baseReason} ${winner.nickname} 님이 승리했습니다.`
        : `${baseReason} 0:0 무승부입니다.`;
  void broadcastCompleteHapState(io, state);

  const payload = {
    rankings: rankingsFor(state),
    totalTurns: state.turn,
    gameResultData: toCompleteHapRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (completeHapStates.get(state.roomId) !== state) return;
    completeHapStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function nextPlayerId(state: CompleteHapState) {
  if (state.playMode === 'solo') return state.players[0].id;
  return state.currentPlayerId === state.players[0].id ? state.players[1].id : state.players[0].id;
}

function startTurn(io: IO, state: CompleteHapState, playerId: string) {
  if (state.gameOver) return;
  if (allBoardsCompleted(state)) {
    finishGame(io, state, '세 보드의 모든 결이 선언되었습니다.');
    return;
  }
  clearPhaseTimers(state);
  state.phase = 'turn';
  state.currentPlayerId = playerId;
  state.selectedBoardIndex = null;
  state.turnStartedAt = Date.now();
  state.phaseStartedAt = state.turnStartedAt;
  state.phaseTimer = setTimeout(() => {
    const current = completeHapStates.get(state.roomId);
    if (current !== state || state.gameOver || state.phase !== 'turn') return;
    addRecord(
      state,
      'turn-timeout',
      state.currentPlayerId,
      null,
      null,
      0,
      Date.now() - state.turnStartedAt,
      false,
    );
    advanceTurn(io, state);
  }, CH_TURN_SECONDS * 1000);
  scheduleAi(io, state);
  void broadcastCompleteHapState(io, state);
}

function advanceTurn(io: IO, state: CompleteHapState) {
  const next = nextPlayerId(state);
  state.turn++;
  startTurn(io, state, next);
}

function beginHapCall(io: IO, state: CompleteHapState, boardIndex: number) {
  const board = state.boards[boardIndex];
  if (!board || board.completed || state.phase !== 'turn') return false;
  clearPhaseTimers(state);
  state.phase = 'selecting';
  state.selectedBoardIndex = boardIndex;
  state.phaseStartedAt = Date.now();
  state.phaseTimer = setTimeout(() => {
    const current = completeHapStates.get(state.roomId);
    if (current !== state || state.gameOver || state.phase !== 'selecting') return;
    addRecord(
      state,
      'call-timeout',
      state.currentPlayerId,
      state.selectedBoardIndex,
      null,
      -1,
      Date.now() - state.turnStartedAt,
      false,
    );
    advanceTurn(io, state);
  }, CH_CALL_SECONDS * 1000);
  void broadcastCompleteHapState(io, state);
  return true;
}

function resolveHap(io: IO, state: CompleteHapState, boardIndex: number, indexes: number[]) {
  if (state.phase !== 'selecting' || state.selectedBoardIndex !== boardIndex) return;
  const board = state.boards[boardIndex];
  if (!board || board.completed) return;
  clearPhaseTimers(state);
  const sorted = [...indexes].sort((a, b) => a - b);
  const validIndexes =
    sorted.length === 3 &&
    new Set(sorted).size === 3 &&
    sorted.every((index) => Number.isInteger(index) && index >= 0 && index < board.cards.length);
  const key = validIndexes ? completeHapSetKey(sorted) : '';
  const elapsedMs = Date.now() - state.turnStartedAt;

  if (key && board.claimedSetKeys.has(key)) {
    addRecord(
      state,
      'duplicate-hap',
      state.currentPlayerId,
      boardIndex,
      sorted,
      -1,
      elapsedMs,
      false,
    );
  } else if (key && board.allSetKeys.has(key)) {
    board.claimedSetKeys.add(key);
    board.claimedSets.push(sorted);
    addRecord(
      state,
      'hap',
      state.currentPlayerId,
      boardIndex,
      sorted,
      CH_HAP_SCORE,
      elapsedMs,
      true,
    );
  } else {
    addRecord(state, 'wrong-hap', state.currentPlayerId, boardIndex, sorted, -1, elapsedMs, false);
  }
  advanceTurn(io, state);
}

function resolveGyul(io: IO, state: CompleteHapState, boardIndex: number) {
  const board = state.boards[boardIndex];
  if (!board || board.completed || state.phase !== 'turn') return;
  clearPhaseTimers(state);
  const elapsedMs = Date.now() - state.turnStartedAt;
  if (remainingSets(state, boardIndex).length === 0) {
    board.completed = true;
    addRecord(
      state,
      'gyul',
      state.currentPlayerId,
      boardIndex,
      null,
      CH_GYUL_SCORE,
      elapsedMs,
      true,
    );
  } else {
    addRecord(state, 'wrong-gyul', state.currentPlayerId, boardIndex, null, -1, elapsedMs, false);
  }
  advanceTurn(io, state);
}

function scheduleAi(io: IO, state: CompleteHapState) {
  if (state.playMode !== 'com' || state.currentPlayerId !== AI_PLAYER_ID || state.phase !== 'turn')
    return;
  const turnAtStart = state.turn;
  state.aiTimer = setTimeout(
    () => {
      const current = completeHapStates.get(state.roomId);
      if (
        current !== state ||
        state.gameOver ||
        state.phase !== 'turn' ||
        state.turn !== turnAtStart ||
        state.currentPlayerId !== AI_PLAYER_ID
      )
        return;
      const candidates = activeBoardIndexes(state);
      const boardIndex = candidates[Math.floor(Math.random() * candidates.length)];
      const sets = remainingSets(state, boardIndex);
      if (sets.length === 0) {
        resolveGyul(io, state, boardIndex);
        return;
      }
      if (!beginHapCall(io, state, boardIndex)) return;
      const picked = sets[Math.floor(Math.random() * sets.length)];
      state.aiTimer = setTimeout(
        () => {
          if (
            completeHapStates.get(state.roomId) !== state ||
            state.gameOver ||
            state.phase !== 'selecting' ||
            state.turn !== turnAtStart
          )
            return;
          resolveHap(io, state, boardIndex, picked);
        },
        randomBetween(AI_CALL_MIN_MS, AI_CALL_MAX_MS),
      );
    },
    randomBetween(AI_THINK_MIN_MS, AI_THINK_MAX_MS),
  );
}

export function initCompleteHap(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  _startedAt: number,
  _timeLimitSeconds: number | null,
  endGameCallback: CompleteHapEndGameFn,
) {
  const previous = completeHapStates.get(roomId);
  if (previous) clearCompleteHapTimers(previous);
  completeHapStates.delete(roomId);

  const first = players[0];
  if (!first) throw new Error('컴플릿 결! 합!을 시작할 플레이어가 필요합니다.');
  const second = playMode === 'solo' ? first : players[1];
  if (!second) throw new Error('멀티/COM 모드에는 두 명의 플레이어가 필요합니다.');
  const matchStartedAt = Date.now();
  const state: CompleteHapState = {
    roomId,
    playMode,
    players: [first, second],
    boards: dealCompleteHapBoards(),
    phase: 'turn',
    scores: { [first.id]: 0, [second.id]: 0 },
    correctElapsedMs: { [first.id]: 0, [second.id]: 0 },
    firstCorrectAt: { [first.id]: null, [second.id]: null },
    currentPlayerId: first.id,
    selectedBoardIndex: null,
    turn: 1,
    turnStartedAt: matchStartedAt,
    phaseStartedAt: matchStartedAt,
    matchStartedAt,
    actionLog: [],
    lastAction: null,
    winnerId: null,
    finishReason: null,
    gameOver: false,
    matchTimer: null,
    phaseTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  completeHapStates.set(roomId, state);
  state.matchTimer = setTimeout(() => {
    if (completeHapStates.get(roomId) !== state || state.gameOver) return;
    finishGame(io, state, '10분 제한 시간이 종료되었습니다.');
  }, CH_MATCH_SECONDS * 1000);
  startTurn(io, state, first.id);
}

export function handleCompleteHapAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = completeHapStates.get(roomId);
  if (!state || state.gameOver) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId)) return;
  if (state.currentPlayerId !== playerId || playerId === AI_PLAYER_ID) return;

  const action = rawData as CompleteHapAction;
  const boardIndex = Number(action.boardIndex);
  if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex >= state.boards.length) {
    socket.emit('error', { message: '보드를 다시 선택해 주세요.' });
    return;
  }

  if (action.type === 'call-hap') {
    if (!beginHapCall(io, state, boardIndex)) {
      socket.emit('error', { message: '지금은 합을 외칠 수 없습니다.' });
    }
    return;
  }
  if (action.type === 'submit-hap') {
    const indexes = Array.isArray(action.cardIndexes) ? action.cardIndexes.map(Number) : [];
    resolveHap(io, state, boardIndex, indexes);
    return;
  }
  if (action.type === 'call-gyul') resolveGyul(io, state, boardIndex);
}

export function cleanupCompleteHap(roomId: string) {
  const state = completeHapStates.get(roomId);
  if (state) clearCompleteHapTimers(state);
  completeHapStates.delete(roomId);
}

export function getCompleteHapState(roomId: string) {
  const state = completeHapStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.turn } : undefined;
}

export function getCompleteHapResultData(roomId: string) {
  const state = completeHapStates.get(roomId);
  return state ? toCompleteHapRecord(state) : undefined;
}

export function performCompleteHapUndo(): boolean {
  return false;
}

export function canCompleteHapUndo(): boolean {
  return false;
}

export { emitCompleteHapStateToSocket };
