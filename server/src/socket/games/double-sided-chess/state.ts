import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import type { GameState } from '@shared/types/events.js';
import type { DoubleSidedChessGameData, PieceType } from '@shared/types/double-sided-chess.js';
import { nextIsPromoted } from '@shared/logic/double-sided-chess.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { WIN_DISPLAY_MS, AI_DELAY } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, DSCWinType, Owner, AIMove, DSCUndoSnapshot } from './types.js';
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
import { sessions } from '../../../store/sessions.js';
import { getActiveSkin } from '../../skins.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';

const g = globalThis as typeof globalThis & { __dscGameStates?: Map<string, InternalState> };
export const gameStates: Map<string, InternalState> =
  g.__dscGameStates ?? (g.__dscGameStates = new Map());

/* ────────────────────── broadcasting ─────────────────── */

export function toGameData(s: InternalState, viewerToken: string): DoubleSidedChessGameData {
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) && id !== viewerToken ? ANONYMOUS_NICKNAME : nick;
  return {
    board: s.board,
    currentPlayer: s.currentPlayer,
    currentOwner: s.currentOwner,
    turnNumber: s.turnNumber,
    players: {
      first: { ...s.firstPlayer, nickname: maskNick(s.firstPlayer.id, s.firstPlayer.nickname) },
      second: { ...s.secondPlayer, nickname: maskNick(s.secondPlayer.id, s.secondPlayer.nickname) },
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

function buildGameState(s: InternalState, viewerToken: string): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: s.currentPlayer,
    turnNumber: s.turnNumber,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds ? s.turnStartedAt : null,
    gameData: toGameData(s, viewerToken),
    activeSkin: getActiveSkin(s.roomId),
  };
}

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    sock.emit('game:state', buildGameState(s, pid));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  socket.emit('game:state', buildGameState(s, pid));
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
    if (!s.gameOver) return;
    const roomId = s.roomId;
    if (!s.ownerToken) {
      gameStates.delete(roomId);
      terminateAIWorker(roomId);
    }
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

function cloneUndoSnapshot(s: InternalState): DSCUndoSnapshot {
  return {
    board: s.board.map((row) => row.map((c) => (c ? { ...c } : null))) as InternalState['board'],
    currentPlayer: s.currentPlayer,
    currentOwner: s.currentOwner,
    turnNumber: s.turnNumber,
    firstPlayer: { ...s.firstPlayer },
    secondPlayer: { ...s.secondPlayer },
    prisoners: { first: [...s.prisoners.first], second: [...s.prisoners.second] },
    lastMove: s.lastMove
      ? {
          type: s.lastMove.type,
          from: s.lastMove.from ? { ...s.lastMove.from } : null,
          to: { ...s.lastMove.to },
          captured: s.lastMove.captured,
        }
      : null,
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as InternalState['actionLog'],
    winner: s.winner,
    winType: s.winType,
  };
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push(cloneUndoSnapshot(s));
}

function applyUndoSnapshot(s: InternalState, snap: DSCUndoSnapshot) {
  s.board = snap.board.map((row) => row.map((c) => (c ? { ...c } : null))) as InternalState['board'];
  s.currentPlayer = snap.currentPlayer;
  s.currentOwner = snap.currentOwner;
  s.turnNumber = snap.turnNumber;
  s.firstPlayer = { ...snap.firstPlayer };
  s.secondPlayer = { ...snap.secondPlayer };
  s.prisoners = { first: [...snap.prisoners.first], second: [...snap.prisoners.second] };
  s.lastMove = snap.lastMove
    ? {
        type: snap.lastMove.type,
        from: snap.lastMove.from ? { ...snap.lastMove.from } : null,
        to: { ...snap.lastMove.to },
        captured: snap.lastMove.captured,
      }
    : null;
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as InternalState['actionLog'];
  s.winner = snap.winner;
  s.winType = snap.winType;
}

function armTurnTimer(io: IO, s: InternalState) {
  clearTurnTimer(s);
  if (!s.timeLimitSeconds || s.currentPlayer === AI_PLAYER_ID) return;
  s.turnStartedAt = Date.now();
  s.turnTimer = scheduleTurnExpiry(io, s, 'turnTimer', () => s.currentPlayer, () => {
    handleTimeout(io, s);
  }, s.timeLimitSeconds * 1000);
}

