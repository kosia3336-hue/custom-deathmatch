import {
  applyTripleGomokuAction,
  canMoveTripleGomokuStone,
  canPlaceTripleGomokuSetup,
  canPlaceTripleGomokuStone,
  findTripleGomokuWin,
  isTripleGomokuCell,
} from '@shared/logic/triple-gomoku.js';
import { resolveAbstractAiDifficulty } from '@shared/types/game.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
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
  state.turnTimer = setTimeout(() => {
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
) {
  if (state.gameOver) return;
  const error = validate(state, actorId, action);
  if (error) {
    socket?.emit('error', { message: error });
    return;
  }
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = null;
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.aiTimer = null;

  state.board = applyTripleGomokuAction(state.board, action, actorId);
  if (action.type === 'place') state.reserves[actorId] = (state.reserves[actorId] ?? 0) - 1;
  const entry = { turn: state.turnNumber, actorId, action };
  state.lastAction = entry;
  state.actionLog.push(entry);

  // 행동한 쪽을 먼저 본다. 같은 수에 양쪽 조건이 동시에 서면 행동한 쪽이 이긴다.
  const opponent = otherPlayer(state, actorId);
  const actorWin = findTripleGomokuWin(state.board, actorId);
  if (actorWin) return finishGame(io, state, actorWin);
  const opponentWin = findTripleGomokuWin(state.board, opponent.id);
  if (opponentWin) return finishGame(io, state, opponentWin);

  if (state.phase === 'setup') {
    advanceSetup(io, state);
    return;
  }
  passTurnTo(io, state, opponent.id);
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
  const first = players[0];
  const second = players[1];
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
    lastAction: null,
    winnerId: null,
    winType: null,
    winCells: [],
    finishReason: null,
    gameOver: false,
    startedAt,
    turnStartedAt: now,
    timeLimitSeconds,
    turnTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  tripleGomokuStates.set(roomId, state);
  armTurnTimer(io, state);
  void broadcastTripleGomokuState(io, state);
  scheduleAi(io, state);
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

export function performTripleGomokuUndo() {
  return false;
}

export function canTripleGomokuUndo() {
  return false;
}

export { emitTripleGomokuStateToSocket };
