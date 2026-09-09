import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import {
  resolveAbstractAiDifficulty,
  resolveAbstractAiThinkSeconds,
} from '@shared/types/game.js';
import { isDummyPlayerId } from '@shared/dummy.js';
import { sessions } from '../../../store/sessions.js';
import type { Position, PieceType } from '@shared/types/double-sided-chess.js';
import { nextIsPromoted } from '@shared/logic/double-sided-chess.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, DSCPlayerInfo } from './types.js';
import { createInitialBoard, getValidMoves, getValidPrisonerPlacements } from './board.js';
import {
  gameStates,
  toGameData,
  broadcastState,
  emitStateToSocket,
  startTurnTimer,
  clearTurnTimer,
  checkWinAfterAction,
  finishTurn,
  terminateAIWorker,
  runAITurn,
} from './state.js';

export type { EndGameFn };

export function initDoubleSidedChess(
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

  let firstPlayer: DSCPlayerInfo;
  let secondPlayer: DSCPlayerInfo;

  let ownerToken: string | null = null;

  if (playMode === 'solo') {
    firstPlayer = { id: players[0].id, nickname: `${players[0].nickname} (선)` };
    secondPlayer = { id: players[0].id, nickname: `${players[0].nickname} (후)` };
    if (players[0].nickname === '천하') ownerToken = players[0].id;
  } else if (playMode === 'com') {
    firstPlayer = { id: players[0].id, nickname: players[0].nickname };
    secondPlayer = { id: players[1].id, nickname: players[1].nickname };
  } else {
    firstPlayer = { id: players[0].id, nickname: players[0].nickname };
    secondPlayer = { id: players[1].id, nickname: players[1].nickname };
  }

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    board: createInitialBoard(),
    currentPlayer: firstPlayer.id,
    currentOwner: 'first',
    turnNumber: 1,
    firstPlayer,
    secondPlayer,
    prisoners: { first: [], second: [] },
    lastMove: null,
    winner: null,
    winType: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    turnTimer: null,
    playMode,
    aiThinkSeconds: resolveAbstractAiThinkSeconds(gameOptions),
    aiDifficulty: resolveAbstractAiDifficulty(gameOptions?.aiDifficulty, 'game-002'),
    gameOver: false,
    actionLog: [],
    undoSnapshots: [],
    ownerToken,
  });

  const s = gameStates.get(roomId)!;
  startTurnTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
    runAITurn(io, roomId);
  }
}

