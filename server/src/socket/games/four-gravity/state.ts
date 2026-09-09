import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import type { GameState } from '@shared/types/events.js';
import type { FourGravityGameData } from '@shared/types/four-gravity.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { AI_DELAY, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, WinResult, FourGravityUndoSnapshot } from './types.js';
import { cloneBoard, applyGravity, findMovedPosition, calcNeutralCandidates } from './board.js';
import { checkWin, hasEmptyCells } from './win.js';
import { getCandidateCells, getValidDirections, findBestMoveIterative, type AIWorkerData } from './ai.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { extname, dirname, join } from 'path';
import { socketRoom } from '../../utils.js';
import { sessions } from '../../../store/sessions.js';
import { getActiveSkin } from '../../skins.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { tutorialHint } from './tutorial.js';

export const gameStates = new Map<string, InternalState>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

/* ────────────────────── broadcasting ─────────────────── */

export function toGameData(s: InternalState, viewerToken: string): FourGravityGameData {
  const maskNick = (id: string, nick: string) =>
    nicknameForViewer(s.roomId, id, nick, viewerToken);
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
      black: { ...s.blackPlayer, nickname: maskNick(s.blackPlayer.id, s.blackPlayer.nickname) },
      white: { ...s.whitePlayer, nickname: maskNick(s.whitePlayer.id, s.whitePlayer.nickname) },
    },
    neutralCount: s.neutralCount,
    winner: s.winner,
    winLine: s.winLine,
    winType: s.winType,
    tutorial: tutorialHint(s),
  };
}

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    if (s.winType === 'timeout') return '시간 초과로 게임이 종료되었습니다.';
    if (s.winType === 'no-space') return '둘 곳이 없어 게임이 종료되었습니다.';
    if (s.winType === 'no-neutral') return '중립 돌을 놓을 수 없어 게임이 종료되었습니다.';
    return '사목이 완성되어 게임이 종료되었습니다.';
  }
  const isAI = s.currentPlayer === AI_PLAYER_ID;
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
      winLine: s.winLine,
      finalBoard: s.board,
      blackStones: s.blackPlayer.stoneCount,
      whiteStones: s.whitePlayer.stoneCount,
      neutralStones: s.neutralCount,
      actions: s.actionLog,
      players: {
        black: { nickname: s.blackPlayer.nickname },
        white: { nickname: s.whitePlayer.nickname },
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

function resolveGame(
  io: IO,
  s: InternalState,
  opts: {
    winnerId: string;
    loserId: string;
    winType: InternalState['winType'];
    winLine?: InternalState['winLine'];
  },
) {
  const winnerNick = opts.winnerId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;
  const loserNick = opts.loserId === s.blackPlayer.id ? s.blackPlayer.nickname : s.whitePlayer.nickname;

  s.winner = opts.winnerId;
  s.winLine = opts.winLine ?? null;
  s.winType = opts.winType;
  s.gameOver = true;
  s.phase = 'waiting';
  broadcastState(io, s);

  scheduleGameEnd(io, s, buildEndPayload(s, opts.winnerId, winnerNick, opts.loserId, loserNick));
}

function getWinnerLoser(s: InternalState, currentIsWinner: boolean) {
  const winnerId = currentIsWinner
    ? (s.currentColor === 'black' ? s.blackPlayer.id : s.whitePlayer.id)
    : (s.currentColor === 'black' ? s.whitePlayer.id : s.blackPlayer.id);
  const loserId = winnerId === s.blackPlayer.id ? s.whitePlayer.id : s.blackPlayer.id;
  return { winnerId, loserId };
}

/* ────────────────────── turn timer ─────────────────────── */

export function clearTurnTimer(s: InternalState) {
  if (s.turnTimer) {
    clearTimeout(s.turnTimer);
    s.turnTimer = null;
  }
}

function cloneUndoSnapshot(s: InternalState): FourGravityUndoSnapshot {
  return {
    board: s.board.map((r) => [...r]),
    currentPlayer: s.currentPlayer,
    currentColor: s.currentColor,
    phase: s.phase,
    turnNumber: s.turnNumber,
    lastGravityBlack: s.lastGravityBlack,
    lastGravityWhite: s.lastGravityWhite,
    placedPosition: s.placedPosition ? { ...s.placedPosition } : null,
    movedPosition: s.movedPosition ? { ...s.movedPosition } : null,
    neutralCandidates: s.neutralCandidates.map((p) => ({ ...p })),
    blackPlayer: { ...s.blackPlayer },
    whitePlayer: { ...s.whitePlayer },
    neutralCount: s.neutralCount,
    winner: s.winner,
    winLine: s.winLine ? s.winLine.map((p) => ({ ...p })) : null,
    winType: s.winType,
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as InternalState['actionLog'],
  };
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push(cloneUndoSnapshot(s));
}

function applyUndoSnapshot(s: InternalState, snap: FourGravityUndoSnapshot) {
  s.board = snap.board.map((r) => [...r]);
  s.currentPlayer = snap.currentPlayer;
  s.currentColor = snap.currentColor;
  s.phase = snap.phase;
  s.turnNumber = snap.turnNumber;
  s.lastGravityBlack = snap.lastGravityBlack;
  s.lastGravityWhite = snap.lastGravityWhite;
  s.placedPosition = snap.placedPosition ? { ...snap.placedPosition } : null;
  s.movedPosition = snap.movedPosition ? { ...snap.movedPosition } : null;
  s.neutralCandidates = snap.neutralCandidates.map((p) => ({ ...p }));
  s.blackPlayer = { ...snap.blackPlayer };
  s.whitePlayer = { ...snap.whitePlayer };
  s.neutralCount = snap.neutralCount;
  s.winner = snap.winner;
  s.winLine = snap.winLine ? snap.winLine.map((p) => ({ ...p })) : null;
  s.winType = snap.winType;
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as InternalState['actionLog'];
}

export function hasPartialTurnFourGravity(s: InternalState): boolean {
  if (s.phase !== 'place') return true;
  const last = s.actionLog[s.actionLog.length - 1];
  return !!(last && last.turnNumber === s.turnNumber);
}

export function armTurnTimer(io: IO, s: InternalState) {
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
  const { winnerId, loserId } = getWinnerLoser(s, false);
  resolveGame(io, s, { winnerId, loserId, winType: 'timeout' });
}

export function handleWin(io: IO, s: InternalState, wr: WinResult) {
  clearTurnTimer(s);
  const { winnerId, loserId } = getWinnerLoser(s, wr.winner === 'current');
  resolveGame(io, s, { winnerId, loserId, winType: wr.type, winLine: wr.line });
}

export function handleNoNeutral(io: IO, s: InternalState) {
  clearTurnTimer(s);
  const { winnerId, loserId } = getWinnerLoser(s, false);
  resolveGame(io, s, { winnerId, loserId, winType: 'no-neutral' });
}

export function handleNoSpace(io: IO, s: InternalState) {
  clearTurnTimer(s);
  const { winnerId, loserId } = getWinnerLoser(s, true);
  resolveGame(io, s, { winnerId, loserId, winType: 'no-space' });
}

/* ────────────────────── turn management ──────────────── */

export function finishTurn(io: IO, s: InternalState) {
  clearTurnTimer(s);
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

  startTurnTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
    runAITurn(io, s.roomId);
  }
}

