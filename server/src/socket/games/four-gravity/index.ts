import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { resolveAbstractAiDifficulty } from '@shared/types/game.js';
import { sessions } from '../../../store/sessions.js';
import { BOARD_SIZE } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { Direction, EndGameFn, InternalState } from './types.js';
import { createEmptyBoard, applyGravity, findMovedPosition, calcNeutralCandidates } from './board.js';
import { checkWin } from './win.js';
import type { FourGravityPlayerInfo } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  handleWin,
  handleNoNeutral,
  handleNoSpace,
  finishTurn,
  startTurnTimer,
  clearTurnTimer,
  armTurnTimer,
  runAITurn,
  terminateAIWorker,
  hasPartialTurnFourGravity,
  toGameData,
} from './state.js';
import {
  TUTORIAL_GUIDE_ID,
  applyTutorialLesson,
  clearTutorialComTimer,
  tickTutorialCom,
  tutorialAck,
  tutorialPlace,
  tutorialGravity,
  tutorialNeutral,
} from './tutorial.js';

export type { EndGameFn };

export function initFourGravity(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
  gameOptions?: Record<string, unknown>,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearTurnTimer(prev);
  gameStates.delete(roomId);

  let blackPlayer: FourGravityPlayerInfo;
  let whitePlayer: FourGravityPlayerInfo;

  let ownerToken: string | null = null;

  if (playMode === 'com') {
    // players[0]이 흑, players[1]이 백 (swap으로 순서 바뀔 수 있음)
    const p0 = players[0];
    const p1 = players[1];
    blackPlayer = { id: p0.id, nickname: p0.nickname, stoneCount: 0 };
    whitePlayer = { id: p1.id, nickname: p1.nickname, stoneCount: 0 };
  } else if (playMode === 'tutorial') {
    blackPlayer = { id: TUTORIAL_GUIDE_ID, nickname: 'COM', stoneCount: 0 };
    whitePlayer = { id: players[0].id, nickname: players[0].nickname, stoneCount: 0 };
  } else if (playMode === 'solo') {
    blackPlayer = { id: players[0].id, nickname: `${players[0].nickname} (흑)`, stoneCount: 0 };
    whitePlayer = { id: players[0].id, nickname: `${players[0].nickname} (백)`, stoneCount: 0 };
    if (players[0].nickname === '천하') ownerToken = players[0].id;
  } else {
    blackPlayer = { id: players[0].id, nickname: players[0].nickname, stoneCount: 0 };
    whitePlayer = { id: players[1].id, nickname: players[1].nickname, stoneCount: 0 };
  }

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    board: createEmptyBoard(),
    currentPlayer: blackPlayer.id,
    currentColor: 'black',
    phase: 'place',
    turnNumber: 1,
    lastGravityBlack: null,
    lastGravityWhite: null,
    placedPosition: null,
    movedPosition: null,
    neutralCandidates: [],
    blackPlayer,
    whitePlayer,
    neutralCount: 0,
    winner: null,
    winLine: null,
    winType: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    turnTimer: null,
    playMode,
    aiDifficulty: resolveAbstractAiDifficulty(gameOptions?.aiDifficulty),
    gameOver: false,
    actionLog: [],
    undoSnapshots: [],
    ownerToken,
    tutorialStep: playMode === 'tutorial' ? 'intro' : null,
    tutorialCom: null,
    tutorialComTimer: null,
  });

  const s = gameStates.get(roomId)!;
  if (playMode === 'tutorial') {
    applyTutorialLesson(s, 'intro');
    broadcastState(io, s);
    return;
  }
  startTurnTimer(io, s);
  broadcastState(io, s);

  // AI가 흑(첫 번째 차례)일 경우 게임 시작 시 즉시 AI 턴 실행
  if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
    runAITurn(io, roomId);
  }
}