export function handleDoubleSidedChessAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = isDummyPlayerId(socket.id)
    ? socket.id
    : (sessions.getToken(socket.id) ?? socket.id);
  if (myId !== s.currentPlayer) {
    socket.emit('error', { message: '상대 턴입니다.' });
    return;
  }

  switch (data.type) {
    case 'move': {
      const from = data.from as Position | undefined;
      const to = data.to as Position | undefined;
      if (!from || !to) {
        if (isDummyPlayerId(socket.id)) console.warn('[DSC] dummy move missing from/to', data);
        return;
      }
      if (
        typeof from.row !== 'number' || typeof from.col !== 'number' ||
        typeof to.row !== 'number' || typeof to.col !== 'number'
      ) {
        if (isDummyPlayerId(socket.id)) console.warn('[DSC] dummy move non-number coords', data);
        return;
      }

      const cell = s.board[from.row]?.[from.col];
      if (!cell || cell.owner !== s.currentOwner) {
        socket.emit('error', { message: '자신의 말만 이동할 수 있습니다.' });
        return;
      }

      const validMoves = getValidMoves(s.board, from.row, from.col);
      if (!validMoves.some((m) => m.row === to.row && m.col === to.col)) {
        socket.emit('error', { message: '해당 칸으로 이동할 수 없습니다.' });
        return;
      }

      const target = s.board[to.row][to.col];
      let capturedPiece: PieceType | null = null;

      if (target && target.owner !== s.currentOwner) {
        capturedPiece = target.piece;
        if (capturedPiece !== 'king') {
          s.prisoners[s.currentOwner].push(capturedPiece);
        }
      }

      s.board[to.row][to.col] = {
        piece: cell.piece,
        owner: cell.owner,
        isPromoted: nextIsPromoted(cell.piece, cell.isPromoted),
      };
      s.board[from.row][from.col] = null;

      s.lastMove = { type: 'move', from, to, captured: capturedPiece };

      s.actionLog.push({
        turnNumber: s.turnNumber,
        player: s.currentOwner,
        nickname: s.currentOwner === 'first' ? s.firstPlayer.nickname : s.secondPlayer.nickname,
        action: { type: 'move', from, to },
      });

      if (checkWinAfterAction(io, s, capturedPiece)) return;
      finishTurn(io, s);
      break;
    }

    case 'place-prisoner': {
      const pieceType = data.pieceType as PieceType | undefined;
      const position = data.position as Position | undefined;
      if (!pieceType || !position) return;
      if (typeof position.row !== 'number' || typeof position.col !== 'number') return;

      const prisonerList = s.prisoners[s.currentOwner];
      const idx = prisonerList.indexOf(pieceType);
      if (idx === -1) {
        socket.emit('error', { message: '배치할 포로가 없습니다.' });
        return;
      }

      const validPlacements = getValidPrisonerPlacements(s.board, s.currentOwner);
      if (!validPlacements.some((p) => p.row === position.row && p.col === position.col)) {
        socket.emit('error', { message: '포로는 자신의 진영에만 배치할 수 있습니다.' });
        return;
      }

      if (s.board[position.row][position.col]) {
        socket.emit('error', { message: '빈칸에만 포로를 배치할 수 있습니다.' });
        return;
      }

      prisonerList.splice(idx, 1);
      s.board[position.row][position.col] = {
        piece: pieceType,
        owner: s.currentOwner,
        isPromoted: false,
      };

      s.lastMove = { type: 'place-prisoner', from: null, to: position, captured: null };

      s.actionLog.push({
        turnNumber: s.turnNumber,
        player: s.currentOwner,
        nickname: s.currentOwner === 'first' ? s.firstPlayer.nickname : s.secondPlayer.nickname,
        action: { type: 'place-prisoner', pieceType, position },
      });

      if (checkWinAfterAction(io, s, null)) return;
      finishTurn(io, s);
      break;
    }

    default:
      break;
  }
}

export function cleanupDoubleSidedChess(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTurnTimer(s);
  gameStates.delete(roomId);
  terminateAIWorker(roomId);
}

export function getDoubleSidedChessState(roomId: string) {
  return gameStates.get(roomId);
}

/** 더미용. 보드·포로·턴은 사람 `game:state` 와 같다. owner 강수·워커 없음. */
export function getDoubleSidedChessDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  return {
    gameOver: s.gameOver,
    data: toGameData(s, viewerId),
    turnNumber: s.turnNumber,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}

export function emitDoubleSidedChessStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export { performDoubleSidedChessUndo } from './state.js';

export function canDoubleSidedChessUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s) return false;
  if (s.gameOver && !s.ownerToken) return false;
  const wantDouble = s.playMode === 'com' && s.currentPlayer !== AI_PLAYER_ID;
  return wantDouble ? s.undoSnapshots.length >= 3 : s.undoSnapshots.length >= 2;
}

export function handleDoubleSidedChessToggleAI(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || !s.ownerToken || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;
  if (myId !== s.ownerToken) return;

  const aiOn = data.ai === true;

  if (aiOn) {
    // 현재 owner의 id를 AI로 교체
    if (s.currentOwner === 'first') {
      s.firstPlayer.id = AI_PLAYER_ID;
    } else {
      s.secondPlayer.id = AI_PLAYER_ID;
    }
    s.currentPlayer = AI_PLAYER_ID;
    s.playMode = 'com';

    clearTurnTimer(s);
    broadcastState(io, s);
    void runAITurn(io, roomId);
  } else {
    terminateAIWorker(roomId);

    if (s.firstPlayer.id === AI_PLAYER_ID) s.firstPlayer.id = s.ownerToken;
    if (s.secondPlayer.id === AI_PLAYER_ID) s.secondPlayer.id = s.ownerToken;
    s.currentPlayer = s.ownerToken;
    s.playMode = 'solo';

    startTurnTimer(io, s);
    broadcastState(io, s);
  }
}

export { getDoubleSidedChessResultData } from './state.js';
