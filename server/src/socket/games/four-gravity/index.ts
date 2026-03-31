import type { Player, PlayMode } from '@shared/types/room.js';
import { BOARD_SIZE } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { Direction, EndGameFn } from './types.js';
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
} from './state.js';

export type { EndGameFn };

export function initFourGravity(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  endGameCallback: EndGameFn,
) {
  gameStates.delete(roomId);

  const blackPlayer: FourGravityPlayerInfo = {
    id: players[0].id,
    nickname: playMode === 'solo' ? `${players[0].nickname} (흑)` : players[0].nickname,
    stoneCount: 0,
  };

  let whitePlayer: FourGravityPlayerInfo;
  if (playMode === 'com') {
    whitePlayer = { id: 'AI', nickname: 'AI', stoneCount: 0 };
  } else if (playMode === 'solo') {
    whitePlayer = { id: players[0].id, nickname: `${players[0].nickname} (백)`, stoneCount: 0 };
  } else {
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
    playMode,
    gameOver: false,
    actionLog: [],
  });

  broadcastState(io, gameStates.get(roomId)!);
}

export function handleFourGravityAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  if (socket.id !== s.currentPlayer) {
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

export function cleanupFourGravity(roomId: string) {
  gameStates.delete(roomId);
}

export function getFourGravityState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitFourGravityStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}