export function handleFourGravityAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;
  if (s.playMode === 'tutorial') {
    handleTutorialAction(io, socket, s, myId, data);
    return;
  }
  if (myId !== s.currentPlayer) {
    socket.emit('error', { message: '상대 턴입니다.' });
    return;
  }

  switch (data.type) {
    case 'place': {
      if (s.phase !== 'place') {
        socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
        return;
      }
      const row = data.row;
      const col = data.col;
      if (
        typeof row !== 'number' || typeof col !== 'number' ||
        !Number.isInteger(row) || !Number.isInteger(col)
      ) return;
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
      if (s.board[row][col] !== 'empty') {
        socket.emit('error', { message: '이미 돌이 있는 칸입니다.' });
        return;
      }
      s.board[row][col] = s.currentColor;
      s.placedPosition = { row, col };
      if (s.currentColor === 'black') s.blackPlayer.stoneCount++;
      else s.whitePlayer.stoneCount++;
      s.actionLog.push({
        turnNumber: s.turnNumber,
        color: s.currentColor,
        nickname: s.currentColor === 'black' ? s.blackPlayer.nickname : s.whitePlayer.nickname,
        steps: [{ type: 'place', row, col }],
      });
      s.phase = 'gravity';
      broadcastState(io, s);
      break;
    }

    case 'gravity': {
      if (s.phase !== 'gravity') {
        socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
        return;
      }
      const dir = data.direction as Direction;
      if (!['up', 'down', 'left', 'right', 'none'].includes(dir)) return;

      const myLastGravity = s.currentColor === 'black' ? s.lastGravityBlack : s.lastGravityWhite;
      if (myLastGravity !== null && dir === myLastGravity) {
        socket.emit('error', { message: '직전에 사용한 방향은 선택할 수 없습니다.' });
        return;
      }

      if (dir === 'none') {
        if (s.currentColor === 'black') s.lastGravityBlack = 'none';
        else s.lastGravityWhite = 'none';
        s.movedPosition = s.placedPosition;
        s.neutralCandidates = [];
        const log = s.actionLog[s.actionLog.length - 1];
        if (log) log.steps.push({ type: 'gravity', direction: 'none' });
        finishTurn(io, s);
        return;
      }

      const boardBefore = s.board.map((r) => [...r]);
      s.board = applyGravity(s.board, dir);
      if (s.currentColor === 'black') s.lastGravityBlack = dir;
      else s.lastGravityWhite = dir;

      const movedPos = findMovedPosition(s.placedPosition!, dir, boardBefore, s.board);
      s.movedPosition = movedPos;

      const gLog = s.actionLog[s.actionLog.length - 1];
      if (gLog) gLog.steps.push({ type: 'gravity', direction: dir });

      const wr = checkWin(s.board, s.currentColor);
      if (wr) { handleWin(io, s, wr); return; }

      const cands = calcNeutralCandidates(s.placedPosition!, movedPos, s.board);
      s.neutralCandidates = cands;

      if (cands.length === 0) {
        handleNoNeutral(io, s);
      } else {
        s.phase = 'neutral';
        broadcastState(io, s);
      }
      break;
    }

    case 'neutral': {
      if (s.phase !== 'neutral') {
        socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
        return;
      }
      const row = data.row;
      const col = data.col;
      if (
        typeof row !== 'number' || typeof col !== 'number' ||
        !Number.isInteger(row) || !Number.isInteger(col)
      ) return;
      if (!s.neutralCandidates.some((p) => p.row === row && p.col === col)) {
        socket.emit('error', { message: '이 위치에는 중립 돌을 놓을 수 없습니다.' });
        return;
      }
      s.board[row][col] = 'neutral';
      s.neutralCount++;
      const nLog = s.actionLog[s.actionLog.length - 1];
      if (nLog) nLog.steps.push({ type: 'neutral', row, col });
      finishTurn(io, s);
      break;
    }
  }
}

function armTutorialComTick(io: IO, s: InternalState) {
  clearTutorialComTimer(s);
  if (!s.tutorialCom) return;
  s.tutorialComTimer = setTimeout(() => {
    s.tutorialComTimer = null;
    if (!gameStates.has(s.roomId) || s.gameOver || !s.tutorialCom) return;
    tickTutorialCom(s);
    broadcastState(io, s);
    if (s.tutorialCom) armTutorialComTick(io, s);
  }, 1000);
}