export function startTurnTimer(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armTurnTimer(io, s);
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

  // 3. 전멸 (상대 킹 외 판 위 기물 없음)
  const opponentBoardPieces = countNonKingPieces(s.board, opponentOwner);
  if (opponentBoardPieces === 0) {
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

export function performDoubleSidedChessUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s) return false;
  if (s.gameOver && !s.ownerToken) return false;
  terminateAIWorker(roomId);

  const wantDouble =
    s.playMode === 'com' &&
    s.currentPlayer !== AI_PLAYER_ID &&
    s.undoSnapshots.length >= 3;

  if (wantDouble) {
    s.undoSnapshots.pop();
    s.undoSnapshots.pop();
  } else {
    if (s.undoSnapshots.length < 2) return false;
    s.undoSnapshots.pop();
  }

  const top = s.undoSnapshots[s.undoSnapshots.length - 1];
  if (!top) return false;
  applyUndoSnapshot(s, top);

  // 게임 종료 상태에서 무르기 시 종료 플래그 해제
  s.gameOver = false;
  s.winner = null;
  s.winType = null;

  armTurnTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
    void runAITurn(io, s.roomId);
  }
  return true;
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
  // dev: .mjs 부트스트랩이 tsx를 등록한 후 같은 폴더의 ai-worker.ts를 로드
  // prod: 번들된 index.js 옆(dist/)에 게임별 폴더로 빌드된 워커를 로드.
  //   ⚠ prod 에서는 이 파일이 dist/index.js 안에 번들되므로 dirname 이 dist/ 다.
  //   전에는 사중력 사목과 이 게임이 dist/ai-worker.js 하나를 공유해, 양면장기가
  //   사중력 사목 워커를 띄우고 매 수마다 죽었다(폴백 AI 로 대체되며 에러 도배).
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'double-sided-chess', 'ai-worker.js');
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

export function runDscWorkerSearch(roomId: string, workerData: AIWorkerData): Promise<AIMove> {
  return new Promise((resolve) => {
    const worker = getOrCreateAIWorker(roomId);

    let settled = false;
    const settle = (move: AIMove) => {
      if (settled) return;
      settled = true;
      resolve(move);
    };

    const fallback = () =>
      getQuickFallbackMove(workerData.board, workerData.prisoners, workerData.currentOwner);

    const onMessage = (move: AIMove) => {
      cleanup();
      settle(move);
    };
    const onError = (err: Error) => {
      console.error('[DSC AI Worker Error]', err);
      cleanup();
      terminateAIWorker(roomId);
      settle(fallback());
    };
    const onExit = (code: number) => {
      cleanup();
      if (!settled) {
        if (code !== 0 && gameStates.has(roomId)) {
          console.error(`[DSC AI Worker] exited unexpectedly with code ${code}`);
        }
        aiWorkerMap.delete(roomId);
        settle(fallback());
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

function runAIWithWorker(s: InternalState): Promise<AIMove> {
  return runDscWorkerSearch(s.roomId, {
    board: s.board,
    prisoners: { first: [...s.prisoners.first], second: [...s.prisoners.second] },
    currentOwner: s.currentOwner,
    useStrong: s.aiDifficulty === 'hard' || s.ownerToken !== null,
  });
}

export async function runAITurn(io: IO, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.currentPlayer !== AI_PLAYER_ID) return;

  const move = await runAIWithWorker(s);

  if (!gameStates.has(roomId)) return;
  if (s.currentPlayer !== AI_PLAYER_ID) return;

  await wait(randDelay());
  if (!gameStates.has(roomId)) return;
  if (s.currentPlayer !== AI_PLAYER_ID) return;

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

export function getDoubleSidedChessResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    winType: s.winType,
    finalBoard: s.board,
    prisoners: s.prisoners,
    actions: s.actionLog,
    players: {
      first: { nickname: s.firstPlayer.nickname },
      second: { nickname: s.secondPlayer.nickname },
    },
  };
}
