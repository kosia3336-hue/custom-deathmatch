/** 사각목 — 서버 모듈. 규칙은 shared/types/square-mok.ts, 판정은 shared/logic/square-mok.ts */
import { scheduleTurnExpiry } from '../../gameTurnExpiry.js';
import {
  SQUARE_MOK_DECIDER_LABEL,
  applySquareMokPlacement,
  canPlaceSquareMok,
  cloneSquareMokBoard,
  createSquareMokBoard,
  decideSquareMok,
  squareMokEmptyCount,
  squareMokQuota,
} from '@shared/logic/square-mok.js';
import type { SquareMokAction } from '@shared/types/square-mok.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import {
  broadcastSquareMokState,
  clearSquareMokTimers,
  emitSquareMokStateToSocket,
  squareMokScores,
  squareMokStates,
  toSquareMokRecord,
} from './state.js';
import type { SquareMokEndGameFn, SquareMokState } from './types.js';

const FINISH_DISPLAY_MS = 4000;

function otherPlayer(state: SquareMokState, playerId: string) {
  return state.players[0].id === playerId ? state.players[1] : state.players[0];
}

/** 판이 다 찼다 — 승점과 동점 규칙으로 가린다 */
function finishGame(io: IO, state: SquareMokState) {
  if (state.gameOver) return;
  clearSquareMokTimers(state);
  const [first, second] = state.players;
  const scores = squareMokScores(state);
  const { winnerId, decider } = decideSquareMok(scores, first.id, second.id);
  state.gameOver = true;
  state.phase = 'finished';
  state.winnerId = winnerId;
  state.decider = decider;
  const pointsText = `${first.nickname} ${scores[first.id].points}점 · ${second.nickname} ${scores[second.id].points}점`;
  state.finishReason = winnerId
    ? `${SQUARE_MOK_DECIDER_LABEL[decider]} ${state.players.find((p) => p.id === winnerId)!.nickname} 님이 승리했습니다. (${pointsText})`
    : `${SQUARE_MOK_DECIDER_LABEL.draw} 무승부입니다. (${pointsText})`;
  void broadcastSquareMokState(io, state);

  const rankings = winnerId
    ? [
        {
          playerId: winnerId,
          nickname: state.players.find((p) => p.id === winnerId)!.nickname,
          rank: 1,
          score: scores[winnerId].points,
        },
        {
          playerId: otherPlayer(state, winnerId).id,
          nickname: otherPlayer(state, winnerId).nickname,
          rank: 2,
          score: scores[otherPlayer(state, winnerId).id].points,
        },
      ]
    : state.players.map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        rank: 1,
        score: scores[p.id].points,
      }));
  const payload = {
    rankings,
    totalTurns: state.history.length,
    gameResultData: toSquareMokRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (squareMokStates.get(state.roomId) !== state) return;
    squareMokStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function armTurnTimer(io: IO, state: SquareMokState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (!state.timeLimitSeconds || state.gameOver) return;
  state.turnTimer = scheduleTurnExpiry(
    io,
    state,
    'turnTimer',
    () => state.currentPlayerId,
    // 시간 초과 판정(랭크는 즉시 패배, 일반 방은 상대가 계속·종료 선택)은 공통 처리가 한다
    () => {},
    state.timeLimitSeconds * 1000,
  );
}

function applyAction(
  io: IO,
  state: SquareMokState,
  actorId: string,
  action: SquareMokAction,
  socket?: TypedSocket,
) {
  if (state.gameOver) return false;
  if (actorId !== state.currentPlayerId) {
    socket?.emit('error', { message: '상대 차례입니다.' });
    return false;
  }
  const quota = squareMokQuota(state.turnNumber, state.board);
  if (!action || action.type !== 'place' || !canPlaceSquareMok(state.board, action.cells, quota)) {
    socket?.emit('error', { message: `빈칸 ${quota}곳을 골라 놓아 주세요.` });
    return false;
  }
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;

  state.undoStack.push({
    board: cloneSquareMokBoard(state.board),
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    historyLength: state.history.length,
  });
  const cells = action.cells.map((cell) => ({ row: cell.row, col: cell.col }));
  state.board = applySquareMokPlacement(state.board, cells, actorId);
  state.history.push({ turn: state.turnNumber, actorId, cells });

  if (squareMokEmptyCount(state.board) === 0) {
    finishGame(io, state);
    return true;
  }
  state.currentPlayerId = otherPlayer(state, actorId).id;
  state.turnNumber += 1;
  state.turnStartedAt = Date.now();
  armTurnTimer(io, state);
  void broadcastSquareMokState(io, state);
  return true;
}

export function initSquareMok(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: SquareMokEndGameFn,
) {
  const previous = squareMokStates.get(roomId);
  if (previous) clearSquareMokTimers(previous);
  const [first, second] = players;
  if (!first || !second) throw new Error('사각목은 두 명의 플레이어가 필요합니다.');
  const state: SquareMokState = {
    roomId,
    players: [first, second],
    playMode,
    board: createSquareMokBoard(),
    currentPlayerId: first.id,
    firstPlayerId: first.id,
    phase: 'playing',
    turnNumber: 1,
    history: [],
    undoStack: [],
    winnerId: null,
    decider: null,
    finishReason: null,
    gameOver: false,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds: timeLimitSeconds != null && timeLimitSeconds > 0 ? timeLimitSeconds : null,
    turnTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  squareMokStates.set(roomId, state);
  armTurnTimer(io, state);
  void broadcastSquareMokState(io, state);
}

export function handleSquareMokAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = squareMokStates.get(roomId);
  if (!state || state.gameOver) return;
  const actorId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === actorId)) return;
  applyAction(io, state, actorId, rawData as unknown as SquareMokAction, socket);
}

export function cleanupSquareMok(roomId: string) {
  const state = squareMokStates.get(roomId);
  if (state) clearSquareMokTimers(state);
  squareMokStates.delete(roomId);
}

export function getSquareMokState(roomId: string) {
  const state = squareMokStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.history.length } : undefined;
}

export function getSquareMokResultData(roomId: string) {
  const state = squareMokStates.get(roomId);
  return state ? toSquareMokRecord(state) : undefined;
}

/** 1:1 은 마지막 한 차례를 무른다(상대 동의는 방 쪽에서 받는다). */
export function performSquareMokUndo(io: IO, roomId: string) {
  const state = squareMokStates.get(roomId);
  if (!state || state.gameOver) return false;
  const snapshot = state.undoStack.pop();
  if (!snapshot) return false;
  clearSquareMokTimers(state);
  state.board = cloneSquareMokBoard(snapshot.board);
  state.currentPlayerId = snapshot.currentPlayerId;
  state.turnNumber = snapshot.turnNumber;
  state.history.length = snapshot.historyLength;
  state.turnStartedAt = Date.now();
  armTurnTimer(io, state);
  void broadcastSquareMokState(io, state);
  return true;
}

export function canSquareMokUndo(roomId: string) {
  const state = squareMokStates.get(roomId);
  return Boolean(state && !state.gameOver && state.undoStack.length > 0);
}

export { emitSquareMokStateToSocket };
