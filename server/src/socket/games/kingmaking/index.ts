import {
  applyKingmakingAction,
  canMoveKingmakingStack,
  cloneKingmakingBoard,
  createKingmakingBoard,
  isKingmakingPosition,
} from '@shared/logic/kingmaking.js';
import {
  KM_NORMAL_PIECES,
  type KingmakingAction,
  type KingmakingPiece,
  type KingmakingPieceKind,
  type KingmakingWinType,
} from '@shared/types/kingmaking.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { chooseKingmakingAiAction, enumerateKingmakingActions } from './ai.js';
import {
  broadcastKingmakingState,
  clearKingmakingTimers,
  emitKingmakingStateToSocket,
  kingmakingStates,
  toKingmakingRecord,
} from './state.js';
import type { KingmakingEndGameFn, KingmakingReserve, KingmakingState } from './types.js';

const AI_DELAY_MS = 900;
const FINISH_DISPLAY_MS = 2500;

function createReserve(playerId: string): KingmakingReserve {
  return {
    normal: Array.from({ length: KM_NORMAL_PIECES }, (_, index) => ({
      id: `${playerId}:normal:${index + 1}`,
      ownerId: playerId,
      kind: 'normal' as const,
    })),
    special: { id: `${playerId}:special`, ownerId: playerId, kind: 'special' },
  };
}

function otherPlayer(state: KingmakingState, playerId: string) {
  return state.players[0].id === playerId ? state.players[1] : state.players[0];
}

function reserveCounts(reserve: KingmakingReserve) {
  return { normal: reserve.normal.length, special: reserve.special ? 1 : 0 };
}

function hasAnyAction(state: KingmakingState, playerId: string) {
  return (
    enumerateKingmakingActions(state.board, reserveCounts(state.reserves[playerId])).length > 0
  );
}

function formatFinishReason(state: KingmakingState, winnerId: string, winType: KingmakingWinType) {
  const nickname = state.players.find((player) => player.id === winnerId)?.nickname ?? '플레이어';
  if (winType === 'six-stack') return `6층 탑의 맨 위 말을 차지한 ${nickname} 님이 승리했습니다.`;
  if (winType === 'timeout') return `상대의 제한시간 초과로 ${nickname} 님이 승리했습니다.`;
  return `상대가 행동할 수 없어 ${nickname} 님이 승리했습니다.`;
}

