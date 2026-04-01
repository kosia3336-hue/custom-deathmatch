import type { GameState } from '@shared/types/events.js';
import type { DoubleSidedChessGameData } from '@shared/types/double-sided-chess.js';
import { WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, DSCWinType, Owner } from './types.js';
import {
  isKingInOpponentTerritory,
  countNonKingPieces,
  hasAnyValidAction,
} from './board.js';
import { socketRoom } from '../../utils.js';

export const gameStates = new Map<string, InternalState>();

/* ────────────────────── broadcasting ─────────────────── */

function toGameData(s: InternalState): DoubleSidedChessGameData {
  return {
    board: s.board,
    currentPlayer: s.currentPlayer,
    currentOwner: s.currentOwner,
    turnNumber: s.turnNumber,
    players: {
      first: { ...s.firstPlayer },
      second: { ...s.secondPlayer },
    },
    prisoners: {
      first: [...s.prisoners.first],
      second: [...s.prisoners.second],
    },
    lastMove: s.lastMove,
    winner: s.winner,
    winType: s.winType,
  };
}

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    switch (s.winType) {
      case 'king-captured': return '왕이 포획되어 게임이 종료되었습니다.';
      case 'king-entered': return '왕이 상대 진영에 진입하여 게임이 종료되었습니다.';
      case 'all-captured': return '상대 말이 전멸하여 게임이 종료되었습니다.';
      case 'no-moves': return '이동할 수 없어 게임이 종료되었습니다.';
      case 'timeout': return '시간 초과로 게임이 종료되었습니다.';
      default: return '게임이 종료되었습니다.';
    }
  }
  return '말을 선택하세요';
}

function buildGameState(s: InternalState): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: s.currentPlayer,
    turnNumber: s.turnNumber,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds ? s.turnStartedAt : null,
    gameData: toGameData(s),
  };
}

export function broadcastState(io: IO, s: InternalState) {
  io.to(socketRoom(s.roomId)).emit('game:state', buildGameState(s));
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  socket.emit('game:state', buildGameState(s));
}

/* ────────────────────── game-over handlers ───────────── */

function buildEndPayload(
  s: InternalState,
  winnerId: string,
  winnerNick: string,
  loserId: string,
  loserNick: string,
) {
  return {
    rankings: [
      { playerId: winnerId, nickname: winnerNick, rank: 1, score: 1 },
      { playerId: loserId, nickname: loserNick, rank: 2, score: 0 },
    ],
    totalTurns: s.turnNumber,
    gameResultData: {
      winType: s.winType,
      finalBoard: s.board,
      prisoners: s.prisoners,
      actions: s.actionLog,
      players: {
        first: { nickname: s.firstPlayer.nickname },
        second: { nickname: s.secondPlayer.nickname },
      },
    },
  };
}

function scheduleGameEnd(
  io: IO,
  s: InternalState,
  payload: ReturnType<typeof buildEndPayload>,
) {
  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, WIN_DISPLAY_MS);
}

function getPlayerInfo(s: InternalState, owner: Owner) {
  return owner === 'first' ? s.firstPlayer : s.secondPlayer;
}

/**
 * 승자 Owner를 받아 게임을 종료합니다.
 * winnerId 대신 winnerOwner를 사용해 솔로 모드(first.id === second.id)에서도
 * 닉네임이 올바르게 결정됩니다.
 */
function resolveGame(
  io: IO,
  s: InternalState,
  opts: { winnerOwner: Owner; winType: DSCWinType },
) {
  const loserOwner: Owner = opts.winnerOwner === 'first' ? 'second' : 'first';
  const winnerInfo = getPlayerInfo(s, opts.winnerOwner);
  const loserInfo = getPlayerInfo(s, loserOwner);

  s.winner = winnerInfo.id;
  s.winType = opts.winType;
  s.gameOver = true;
  broadcastState(io, s);
  scheduleGameEnd(
    io,
    s,
    buildEndPayload(s, winnerInfo.id, winnerInfo.nickname, loserInfo.id, loserInfo.nickname),
  );
}

function getWinnerOwner(s: InternalState, currentIsWinner: boolean): Owner {
  if (currentIsWinner) return s.currentOwner;
  return s.currentOwner === 'first' ? 'second' : 'first';
}

/* ────────────────────── turn timer ─────────────────────── */

export function clearTurnTimer(s: InternalState) {
  if (s.turnTimer) {
    clearTimeout(s.turnTimer);
    s.turnTimer = null;
  }
}

export function startTurnTimer(io: IO, s: InternalState) {
  clearTurnTimer(s);
  if (!s.timeLimitSeconds) return;
  s.turnStartedAt = Date.now();
  s.turnTimer = setTimeout(() => {
    handleTimeout(io, s);
  }, s.timeLimitSeconds * 1000);
}

export function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearTurnTimer(s);
  resolveGame(io, s, { winnerOwner: getWinnerOwner(s, false), winType: 'timeout' });
}

/* ────────────────────── win checks ─────────────────────── */

export function checkWinAfterAction(
  io: IO,
  s: InternalState,
  capturedPiece: string | null,
): boolean {
  const opponentOwner: Owner = s.currentOwner === 'first' ? 'second' : 'first';

  // 1. 왕 포획
  if (capturedPiece === 'king') {
    clearTurnTimer(s);
    resolveGame(io, s, { winnerOwner: getWinnerOwner(s, true), winType: 'king-captured' });
    return true;
  }

  // 2. 왕 진입
  if (isKingInOpponentTerritory(s.board, s.currentOwner)) {
    clearTurnTimer(s);
    resolveGame(io, s, { winnerOwner: getWinnerOwner(s, true), winType: 'king-entered' });
    return true;
  }

  // 3. 전멸 (상대 킹 외 기물 없음 + 포로 없음)
  const opponentBoardPieces = countNonKingPieces(s.board, opponentOwner);
  const opponentPrisoners = s.prisoners[opponentOwner].length;
  if (opponentBoardPieces === 0 && opponentPrisoners === 0) {
    clearTurnTimer(s);
    resolveGame(io, s, { winnerOwner: getWinnerOwner(s, true), winType: 'all-captured' });
    return true;
  }

  // 4. 이동 불가
  if (!hasAnyValidAction(s.board, s.prisoners[opponentOwner], opponentOwner)) {
    clearTurnTimer(s);
    resolveGame(io, s, { winnerOwner: getWinnerOwner(s, true), winType: 'no-moves' });
    return true;
  }

  return false;
}

/* ────────────────────── turn management ──────────────── */

export function finishTurn(io: IO, s: InternalState) {
  clearTurnTimer(s);

  s.turnNumber++;
  s.currentOwner = s.currentOwner === 'first' ? 'second' : 'first';
  s.currentPlayer = s.currentOwner === 'first' ? s.firstPlayer.id : s.secondPlayer.id;

  startTurnTimer(io, s);
  broadcastState(io, s);
}