export function performFourGravityUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s) return false;
  if (s.gameOver && !s.ownerToken) return false;

  terminateAIWorker(roomId);

  const wasGameOver = s.gameOver;

  const partial = hasPartialTurnFourGravity(s);
  if (partial) {
    if (s.undoSnapshots.length < 1) return false;
    applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    if (wasGameOver) s.gameOver = false;
    armTurnTimer(io, s);
    broadcastState(io, s);
    if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
      void runAITurn(io, roomId);
    }
    return true;
  }

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
  if (wasGameOver) s.gameOver = false;
  armTurnTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com' && s.currentPlayer === AI_PLAYER_ID) {
    void runAITurn(io, roomId);
  }
  return true;
}

/* ────────────────────── AI turn runner ───────────────── */

function getQuickFallbackMove(s: InternalState) {
  const cells = getCandidateCells(s.board);
  const lastGrav = s.currentColor === 'black' ? s.lastGravityBlack : s.lastGravityWhite;
  const dirs = getValidDirections(lastGrav);

  // 안전한 수를 찾아 반환: no-neutral 자폭이 없는 첫 번째 (cell, dir) 조합
  for (const cell of cells) {
    if (s.board[cell.row][cell.col] !== 'empty') continue;
    for (const dir of dirs) {
      if (dir === 'none') {
        return { place: cell, gravity: 'none' as const, neutral: null };
      }
      const b1 = cloneBoard(s.board);
      b1[cell.row][cell.col] = s.currentColor;
      const b2 = applyGravity(b1, dir);
      const mp = findMovedPosition(cell, dir, b1, b2);
      const ncands = calcNeutralCandidates(cell, mp, b2);
      if (ncands.length > 0) {
        return { place: cell, gravity: dir, neutral: ncands[0] };
      }
    }
  }

  // 최후 수단: 중앙에 'none' (또는 첫 번째 방향)
  const center = { row: 4, col: 4 };
  const safeDir = dirs.find(d => d === 'none') ?? dirs[0] ?? 'none';
  return { place: center, gravity: safeDir, neutral: null };
}


/* ── 퍼시스턴트 워커 풀 (룸당 1개 유지, 게임 종료 시 terminate) ── */

