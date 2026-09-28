import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import {
  applyTripleGomokuAction,
  cloneTripleGomokuBoard,
  canMoveTripleGomokuStone,
  canPlaceTripleGomokuSetup,
  canPlaceTripleGomokuStone,
  findTripleGomokuWin,
  isTripleGomokuCell,
} from '@shared/logic/triple-gomoku.js';
import { resolveAbstractAiDifficulty } from '@shared/types/game.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { readReviewActions } from '@shared/review.js';
import { soloReviewSeats } from '../reviewSeat.js';
import {
  TG_SETUP_SEQUENCE,
  TG_STONES_PER_PLAYER,
  type TripleGomokuAction,
  type TripleGomokuWin,
  type TripleGomokuWinType,
} from '@shared/types/triple-gomoku.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { chooseTripleGomokuAiAction, enumerateTripleGomokuActions } from './ai.js';
import {
  broadcastTripleGomokuState,
  clearTripleGomokuTimers,
  emitTripleGomokuStateToSocket,
  toTripleGomokuRecord,
  tripleGomokuStates,
} from './state.js';
import type { TripleGomokuEndGameFn, TripleGomokuState } from './types.js';

const AI_DELAY_MS = 850;
const FINISH_DISPLAY_MS = 3000;

const WIN_REASON: Record<TripleGomokuWinType, string> = {
  line: '돌 다섯 개를 일직선으로 이어',
  'top-count': '3층 돌 다섯 개를 만들어',
  'top-cluster': '서로 붙은 3층 돌 세 개를 만들어',
  timeout: '상대의 제한시간 초과로',
  'no-action': '상대가 둘 수 없어',
  forfeit: '상대의 기권으로',
};

function otherPlayer(state: TripleGomokuState, playerId: string) {
  return state.players[0].id === playerId ? state.players[1] : state.players[0];
}

/** 기본 배치 턴 순서. 짝수 번째 턴은 선, 홀수 번째 턴은 후 플레이어다. */
function setupPlayerAt(state: TripleGomokuState, index: number) {
  const [first, second] = state.players;
  return index % 2 === 0 ? first.id : second.id;
}

function hasAnyAction(state: TripleGomokuState, playerId: string) {
  return (
    enumerateTripleGomokuActions(state.board, playerId, {
      phase: state.phase === 'setup' ? 'setup' : 'playing',
      reserve: state.reserves[playerId] ?? 0,
    }).length > 0
  );
}

