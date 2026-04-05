import type { GameState } from '@shared/types/events.js';
import type { DoubleSidedChessGameData, PieceType } from '@shared/types/double-sided-chess.js';
import { nextIsPromoted } from '@shared/logic/double-sided-chess.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { WIN_DISPLAY_MS, AI_DELAY } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, DSCWinType, Owner, AIMove } from './types.js';
import {
  isKingInOpponentTerritory,
  countNonKingPieces,
  hasAnyValidAction,
} from './board.js';
import { getQuickFallbackMove, findBestMoveIterative, type AIWorkerData } from './ai.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { extname, dirname, join } from 'path';
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
  if (s.currentPlayer === AI_PLAYER_ID) return 'AI가 생각 중입니다...';
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
    const roomId = s.roomId;
    gameStates.delete(roomId);
    terminateAIWorker(roomId);
    s.endGameCallback(io, roomId, payload);
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
  if (!s.timeLimitSeconds || s.currentPlayer === AI_PLAYER_ID) return;
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

  if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
    runAITurn(io, s.roomId);
  }
}

/* ────────────────────── AI turn runner ───────────────── */

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

const aiWorkerMap = new Map<string, Worker>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'ai-worker.js');
}

let _workerPath: string | null = null;

function getOrCreateAIWorker(roomId: string): Worker {
  const existing = aiWorkerMap.get(roomId);
  if (existing) return existing;
  _workerPath ??= resolveWorkerPath();
  const worker = new Worker(_workerPath);
  aiWorkerMap.set(roomId, worker);
  return worker;
}

export function terminateAIWorker(roomId: string) {
  const worker = aiWorkerMap.get(roomId);
  if (worker) {
    worker.terminate();
    aiWorkerMap.delete(roomId);
  }
}

function runAIWithWorker(s: InternalState): Promise<AIMove> {
  const workerData: AIWorkerData = {
    board: s.board,
    prisoners: { first: [...s.prisoners.first], second: [...s.prisoners.second] },
    currentOwner: s.currentOwner,
  };

  return new Promise((resolve) => {
    const worker = getOrCreateAIWorker(s.roomId);

    let settled = false;
    const settle = (move: AIMove) => {
      if (settled) return;
      settled = true;
      resolve(move);
    };

    const onMessage = (move: AIMove) => {
      cleanup();
      settle(move);
    };
    const onError = (err: Error) => {
      console.error('[DSC AI Worker Error]', err);
      cleanup();
      terminateAIWorker(s.roomId);
      settle(getQuickFallbackMove(s.board, s.prisoners, s.currentOwner));
    };
    const onExit = (code: number) => {
      cleanup();
      if (!settled) {
        if (code !== 0 && gameStates.has(s.roomId)) {
          console.error(`[DSC AI Worker] exited unexpectedly with code ${code}`);
        }
        aiWorkerMap.delete(s.roomId);
        settle(getQuickFallbackMove(s.board, s.prisoners, s.currentOwner));
      }
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };

    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage(workerData);
  });
}

export async function runAITurn(io: IO, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.currentPlayer !== AI_PLAYER_ID) return;

  const move = await runAIWithWorker(s);

  if (!gameStates.has(roomId)) return;

  await wait(randDelay());
  if (!gameStates.has(roomId)) return;

  if (move.type === 'move') {
    const cell = s.board[move.from.row][move.from.col];
    if (!cell) return;

    const target = s.board[move.to.row][move.to.col];
    let capturedPiece: PieceType | null = null;

    if (target && target.owner !== s.currentOwner) {
      capturedPiece = target.piece;
      if (capturedPiece !== 'king') {
        s.prisoners[s.currentOwner].push(capturedPiece);
      }
    }

    s.board[move.to.row][move.to.col] = {
      piece: cell.piece,
      owner: cell.owner,
      isPromoted: nextIsPromoted(cell.piece, cell.isPromoted),
    };
    s.board[move.from.row][move.from.col] = null;

    s.lastMove = { type: 'move', from: move.from, to: move.to, captured: capturedPiece };

    s.actionLog.push({
      turnNumber: s.turnNumber,
      player: s.currentOwner,
      nickname: s.currentOwner === 'first' ? s.firstPlayer.nickname : s.secondPlayer.nickname,
      action: { type: 'move', from: move.from, to: move.to },
    });

    broadcastState(io, s);

    if (checkWinAfterAction(io, s, capturedPiece)) return;
    finishTurn(io, s);
  } else {
    const prisonerList = s.prisoners[s.currentOwner];
    const idx = prisonerList.indexOf(move.pieceType);
    if (idx === -1) return;

    prisonerList.splice(idx, 1);
    s.board[move.position.row][move.position.col] = {
      piece: move.pieceType,
      owner: s.currentOwner,
      isPromoted: false,
    };

    s.lastMove = { type: 'place-prisoner', from: null, to: move.position, captured: null };

    s.actionLog.push({
      turnNumber: s.turnNumber,
      player: s.currentOwner,
      nickname: s.currentOwner === 'first' ? s.firstPlayer.nickname : s.secondPlayer.nickname,
      action: { type: 'place-prisoner', pieceType: move.pieceType, position: move.position },
    });

    broadcastState(io, s);

    if (checkWinAfterAction(io, s, null)) return;
    finishTurn(io, s);
  }
}
