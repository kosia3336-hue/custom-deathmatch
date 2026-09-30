import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import {
  applyKingmakingAction,
  canMoveKingmakingStack,
  cloneKingmakingBoard,
  createKingmakingBoard,
  isKingmakingPosition,
  kingmakingBoardPositionKey,
} from '@shared/logic/kingmaking.js';
import {
  KM_NORMAL_PIECES,
  type KingmakingAction,
  type KingmakingPiece,
  type KingmakingPieceKind,
  type KingmakingWinType,
} from '@shared/types/kingmaking.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { readReviewActions } from '@shared/review.js';
import { soloReviewSeats } from '../reviewSeat.js';
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
    enumerateKingmakingActions(
      state.board,
      reserveCounts(state.reserves[playerId]),
      playerId,
      state.positionHistory,
    ).length > 0
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
  if (state.reviewing) {
    state.gameOver = true;
    return;
  }
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
  state.turnTimer = scheduleTurnExpiry(io, state, 'turnTimer', () => state.currentPlayerId, () => {
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
    const action = chooseKingmakingAiAction(
      state.board,
      state.reserves,
      AI_PLAYER_ID,
      opponent.id,
      state.positionHistory,
    );
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

function peekPiece(reserve: KingmakingReserve, kind: KingmakingPieceKind) {
  if (kind === 'normal') return reserve.normal.at(-1) ?? null;
  return reserve.special;
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
    return { error: null, placedPiece: peekPiece(reserve, action.kind)! };
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
): boolean {
  if (state.gameOver) return false;
  const validated = validateAndApply(state, actorId, action);
  if (validated.error) {
    socket?.emit('error', { message: validated.error });
    return false;
  }
  const nextBoard = applyKingmakingAction(state.board, action, validated.placedPiece);
  const nextPositionKey = kingmakingBoardPositionKey(nextBoard);
  if (state.positionHistory.has(nextPositionKey)) {
    socket?.emit('error', { message: '이전에 나온 판 배치를 반복할 수 없습니다.' });
    return false;
  }
  /*
    되돌릴 상태는 '아무것도 바꾸기 전' 이어야 한다. takePiece 가 보유 말을 먼저
    꺼내므로 그 아래에서 찍으면 물려도 말이 돌아오지 않는다.
  */
  state.undoStack.push({
    board: cloneKingmakingBoard(state.board),
    positionHistory: [...state.positionHistory],
    reserves: cloneReserves(state.reserves),
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    lastAction: state.lastAction,
    actionLogLength: state.actionLog.length,
  });

  if (action.type === 'place') takePiece(state.reserves[actorId], action.kind);
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.aiTimer = null;

  state.board = nextBoard;
  state.positionHistory.add(nextPositionKey);
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
    return true;
  }
  finishTurn(io, state);
  return true;
}

export function initKingmaking(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: KingmakingEndGameFn,
  gameOptions?: Record<string, unknown>,
) {
  const previous = kingmakingStates.get(roomId);
  if (previous) clearKingmakingTimers(previous);
  const human = players[0];
  const seated = playMode === 'solo' && human && !players[1] ? soloReviewSeats(human) : null;
  const first = seated?.[0] ?? players[0];
  const second = seated?.[1] ?? players[1];
  if (!first || !second) throw new Error('킹메이킹은 두 명의 플레이어가 필요합니다.');
  const board = createKingmakingBoard();
  const now = Date.now();
  const state: KingmakingState = {
    roomId,
    players: [first, second],
    playMode,
    board,
    initialBoard: cloneKingmakingBoard(board),
    positionHistory: new Set([kingmakingBoardPositionKey(board)]),
    undoStack: [],
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
    reviewing: false,
    turnTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  kingmakingStates.set(roomId, state);
  const review = readReviewActions(gameOptions);
  if (!review.ok) {
    kingmakingStates.delete(roomId);
    throw new Error('복기 수순을 읽지 못했습니다.');
  }
  if (review.actions) {
    try {
      replayKingmakingReview(io, state, review.actions);
      /* 불러온 수순은 '시작 판' 이다 — 그보다 앞으로는 무르지 못하게 더미를 비운다(삼층 오목과 동일). */
      state.undoStack = [];
    } catch (error) {
      clearKingmakingTimers(state);
      kingmakingStates.delete(roomId);
      throw error;
    }
  }
  armTurnTimer(io, state);
  void broadcastKingmakingState(io, state);
  scheduleAi(io, state);
}

function replayKingmakingReview(io: IO, state: KingmakingState, actions: unknown[]) {
  const seats = new Map<string, string>();
  state.reviewing = true;
  try {
    for (const raw of actions) {
      if (!raw || typeof raw !== 'object') throw new Error('복기 수순을 읽지 못했습니다.');
      const entry = raw as { actorId?: unknown; action?: KingmakingAction };
      if (typeof entry.actorId !== 'string' || !entry.action || typeof entry.action !== 'object') {
        throw new Error('복기 수순을 읽지 못했습니다.');
      }
      let seat = seats.get(entry.actorId);
      if (!seat) {
        if (seats.size >= 2) throw new Error('복기 수순을 읽지 못했습니다.');
        seat = seats.size === 0 ? state.players[0].id : state.players[1].id;
        seats.set(entry.actorId, seat);
      }
      const ok = applyAction(io, state, seat, entry.action);
      if (!ok || state.gameOver) throw new Error('복기 수순을 적용하지 못했습니다.');
    }
  } finally {
    state.reviewing = false;
  }
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
  if (state.playMode === 'solo') {
    if (actorId !== state.players[0].id) return;
    applyAction(io, state, state.currentPlayerId, rawData as KingmakingAction, socket);
    return;
  }
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

/** 보유 말은 배열·객체라 얕게 복사하면 되돌린 뒤에도 같은 배열을 물고 있다. */
function cloneReserves(
  reserves: KingmakingState['reserves'],
): KingmakingState['reserves'] {
  const next: KingmakingState['reserves'] = {};
  for (const [id, r] of Object.entries(reserves)) {
    next[id] = { normal: [...r.normal], special: r.special };
  }
  return next;
}

/**
 * 되돌릴 지점.
 *
 * COM 과 두는 판에서 한 수만 물리면 바로 COM 차례가 되어 같은 수를 다시 둔다 —
 * 사람 차례가 될 때까지 거슬러 올라간다. 삼층 오목도 같은 방식이다.
 */
function undoTargetIndex(state: KingmakingState) {
  const stack = state.undoStack;
  if (state.playMode !== 'com') return stack.length - 1;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].currentPlayerId !== AI_PLAYER_ID) return index;
  }
  return -1;
}

export function performKingmakingUndo(io: IO, roomId: string) {
  const state = kingmakingStates.get(roomId);
  if (!state || state.gameOver) return false;
  const target = undoTargetIndex(state);
  if (target < 0) return false;
  const snapshot = state.undoStack[target];
  state.undoStack.length = target;

  clearKingmakingTimers(state);
  state.board = cloneKingmakingBoard(snapshot.board);
  state.positionHistory = new Set(snapshot.positionHistory);
  state.reserves = cloneReserves(snapshot.reserves);
  state.currentPlayerId = snapshot.currentPlayerId;
  state.turnNumber = snapshot.turnNumber;
  state.lastAction = snapshot.lastAction;
  state.actionLog.length = snapshot.actionLogLength;
  state.turnStartedAt = Date.now();

  armTurnTimer(io, state);
  void broadcastKingmakingState(io, state);
  scheduleAi(io, state);
  return true;
}

export function canKingmakingUndo(roomId: string) {
  const state = kingmakingStates.get(roomId);
  if (!state || state.gameOver) return false;
  return undoTargetIndex(state) >= 0;
}
export { emitKingmakingStateToSocket };