function finishGame(
  io: IO,
  state: TripleGomokuState,
  win: { playerId: string; type: TripleGomokuWinType; cells: TripleGomokuWin['cells'] },
) {
  if (state.gameOver) return;
  if (state.reviewing) {
    state.gameOver = true;
    return;
  }
  clearTripleGomokuTimers(state);
  const nickname =
    state.players.find((player) => player.id === win.playerId)?.nickname ?? '플레이어';
  state.gameOver = true;
  state.phase = 'finished';
  state.winnerId = win.playerId;
  state.winType = win.type;
  state.winCells = win.cells;
  state.finishReason = `${WIN_REASON[win.type]} ${nickname} 님이 승리했습니다.`;
  void broadcastTripleGomokuState(io, state);

  const winner = state.players.find((player) => player.id === win.playerId)!;
  const loser = otherPlayer(state, win.playerId);
  const payload = {
    rankings: [
      { playerId: winner.id, nickname: winner.nickname, rank: 1, score: 1 },
      { playerId: loser.id, nickname: loser.nickname, rank: 2, score: 0 },
    ],
    totalTurns: state.actionLog.length,
    gameResultData: toTripleGomokuRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (tripleGomokuStates.get(state.roomId) !== state) return;
    tripleGomokuStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function armTurnTimer(io: IO, state: TripleGomokuState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (!state.timeLimitSeconds || state.gameOver) return;
  if (state.currentPlayerId === AI_PLAYER_ID) return;
  state.turnTimer = scheduleTurnExpiry(io, state, 'turnTimer', () => state.currentPlayerId, () => {
    if (tripleGomokuStates.get(state.roomId) !== state || state.gameOver) return;
    finishGame(io, state, {
      playerId: otherPlayer(state, state.currentPlayerId).id,
      type: 'timeout',
      cells: [],
    });
  }, state.timeLimitSeconds * 1000);
}

function scheduleAi(io: IO, state: TripleGomokuState) {
  if (state.playMode !== 'com' || state.gameOver) return;
  if (state.currentPlayerId !== AI_PLAYER_ID) return;
  state.aiTimer = setTimeout(() => {
    if (
      tripleGomokuStates.get(state.roomId) !== state ||
      state.gameOver ||
      state.currentPlayerId !== AI_PLAYER_ID
    ) {
      return;
    }
    const opponent = otherPlayer(state, AI_PLAYER_ID);
    const action = chooseTripleGomokuAiAction({
      board: state.board,
      playerId: AI_PLAYER_ID,
      opponentId: opponent.id,
      phase: state.phase === 'setup' ? 'setup' : 'playing',
      reserve: state.reserves[AI_PLAYER_ID] ?? 0,
      opponentReserve: state.reserves[opponent.id] ?? 0,
      difficulty: state.aiDifficulty,
    });
    if (!action) {
      finishGame(io, state, { playerId: opponent.id, type: 'no-action', cells: [] });
      return;
    }
    applyAction(io, state, AI_PLAYER_ID, action);
  }, AI_DELAY_MS);
}

/** 다음 차례로 넘긴다. 넘겨받은 쪽이 둘 곳이 없으면 그대로 진다. */
function passTurnTo(io: IO, state: TripleGomokuState, playerId: string) {
  state.currentPlayerId = playerId;
  state.turnNumber += 1;
  state.turnStartedAt = Date.now();
  if (!hasAnyAction(state, playerId)) {
    finishGame(io, state, {
      playerId: otherPlayer(state, playerId).id,
      type: 'no-action',
      cells: [],
    });
    return;
  }
  armTurnTimer(io, state);
  void broadcastTripleGomokuState(io, state);
  scheduleAi(io, state);
}

/** 기본 배치 한 개를 소화한 뒤 남은 개수·턴·단계를 갱신한다. */
function advanceSetup(io: IO, state: TripleGomokuState) {
  state.setupRemaining -= 1;
  if (state.setupRemaining > 0) {
    state.turnStartedAt = Date.now();
    armTurnTimer(io, state);
    void broadcastTripleGomokuState(io, state);
    scheduleAi(io, state);
    return;
  }
  state.setupTurnIndex += 1;
  if (state.setupTurnIndex >= TG_SETUP_SEQUENCE.length) {
    state.phase = 'playing';
    state.setupRemaining = 0;
    passTurnTo(io, state, state.firstPlayerId);
    return;
  }
  state.setupRemaining = TG_SETUP_SEQUENCE[state.setupTurnIndex];
  passTurnTo(io, state, setupPlayerAt(state, state.setupTurnIndex));
}

function validate(
  state: TripleGomokuState,
  actorId: string,
  action: TripleGomokuAction,
): string | null {
  if (actorId !== state.currentPlayerId) return '상대 턴입니다.';
  if (action.type === 'place') {
    if (!isTripleGomokuCell(action.to)) return '판 밖에는 돌을 놓을 수 없습니다.';
    if ((state.reserves[actorId] ?? 0) <= 0) return '남은 돌이 없습니다.';
    if (state.phase === 'setup') {
      if (!canPlaceTripleGomokuSetup(state.board, action.to, actorId)) {
        return '기본 배치에서는 정중앙과 자기 돌 옆에 놓을 수 없습니다.';
      }
      return null;
    }
    if (!canPlaceTripleGomokuStone(state.board, action.to)) return '빈칸에만 놓을 수 있습니다.';
    return null;
  }
  if (action.type !== 'move') return '알 수 없는 행동입니다.';
  if (state.phase === 'setup') return '기본 배치에서는 돌을 옮길 수 없습니다.';
  if (!isTripleGomokuCell(action.from) || !isTripleGomokuCell(action.to)) {
    return '올바르지 않은 위치입니다.';
  }
  if (!canMoveTripleGomokuStone(state.board, action.from, action.to, actorId)) {
    return '그 칸으로는 옮길 수 없습니다.';
  }
  return null;
}

function applyAction(
  io: IO,
  state: TripleGomokuState,
  actorId: string,
  action: TripleGomokuAction,
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
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.aiTimer = null;

  state.undoStack.push({
    board: cloneTripleGomokuBoard(state.board),
    reserves: { ...state.reserves },
    currentPlayerId: state.currentPlayerId,
    phase: state.phase,
    turnNumber: state.turnNumber,
    setupTurnIndex: state.setupTurnIndex,
    setupRemaining: state.setupRemaining,
    lastAction: state.lastAction,
    actionLogLength: state.actionLog.length,
  });
  state.board = applyTripleGomokuAction(state.board, action, actorId);
  if (action.type === 'place') state.reserves[actorId] = (state.reserves[actorId] ?? 0) - 1;
  const entry = { turn: state.turnNumber, actorId, action };
  state.lastAction = entry;
  state.actionLog.push(entry);

  // 행동한 쪽을 먼저 본다. 같은 수에 양쪽 조건이 동시에 서면 행동한 쪽이 이긴다.
  const opponent = otherPlayer(state, actorId);
  const actorWin = findTripleGomokuWin(state.board, actorId);
  if (actorWin) {
    finishGame(io, state, actorWin);
    return true;
  }
  const opponentWin = findTripleGomokuWin(state.board, opponent.id);
  if (opponentWin) {
    finishGame(io, state, opponentWin);
    return true;
  }

  if (state.phase === 'setup') {
    advanceSetup(io, state);
    return !state.gameOver;
  }
  passTurnTo(io, state, opponent.id);
  return !state.gameOver;
}

export function initTripleGomoku(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: TripleGomokuEndGameFn,
  gameOptions: Record<string, unknown> = {},
) {
  const previous = tripleGomokuStates.get(roomId);
  if (previous) clearTripleGomokuTimers(previous);
  const human = players[0];
  const seated = playMode === 'solo' && human && !players[1] ? soloReviewSeats(human) : null;
  const first = seated?.[0] ?? players[0];
  const second = seated?.[1] ?? players[1];
  if (!first || !second) throw new Error('삼층 오목은 두 명의 플레이어가 필요합니다.');
  const now = Date.now();
  const state: TripleGomokuState = {
    roomId,
    players: [first, second],
    playMode,
    aiDifficulty: resolveAbstractAiDifficulty(gameOptions.aiDifficulty),
    board: {},
    reserves: { [first.id]: TG_STONES_PER_PLAYER, [second.id]: TG_STONES_PER_PLAYER },
    currentPlayerId: first.id,
    firstPlayerId: first.id,
    phase: 'setup',
    turnNumber: 1,
    setupTurnIndex: 0,
    setupRemaining: TG_SETUP_SEQUENCE[0],
    actionLog: [],
    undoStack: [],
    lastAction: null,
    winnerId: null,
    winType: null,
    winCells: [],
    finishReason: null,
    gameOver: false,
    reviewing: false,
    startedAt,
    turnStartedAt: now,
    timeLimitSeconds,
    turnTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  tripleGomokuStates.set(roomId, state);
  const review = readReviewActions(gameOptions);
  if (!review.ok) {
    tripleGomokuStates.delete(roomId);
    throw new Error('복기 수순을 읽지 못했습니다.');
  }
  if (review.actions) {
    try {
      replayTripleGomokuReview(io, state, review.actions);
      state.undoStack = [];
    } catch (error) {
      clearTripleGomokuTimers(state);
      tripleGomokuStates.delete(roomId);
      throw error;
    }
  }
  armTurnTimer(io, state);
  void broadcastTripleGomokuState(io, state);
  scheduleAi(io, state);
}

function replayTripleGomokuReview(io: IO, state: TripleGomokuState, actions: unknown[]) {
  const seats = new Map<string, string>();
  state.reviewing = true;
  try {
    for (const raw of actions) {
      if (!raw || typeof raw !== 'object') throw new Error('복기 수순을 읽지 못했습니다.');
      const entry = raw as { actorId?: unknown; action?: TripleGomokuAction };
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

export function handleTripleGomokuAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = tripleGomokuStates.get(roomId);
  if (!state || state.gameOver) return;
  const actorId = sessions.getToken(socket.id) ?? socket.id;
  if (state.playMode === 'solo') {
    if (actorId !== state.players[0].id) return;
    applyAction(io, state, state.currentPlayerId, rawData as TripleGomokuAction, socket);
    return;
  }
  if (!state.players.some((player) => player.id === actorId) || actorId === AI_PLAYER_ID) return;
  applyAction(io, state, actorId, rawData as TripleGomokuAction, socket);
}

export function cleanupTripleGomoku(roomId: string) {
  const state = tripleGomokuStates.get(roomId);
  if (state) clearTripleGomokuTimers(state);
  tripleGomokuStates.delete(roomId);
}

export function getTripleGomokuState(roomId: string) {
  const state = tripleGomokuStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.actionLog.length } : undefined;
}

export function getTripleGomokuResultData(roomId: string) {
  const state = tripleGomokuStates.get(roomId);
  return state ? toTripleGomokuRecord(state) : undefined;
}

/**
 * 되돌아갈 스냅숏 위치. -1 이면 무를 수 없다.
 * 1:1 은 마지막 행동 하나(기본 배치에서 두 개를 놓는 턴도 한 개씩)를 되돌린다.
 * COM 판은 사람 차례가 될 때까지 되돌려 COM 의 수와 내 수를 함께 무른다.
 */
function undoTargetIndex(state: TripleGomokuState) {
  const stack = state.undoStack;
  if (state.playMode !== 'com') return stack.length - 1;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].currentPlayerId !== AI_PLAYER_ID) return index;
  }
  return -1;
}

export function performTripleGomokuUndo(io: IO, roomId: string) {
  const state = tripleGomokuStates.get(roomId);
  if (!state || state.gameOver) return false;
  const target = undoTargetIndex(state);
  if (target < 0) return false;
  const snapshot = state.undoStack[target];
  state.undoStack.length = target;

  clearTripleGomokuTimers(state);
  state.board = cloneTripleGomokuBoard(snapshot.board);
  state.reserves = { ...snapshot.reserves };
  state.currentPlayerId = snapshot.currentPlayerId;
  state.phase = snapshot.phase;
  state.turnNumber = snapshot.turnNumber;
  state.setupTurnIndex = snapshot.setupTurnIndex;
  state.setupRemaining = snapshot.setupRemaining;
  state.lastAction = snapshot.lastAction;
  state.actionLog.length = snapshot.actionLogLength;
  state.turnStartedAt = Date.now();

  armTurnTimer(io, state);
  void broadcastTripleGomokuState(io, state);
  scheduleAi(io, state);
  return true;
}

export function canTripleGomokuUndo(roomId: string) {
  const state = tripleGomokuStates.get(roomId);
  if (!state || state.gameOver) return false;
  return undoTargetIndex(state) >= 0;
}

export { emitTripleGomokuStateToSocket };
