import { scheduleTurnExpiry } from '../../gameTurnExpiry.js';
import {
  applyEskimoAction,
  canEskimoMove,
  cloneEskimoBoard,
  createEskimoBoard,
  eskimoPositionKey,
  findEskimoSurround,
  hasEskimoMove,
} from '@shared/logic/eskimo.js';
import {
  ESKIMO_BEAR,
  ESKIMO_BEAR_LOCK_TURNS,
  type EskimoAction,
  type EskimoCell,
  type EskimoWinType,
} from '@shared/types/eskimo.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import {
  broadcastEskimoState,
  clearEskimoTimers,
  emitEskimoStateToSocket,
  eskimoStates,
  toEskimoRecord,
} from './state.js';
import type { EskimoEndGameFn, EskimoState } from './types.js';

const FINISH_DISPLAY_MS = 3000;

const WIN_REASON: Record<EskimoWinType, string> = {
  surround: '북극곰의 사방을 막아',
  repetition: '상대가 이미 나왔던 판을 다시 만들어(반복수)',
  timeout: '상대의 제한시간 초과로',
  'no-move': '상대가 둘 수 있는 수가 없어',
  forfeit: '상대의 기권으로',
};

function otherPlayer(state: EskimoState, playerId: string) {
  return state.players[0].id === playerId ? state.players[1] : state.players[0];
}

function finishGame(
  io: IO,
  state: EskimoState,
  win: { playerId: string; type: EskimoWinType; cells: EskimoCell[] },
) {
  if (state.gameOver) return;
  clearEskimoTimers(state);
  const winner = state.players.find((player) => player.id === win.playerId)!;
  const loser = otherPlayer(state, win.playerId);
  state.gameOver = true;
  state.phase = 'finished';
  state.winnerId = win.playerId;
  state.winType = win.type;
  state.winCells = win.cells;
  state.finishReason = `${WIN_REASON[win.type]} ${winner.nickname} 님이 승리했습니다.`;
  void broadcastEskimoState(io, state);

  const payload = {
    rankings: [
      { playerId: winner.id, nickname: winner.nickname, rank: 1, score: 1 },
      { playerId: loser.id, nickname: loser.nickname, rank: 2, score: 0 },
    ],
    totalTurns: state.actionLog.length,
    gameResultData: toEskimoRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (eskimoStates.get(state.roomId) !== state) return;
    eskimoStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function armTurnTimer(io: IO, state: EskimoState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (!state.timeLimitSeconds || state.gameOver) return;
  state.turnTimer = scheduleTurnExpiry(
    io,
    state,
    'turnTimer',
    () => state.currentPlayerId,
    () => {
      if (eskimoStates.get(state.roomId) !== state || state.gameOver) return;
      finishGame(io, state, {
        playerId: otherPlayer(state, state.currentPlayerId).id,
        type: 'timeout',
        cells: [],
      });
    },
    state.timeLimitSeconds * 1000,
  );
}

/** 다음 차례로 넘긴다. 넘겨받은 쪽이 둘 수가 하나도 없으면 그대로 진다. */
function passTurnTo(io: IO, state: EskimoState, playerId: string) {
  state.currentPlayerId = playerId;
  state.turnNumber += 1;
  state.turnStartedAt = Date.now();
  if (!hasEskimoMove(state.board, playerId, state.bearLockTurns > 0)) {
    finishGame(io, state, {
      playerId: otherPlayer(state, playerId).id,
      type: 'no-move',
      cells: [],
    });
    return;
  }
  armTurnTimer(io, state);
  void broadcastEskimoState(io, state);
}

function validate(state: EskimoState, actorId: string, action: EskimoAction): string | null {
  if (actorId !== state.currentPlayerId) return '상대 턴입니다.';
  if (!action || action.type !== 'move') return '알 수 없는 행동입니다.';
  if (canEskimoMove(state.board, action, actorId, state.bearLockTurns > 0)) return null;
  const piece =
    action.from && Number.isInteger(action.from.row) && Number.isInteger(action.from.col)
      ? state.board[action.from.row]?.[action.from.col]
      : undefined;
  if (piece === ESKIMO_BEAR && state.bearLockTurns > 0) {
    return `북극곰은 ${state.bearLockTurns}턴 뒤에 옮길 수 있습니다.`;
  }
  return '그 칸으로는 옮길 수 없습니다.';
}

function applyAction(
  io: IO,
  state: EskimoState,
  actorId: string,
  action: EskimoAction,
  socket?: TypedSocket,
): boolean {
  if (state.gameOver) return false;
  const error = validate(state, actorId, action);
  if (error) {
    socket?.emit('error', { message: error });
    return false;
  }
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;

  state.undoStack.push({
    board: cloneEskimoBoard(state.board),
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    bearLockTurns: state.bearLockTurns,
    lastAction: state.lastAction,
    actionLogLength: state.actionLog.length,
    positionCount: state.positions.length,
  });
  const movedBear = state.board[action.from.row][action.from.col] === ESKIMO_BEAR;
  const clean: EskimoAction = {
    type: 'move',
    from: { row: action.from.row, col: action.from.col },
    to: { row: action.to.row, col: action.to.col },
  };
  state.board = applyEskimoAction(state.board, clean);
  // 이번 수로 북극곰을 옮겼으면 다음 네 턴을 잠그고, 아니면 잠긴 턴 하나를 소화한다
  state.bearLockTurns = movedBear ? ESKIMO_BEAR_LOCK_TURNS : Math.max(0, state.bearLockTurns - 1);
  const entry = { turn: state.turnNumber, actorId, action: clean, bear: movedBear };
  state.lastAction = entry;
  state.actionLog.push(entry);

  const opponent = otherPlayer(state, actorId);
  // 반복수는 금지 수라 포위보다 먼저 본다 — 반복수로 포위를 만들어도 반칙패다
  const key = eskimoPositionKey(state.board, state.firstPlayerId);
  if (state.positions.includes(key)) {
    finishGame(io, state, { playerId: opponent.id, type: 'repetition', cells: [] });
    return true;
  }
  state.positions.push(key);

  const surround = findEskimoSurround(state.board);
  if (surround) {
    finishGame(io, state, { playerId: actorId, type: 'surround', cells: surround });
    return true;
  }

  passTurnTo(io, state, opponent.id);
  return !state.gameOver;
}

export function initEskimo(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EskimoEndGameFn,
) {
  const previous = eskimoStates.get(roomId);
  if (previous) clearEskimoTimers(previous);
  const [first, second] = players;
  if (!first || !second) throw new Error('에스키모는 두 명의 플레이어가 필요합니다.');
  const board = createEskimoBoard(first.id, second.id);
  const state: EskimoState = {
    roomId,
    players: [first, second],
    playMode,
    board,
    currentPlayerId: first.id,
    firstPlayerId: first.id,
    phase: 'playing',
    turnNumber: 1,
    bearLockTurns: 0,
    positions: [eskimoPositionKey(board, first.id)],
    actionLog: [],
    undoStack: [],
    lastAction: null,
    winnerId: null,
    winType: null,
    winCells: [],
    finishReason: null,
    gameOver: false,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds: timeLimitSeconds != null && timeLimitSeconds > 0 ? timeLimitSeconds : null,
    turnTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  eskimoStates.set(roomId, state);
  armTurnTimer(io, state);
  void broadcastEskimoState(io, state);
}

export function handleEskimoAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = eskimoStates.get(roomId);
  if (!state || state.gameOver) return;
  const actorId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === actorId)) return;
  applyAction(io, state, actorId, rawData as unknown as EskimoAction, socket);
}