function handleTutorialAction(
  io: IO,
  socket: TypedSocket,
  s: InternalState,
  myId: string,
  data: Record<string, unknown>,
) {
  if (myId !== s.whitePlayer.id) {
    socket.emit('error', { message: '튜토리얼은 플레이어만 진행할 수 있습니다.' });
    return;
  }

  switch (data.type) {
    case 'tutorial-ack': {
      const result = tutorialAck(s);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
      } else if (result.complete) {
        handleWin(io, s, { winner: 'current', type: 'white', line: s.winLine ?? [] });
      } else {
        broadcastState(io, s);
        armTutorialComTick(io, s);
      }
      return;
    }
    case 'place': {
      const row = data.row;
      const col = data.col;
      if (
        typeof row !== 'number' ||
        typeof col !== 'number' ||
        !Number.isInteger(row) ||
        !Number.isInteger(col)
      ) {
        return;
      }
      const err = tutorialPlace(s, row, col);
      if (err) socket.emit('error', { message: err });
      else broadcastState(io, s);
      return;
    }
    case 'gravity': {
      const dir = data.direction as Direction;
      if (!['up', 'down', 'left', 'right', 'none'].includes(dir)) return;
      const result = tutorialGravity(s, dir);
      if (result === 'broadcast') {
        broadcastState(io, s);
      } else {
        socket.emit('error', { message: result });
      }
      return;
    }
    case 'neutral': {
      const row = data.row;
      const col = data.col;
      if (
        typeof row !== 'number' ||
        typeof col !== 'number' ||
        !Number.isInteger(row) ||
        !Number.isInteger(col)
      ) {
        return;
      }
      const err = tutorialNeutral(s, row, col);
      if (err) socket.emit('error', { message: err });
      else {
        broadcastState(io, s);
        armTutorialComTick(io, s);
      }
    }
  }
}

export function cleanupFourGravity(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) {
    clearTurnTimer(s);
    clearTutorialComTimer(s);
  }
  gameStates.delete(roomId);
  terminateAIWorker(roomId);
}

export function getFourGravityState(roomId: string) {
  return gameStates.get(roomId);
}

/** 더미용. 보드·양색 직전 중력은 사람이 보고 기억하는 공개 정보. */
export function getFourGravityDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  return {
    gameOver: s.gameOver,
    data: toGameData(s, viewerId),
    lastGravityBlack: s.lastGravityBlack,
    lastGravityWhite: s.lastGravityWhite,
    turnNumber: s.turnNumber,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}

export function emitFourGravityStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export { performFourGravityUndo } from './state.js';

export function canFourGravityUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s) return false;
  if (s.playMode === 'tutorial') return false;
  if (s.gameOver && !s.ownerToken) return false;
  if (hasPartialTurnFourGravity(s)) return s.undoSnapshots.length >= 1;
  const wantDouble = s.playMode === 'com' && s.currentPlayer !== AI_PLAYER_ID;
  return wantDouble ? s.undoSnapshots.length >= 3 : s.undoSnapshots.length >= 2;
}

export function handleFourGravityToggleAI(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || !s.ownerToken || s.gameOver) return;
  if (s.playMode === 'tutorial') return;

  const myId = sessions.getToken(socket.id) ?? socket.id;
  if (myId !== s.ownerToken) return;

  const aiOn = data.ai === true;

  if (aiOn) {
    if (s.phase !== 'place') return;

    if (s.currentColor === 'black') {
      s.blackPlayer.id = AI_PLAYER_ID;
    } else {
      s.whitePlayer.id = AI_PLAYER_ID;
    }
    s.currentPlayer = AI_PLAYER_ID;
    s.playMode = 'com';

    clearTurnTimer(s);
    broadcastState(io, s);
    void runAITurn(io, roomId);
  } else {
    terminateAIWorker(roomId);

    if (s.blackPlayer.id === AI_PLAYER_ID) s.blackPlayer.id = s.ownerToken;
    if (s.whitePlayer.id === AI_PLAYER_ID) s.whitePlayer.id = s.ownerToken;
    s.currentPlayer = s.ownerToken;
    s.playMode = 'solo';

    armTurnTimer(io, s);
    broadcastState(io, s);
  }
}

export { getFourGravityResultData } from './state.js';