const aiWorkerMap = new Map<string, Worker>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  // dev: .mjs 부트스트랩이 tsx를 등록한 후 같은 폴더의 ai-worker.ts를 로드
  // prod: 번들된 index.js 옆(dist/)에 게임별 폴더로 빌드된 워커를 로드.
  //   ⚠ prod 에서는 이 파일이 dist/index.js 안에 번들되므로 dirname 이 dist/ 다.
  //   게임마다 폴더를 나누지 않으면 워커 두 개가 dist/ai-worker.js 하나를 두고
  //   충돌해, 한쪽 게임이 다른 게임의 워커를 띄우게 된다.
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'four-gravity', 'ai-worker.js');
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

function runAIWithWorker(s: InternalState): Promise<ReturnType<typeof findBestMoveIterative>> {
  const workerData: AIWorkerData = {
    board: s.board,
    currentColor: s.currentColor,
    lastGravityBlack: s.lastGravityBlack,
    lastGravityWhite: s.lastGravityWhite,
    useStrong: s.aiDifficulty === 'hard' || s.ownerToken !== null,
  };

  return new Promise((resolve) => {
    const worker = getOrCreateAIWorker(s.roomId);

    let settled = false;
    const settle = (move: ReturnType<typeof findBestMoveIterative>) => {
      if (settled) return;
      settled = true;
      resolve(move);
    };

    const onMessage = (move: ReturnType<typeof findBestMoveIterative>) => {
      cleanup();
      settle(move);
    };
    const onError = (err: Error) => {
      console.error('[AI Worker Error]', err);
      cleanup();
      terminateAIWorker(s.roomId);
      settle(getQuickFallbackMove(s));
    };
    const onExit = (code: number) => {
      cleanup();
      if (!settled) {
        if (code !== 0 && gameStates.has(s.roomId)) {
          console.error(`[AI Worker] exited unexpectedly with code ${code}`);
        }
        aiWorkerMap.delete(s.roomId);
        settle(getQuickFallbackMove(s));
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
  if (s.currentPlayer !== AI_PLAYER_ID) return;

  /* ① place */
  await wait(randDelay());
  if (!gameStates.has(roomId)) return;
  if (s.currentPlayer !== AI_PLAYER_ID) return;

  s.board[move.place.row][move.place.col] = s.currentColor;
  s.placedPosition = move.place;
  if (s.currentColor === 'black') s.blackPlayer.stoneCount++;
  else s.whitePlayer.stoneCount++;
  s.actionLog.push({
    turnNumber: s.turnNumber,
    color: s.currentColor,
    nickname: s.currentColor === 'black' ? s.blackPlayer.nickname : s.whitePlayer.nickname,
    steps: [{ type: 'place', row: move.place.row, col: move.place.col }],
  });
  s.phase = 'gravity';
  broadcastState(io, s);

  /* ② gravity */
  await wait(randDelay());
  if (!gameStates.has(roomId)) return;
  if (s.currentPlayer !== AI_PLAYER_ID) return;

  if (move.gravity === 'none') {
    if (s.currentColor === 'black') s.lastGravityBlack = 'none';
    else s.lastGravityWhite = 'none';
    s.movedPosition = s.placedPosition;
    s.neutralCandidates = [];
    const aiLog = s.actionLog[s.actionLog.length - 1];
    if (aiLog) aiLog.steps.push({ type: 'gravity', direction: 'none' });
    finishTurn(io, s);
    return;
  }

  const boardBefore = cloneBoard(s.board);
  s.board = applyGravity(s.board, move.gravity);
  if (s.currentColor === 'black') s.lastGravityBlack = move.gravity;
  else s.lastGravityWhite = move.gravity;
  s.movedPosition = findMovedPosition(s.placedPosition!, move.gravity, boardBefore, s.board);

  const aiGLog = s.actionLog[s.actionLog.length - 1];
  if (aiGLog) aiGLog.steps.push({ type: 'gravity', direction: move.gravity });

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
  if (s.currentPlayer !== AI_PLAYER_ID) return;

  const neutralPos = move.neutral ?? cands[0];
  s.board[neutralPos.row][neutralPos.col] = 'neutral';
  s.neutralCount++;
  const aiNLog = s.actionLog[s.actionLog.length - 1];
  if (aiNLog) aiNLog.steps.push({ type: 'neutral', row: neutralPos.row, col: neutralPos.col });
  finishTurn(io, s);
}

export function getFourGravityResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    winType: s.winType,
    winLine: s.winLine,
    finalBoard: s.board,
    blackStones: s.blackPlayer.stoneCount,
    whiteStones: s.whitePlayer.stoneCount,
    neutralStones: s.neutralCount,
    actions: s.actionLog,
    players: {
      black: { nickname: s.blackPlayer.nickname },
      white: { nickname: s.whitePlayer.nickname },
    },
  };
}