function finishGame(io: IO, state: KingmakingState, winnerId: string, winType: KingmakingWinType) {
  if (state.gameOver) return;
  clearKingmakingTimers(state);
  state.gameOver = true;
  state.winnerId = winnerId;
  state.winType = winType;
  state.finishReason = formatFinishReason(state, winnerId, winType);
  void broadcastKingmakingState(io, state);

  const winner = state.players.find((player) => player.id === winnerId)!;
  const loser = otherPlayer(state, winnerId);
  const payload = {
    rankings: [
      { playerId: winner.id, nickname: winner.nickname, rank: 1, score: 1 },
      { playerId: loser.id, nickname: loser.nickname, rank: 2, score: 0 },
    ],
    totalTurns: state.actionLog.length,
    gameResultData: toKingmakingRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (kingmakingStates.get(state.roomId) !== state) return;
    kingmakingStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function armTurnTimer(io: IO, state: KingmakingState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (!state.timeLimitSeconds || state.currentPlayerId === AI_PLAYER_ID || state.gameOver) return;
  state.turnTimer = setTimeout(() => {
    if (kingmakingStates.get(state.roomId) !== state || state.gameOver) return;
    finishGame(io, state, otherPlayer(state, state.currentPlayerId).id, 'timeout');
  }, state.timeLimitSeconds * 1000);
}

function scheduleAi(io: IO, state: KingmakingState) {
  if (state.playMode !== 'com' || state.currentPlayerId !== AI_PLAYER_ID || state.gameOver) {
    return;
  }
  state.aiTimer = setTimeout(() => {
    if (
      kingmakingStates.get(state.roomId) !== state ||
      state.gameOver ||
      state.currentPlayerId !== AI_PLAYER_ID
    ) {
      return;
    }
    const opponent = otherPlayer(state, AI_PLAYER_ID);
    const action = chooseKingmakingAiAction(state.board, state.reserves, AI_PLAYER_ID, opponent.id);
    if (!action) {
      finishGame(io, state, opponent.id, 'no-action');
      return;
    }
    applyAction(io, state, AI_PLAYER_ID, action);
  }, AI_DELAY_MS);
}

function finishTurn(io: IO, state: KingmakingState) {
  state.currentPlayerId = otherPlayer(state, state.currentPlayerId).id;
  state.turnNumber += 1;
  state.turnStartedAt = Date.now();
  if (!hasAnyAction(state, state.currentPlayerId)) {
    finishGame(io, state, otherPlayer(state, state.currentPlayerId).id, 'no-action');
    return;
  }
  armTurnTimer(io, state);
  void broadcastKingmakingState(io, state);
  scheduleAi(io, state);
}

function takePiece(reserve: KingmakingReserve, kind: KingmakingPieceKind) {
  if (kind === 'normal') return reserve.normal.pop() ?? null;
  const piece = reserve.special;
  reserve.special = null;
  return piece;
}

function validateAndApply(
  state: KingmakingState,
  actorId: string,
  action: KingmakingAction,
): { error: string | null; placedPiece?: KingmakingPiece } {
  if (actorId !== state.currentPlayerId) return { error: '상대 턴입니다.' };
  if (action.type === 'place') {
    if (!isKingmakingPosition(action.to)) return { error: '보드 밖에는 말을 놓을 수 없습니다.' };
    if (action.kind !== 'normal' && action.kind !== 'special')
      return { error: '올바르지 않은 말입니다.' };
    if (state.board[action.to.row][action.to.col].length > 0) {
      return { error: '빈칸에만 새 말을 놓을 수 있습니다.' };
    }
    const reserve = state.reserves[actorId];
    const available =
      action.kind === 'normal' ? reserve.normal.length > 0 : Boolean(reserve.special);
    if (!available) return { error: '남은 말이 없습니다.' };
    return { error: null, placedPiece: takePiece(reserve, action.kind)! };
  }
  if (!isKingmakingPosition(action.from) || !isKingmakingPosition(action.to)) {
    return { error: '올바르지 않은 위치입니다.' };
  }
  if (!Number.isInteger(action.count)) return { error: '이동할 층수를 선택해 주세요.' };
  if (!canMoveKingmakingStack(state.board, action.from, action.to, action.count)) {
    return { error: '선택한 층수로 해당 탑 위에 이동할 수 없습니다.' };
  }
  return { error: null };
}

function applyAction(
  io: IO,
  state: KingmakingState,
  actorId: string,
  action: KingmakingAction,
  socket?: TypedSocket,
) {
  if (state.gameOver) return;
  const validated = validateAndApply(state, actorId, action);
  if (validated.error) {
    socket?.emit('error', { message: validated.error });
    return;
  }
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.aiTimer = null;

  state.board = applyKingmakingAction(state.board, action, validated.placedPiece);
  const target = state.board[action.to.row][action.to.col];
  const winnerId = target.length === 6 ? (target.at(-1)?.ownerId ?? null) : null;
  const logEntry = {
    turn: state.turnNumber,
    actorId,
    action,
    winnerId,
  } satisfies KingmakingState['lastAction'];
  state.lastAction = logEntry;
  state.actionLog.push(logEntry);
  if (winnerId) {
    finishGame(io, state, winnerId, 'six-stack');
    return;
  }
  finishTurn(io, state);
}

export function initKingmaking(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: KingmakingEndGameFn,
) {
  const previous = kingmakingStates.get(roomId);
  if (previous) clearKingmakingTimers(previous);
  const first = players[0];
  const second = players[1];
  if (!first || !second) throw new Error('킹메이킹은 두 명의 플레이어가 필요합니다.');
  const board = createKingmakingBoard();
  const now = Date.now();
  const state: KingmakingState = {
    roomId,
    players: [first, second],
    playMode,
    board,
    initialBoard: cloneKingmakingBoard(board),
    reserves: { [first.id]: createReserve(first.id), [second.id]: createReserve(second.id) },
    currentPlayerId: first.id,
    firstPlayerId: first.id,
    turnNumber: 1,
    startedAt,
    turnStartedAt: now,
    timeLimitSeconds,
    actionLog: [],
    lastAction: null,
    winnerId: null,
    winType: null,
    finishReason: null,
    gameOver: false,
    turnTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  kingmakingStates.set(roomId, state);
  armTurnTimer(io, state);
  void broadcastKingmakingState(io, state);
  scheduleAi(io, state);
}

export function handleKingmakingAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = kingmakingStates.get(roomId);
  if (!state || state.gameOver) return;
  const actorId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === actorId) || actorId === AI_PLAYER_ID) return;
  applyAction(io, state, actorId, rawData as KingmakingAction, socket);
}

export function cleanupKingmaking(roomId: string) {
  const state = kingmakingStates.get(roomId);
  if (state) clearKingmakingTimers(state);
  kingmakingStates.delete(roomId);
}

export function getKingmakingState(roomId: string) {
  const state = kingmakingStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.actionLog.length } : undefined;
}

export function getKingmakingResultData(roomId: string) {
  const state = kingmakingStates.get(roomId);
  return state ? toKingmakingRecord(state) : undefined;
}

export function performKingmakingUndo() {
  return false;
}
export function canKingmakingUndo() {
  return false;
}
export { emitKingmakingStateToSocket };
