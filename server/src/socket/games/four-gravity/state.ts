import type { GameState } from '@shared/types/events.js';
import type { FourGravityGameData } from '@shared/types/four-gravity.js';
import { AI_DELAY, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, WinResult, EndGameFn } from './types.js';
import { cloneBoard, applyGravity, findMovedPosition, calcNeutralCandidates } from './board.js';
import { checkWin, hasEmptyCells } from './win.js';
import { findBestMove } from './ai.js';

export const gameStates = new Map<string, InternalState>();

let onEndGame: EndGameFn = () => {};

export function registerEndGameCallback(fn: EndGameFn) {
  onEndGame = fn;
}

function socketRoom(roomId: string) {
  return `room:${roomId}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

/* ────────────────────── broadcasting ─────────────────── */

function toGameData(s: InternalState): FourGravityGameData {
  return {
    board: s.board,
    currentPlayer: s.currentPlayer,
    currentColor: s.currentColor,
    phase: s.phase,
    lastGravity: s.currentColor === 'black' ? s.lastGravityBlack : s.lastGravityWhite,
    placedPosition: s.placedPosition,
    movedPosition: s.movedPosition,
    neutralCandidates: s.neutralCandidates,
    players: {
      black: { ...s.blackPlayer },
      white: { ...s.whitePlayer },
    },
    neutralCount: s.neutralCount,
    winner: s.winner,
    winLine: s.winLine,
    winType: s.winType,
  };
}

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    if (s.winType === 'no-space') return '둘 곳이 없어 게임이 종료되었습니다.';
    if (s.winType === 'no-neutral') return '중립 돌을 놓을 수 없어 게임이 종료되었습니다.';
    return '사목이 완성되어 게임이 종료되었습니다.';
  }
  const isAI = s.currentPlayer === 'AI';
  if (isAI) {
    switch (s.phase) {
      case 'place':   return 'AI가 생각 중입니다...';
      case 'gravity': return 'AI가 중력을 선택 중입니다...';
      case 'neutral': return 'AI가 중립 돌을 놓는 중입니다...';
      default:        return 'AI가 생각 중입니다...';
    }
  }
  switch (s.phase) {
    case 'place':   return '보드에 돌을 놓으세요';
    case 'gravity': return '중력 방향을 선택하세요';
    case 'neutral': return '경로 위에 중립 돌을 놓으세요';
    default:        return '상대 턴입니다. 기다려 주세요...';
  }
}

export function broadcastState(io: IO, s: InternalState) {
  const gs: GameState = {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: s.currentPlayer,
    turnNumber: s.turnNumber,
    startedAt: s.startedAt,
    gameData: toGameData(s),
  };
  io.to(socketRoom(s.roomId)).emit('game:state', gs);
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const gs: GameState = {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: s.currentPlayer,
    turnNumber: s.turnNumber,
    startedAt: s.startedAt,
    gameData: toGameData(s),
  };
  socket.emit('game:state', gs);
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
      blackStones: s.blackPlayer.stoneCount,
      whiteStones: s.whitePlayer.stoneCount,
      neutralStones: s.neutralCount,
    },
  };
}

export function handleWin(io: IO, s: InternalState, wr: WinResult) {
  const winnerId =
    wr.winner === 'current'
      ? (s.currentColor === 'black' ? s.blackPlayer.id : s.whitePlayer.id)
      : (s.currentColor === 'black' ? s.whitePlayer.id : s.blackPlayer.id);
  const loserId = winnerId === s.blackPlayer.id ? s.whitePlayer.id : s.blackPlayer.id;
  const winnerNick = winnerId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;
  const loserNick = loserId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;

  s.winner = winnerId;
  s.winLine = wr.line;
  s.winType = wr.type;
  s.gameOver = true;
  s.phase = 'waiting';
  broadcastState(io, s);

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    const roomId = s.roomId;
    gameStates.delete(roomId);
    onEndGame(io, roomId, buildEndPayload(s, winnerId, winnerNick, loserId, loserNick));
  }, WIN_DISPLAY_MS);
}

export function handleNoNeutral(io: IO, s: InternalState) {
  const loserId = s.currentColor === 'black' ? s.blackPlayer.id : s.whitePlayer.id;
  const winnerId = loserId === s.blackPlayer.id ? s.whitePlayer.id : s.blackPlayer.id;
  const winnerNick = winnerId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;
  const loserNick = loserId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;

  s.winner = winnerId;
  s.winLine = null;
  s.winType = 'no-neutral';
  s.gameOver = true;
  s.phase = 'waiting';
  broadcastState(io, s);

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    const roomId = s.roomId;
    gameStates.delete(roomId);
    onEndGame(io, roomId, buildEndPayload(s, winnerId, winnerNick, loserId, loserNick));
  }, WIN_DISPLAY_MS);
}

export function handleNoSpace(io: IO, s: InternalState) {
  const winnerId = s.currentColor === 'black' ? s.blackPlayer.id : s.whitePlayer.id;
  const loserId = winnerId === s.blackPlayer.id ? s.whitePlayer.id : s.blackPlayer.id;
  const winnerNick = winnerId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;
  const loserNick = loserId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;

  s.winner = winnerId;
  s.winType = 'no-space';
  s.gameOver = true;
  s.phase = 'waiting';
  broadcastState(io, s);

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    const roomId = s.roomId;
    gameStates.delete(roomId);
    onEndGame(io, roomId, buildEndPayload(s, winnerId, winnerNick, loserId, loserNick));
  }, WIN_DISPLAY_MS);
}

/* ────────────────────── turn management ──────────────── */

export function finishTurn(io: IO, s: InternalState) {
  const wr = checkWin(s.board, s.currentColor);
  if (wr) { handleWin(io, s, wr); return; }
  if (!hasEmptyCells(s.board)) { handleNoSpace(io, s); return; }

  s.turnNumber++;
  s.currentColor = s.currentColor === 'black' ? 'white' : 'black';
  s.currentPlayer = s.currentColor === 'black' ? s.blackPlayer.id : s.whitePlayer.id;
  s.phase = 'place';
  s.placedPosition = null;
  s.movedPosition = null;
  s.neutralCandidates = [];
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentPlayer === 'AI') {
    runAITurn(io, s.roomId);
  }
}

/* ────────────────────── AI turn runner ───────────────── */

export async function runAITurn(io: IO, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.currentPlayer !== 'AI') return;

  const move = findBestMove(s);

  /* ① place */
  await wait(randDelay());
  if (!gameStates.has(roomId)) return;

  s.board[move.place.row][move.place.col] = s.currentColor;
  s.placedPosition = move.place;
  s.whitePlayer.stoneCount++;
  s.phase = 'gravity';
  broadcastState(io, s);

  /* ② gravity */
  await wait(randDelay());
  if (!gameStates.has(roomId)) return;

  if (move.gravity === 'none') {
    s.lastGravityWhite = 'none';
    s.movedPosition = s.placedPosition;
    s.neutralCandidates = [];
    finishTurn(io, s);
    return;
  }

  const boardBefore = cloneBoard(s.board);
  s.board = applyGravity(s.board, move.gravity);
  s.lastGravityWhite = move.gravity;
  s.movedPosition = findMovedPosition(s.placedPosition!, move.gravity, boardBefore, s.board);

  const wr = checkWin(s.board, s.currentColor);
  if (wr) { handleWin(io, s, wr); return; }

  const cands = calcNeutralCandidates(s.placedPosition!, s.movedPosition!, s.board);
  s.neutralCandidates = cands;

  if (cands.length === 0) {
    handleNoNeutral(io, s);
    return;
  }

  s.phase = 'neutral';
  broadcastState(io, s);

  /* ③ neutral */
  await wait(randDelay());
  if (!gameStates.has(roomId)) return;

  const neutralPos = move.neutral ?? cands[0];
  s.board[neutralPos.row][neutralPos.col] = 'neutral';
  s.neutralCount++;
  finishTurn(io, s);
}