export function cleanupEskimo(roomId: string) {
  const state = eskimoStates.get(roomId);
  if (state) clearEskimoTimers(state);
  eskimoStates.delete(roomId);
}

export function getEskimoState(roomId: string) {
  const state = eskimoStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.actionLog.length } : undefined;
}

export function getEskimoResultData(roomId: string) {
  const state = eskimoStates.get(roomId);
  return state ? toEskimoRecord(state) : undefined;
}

/** 1:1 무르기는 마지막 한 수를 되돌린다(상대 동의는 방 쪽에서 받는다). */
export function performEskimoUndo(io: IO, roomId: string) {
  const state = eskimoStates.get(roomId);
  if (!state || state.gameOver) return false;
  const snapshot = state.undoStack.pop();
  if (!snapshot) return false;

  clearEskimoTimers(state);
  state.board = cloneEskimoBoard(snapshot.board);
  state.currentPlayerId = snapshot.currentPlayerId;
  state.turnNumber = snapshot.turnNumber;
  state.bearLockTurns = snapshot.bearLockTurns;
  state.lastAction = snapshot.lastAction;
  state.actionLog.length = snapshot.actionLogLength;
  state.positions.length = snapshot.positionCount;
  state.turnStartedAt = Date.now();

  armTurnTimer(io, state);
  void broadcastEskimoState(io, state);
  return true;
}

export function canEskimoUndo(roomId: string) {
  const state = eskimoStates.get(roomId);
  return Boolean(state && !state.gameOver && state.undoStack.length > 0);
}

export { emitEskimoStateToSocket };
