import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  GameResult,
} from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type {
  CellType,
  Direction,
  Phase,
  Position,
  FourGravityGameData,
  FourGravityPlayerInfo,
} from '@shared/types/four-gravity.js';

const BOARD_SIZE = 9;

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/* ────────────────────── constants ────────────────────── */

const AI_DELAY = { min: 500, max: 1000 };
const WIN_DISPLAY_MS = 2000;

/* ────────────────────── internal types ────────────────── */

interface InternalState {
  roomId: string;
  board: CellType[][];
  currentPlayer: string;
  currentColor: 'black' | 'white';
  phase: Phase;
  turnNumber: number;
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
  placedPosition: Position | null;
  movedPosition: Position | null;
  neutralCandidates: Position[];
  blackPlayer: FourGravityPlayerInfo;
  whitePlayer: FourGravityPlayerInfo;
  neutralCount: number;
  winner: string | null;
  winLine: Position[] | null;
  winType: 'black' | 'white' | 'neutral' | 'no-space' | null;
  startedAt: number;
  playMode: PlayMode;
  gameOver: boolean;
}

interface WinResult {
  winner: 'current' | 'opponent';
  type: 'black' | 'white' | 'neutral';
  line: Position[];
}

interface AIMove {
  place: Position;
  gravity: Direction;
  neutral: Position | null;
}

/* ────────────────────── state storage ────────────────── */

const gameStates = new Map<string, InternalState>();

/* endGame callback – set by game.ts to avoid circular imports */
type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings: GameResult['rankings'];
    totalTurns: number;
    gameResultData?: unknown;
  },
) => void;
let onEndGame: EndGameFn = () => {};

export function registerEndGameCallback(fn: EndGameFn) {
  onEndGame = fn;
}

/* ────────────────────── helpers ──────────────────────── */

function socketRoom(roomId: string) {
  return `room:${roomId}`;
}

function createEmptyBoard(): CellType[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 'empty' as CellType),
  );
}

function cloneBoard(board: CellType[][]): CellType[][] {
  return board.map((r) => [...r]);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

/* ────────────────────── gravity ──────────────────────── */

function applyGravity(board: CellType[][], direction: Direction): CellType[][] {
  if (direction === 'none') return cloneBoard(board);

  const out: CellType[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 'empty' as CellType),
  );

  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === 'neutral') out[r][c] = 'neutral';

  const isVertical = direction === 'up' || direction === 'down';
  const toEnd = direction === 'down' || direction === 'right';

  for (let major = 0; major < BOARD_SIZE; major++) {
    let minor = 0;
    while (minor < BOARD_SIZE) {
      const r0 = isVertical ? minor : major;
      const c0 = isVertical ? major : minor;
      if (board[r0][c0] === 'neutral') { minor++; continue; }

      const segStart = minor;
      while (minor < BOARD_SIZE) {
        const r = isVertical ? minor : major;
        const c = isVertical ? major : minor;
        if (board[r][c] === 'neutral') break;
        minor++;
      }
      const segEnd = minor;

      const stones: CellType[] = [];
      for (let m = segStart; m < segEnd; m++) {
        const r = isVertical ? m : major;
        const c = isVertical ? major : m;
        if (board[r][c] !== 'empty') stones.push(board[r][c]);
      }

      if (toEnd) stones.reverse();

      let si = 0;
      const start = toEnd ? segEnd - 1 : segStart;
      const step = toEnd ? -1 : 1;
      for (let m = start; toEnd ? m >= segStart : m < segEnd; m += step) {
        if (si >= stones.length) break;
        const r = isVertical ? m : major;
        const c = isVertical ? major : m;
        out[r][c] = stones[si++];
      }
    }
  }

  return out;
}

function findMovedPosition(
  placedPos: Position,
  direction: Direction,
  boardBefore: CellType[][],
  boardAfter: CellType[][],
): Position {
  if (direction === 'none') return placedPos;

  const { row, col } = placedPos;
  const isVertical = direction === 'up' || direction === 'down';

  if (isVertical) {
    let idx = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (r === row) break;
      if (boardBefore[r][col] !== 'empty' && boardBefore[r][col] !== 'neutral') idx++;
    }
    let cnt = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (boardAfter[r][col] !== 'empty' && boardAfter[r][col] !== 'neutral') {
        if (cnt === idx) return { row: r, col };
        cnt++;
      }
    }
  } else {
    let idx = 0;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c === col) break;
      if (boardBefore[row][c] !== 'empty' && boardBefore[row][c] !== 'neutral') idx++;
    }
    let cnt = 0;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (boardAfter[row][c] !== 'empty' && boardAfter[row][c] !== 'neutral') {
        if (cnt === idx) return { row, col: c };
        cnt++;
      }
    }
  }

  return placedPos;
}

/* ────────────────────── neutral path ─────────────────── */

function calcNeutralCandidates(
  placedPos: Position,
  movedPos: Position,
  board: CellType[][],
): Position[] {
  if (placedPos.row === movedPos.row && placedPos.col === movedPos.col) return [];

  const candidates: Position[] = [];

  if (placedPos.col === movedPos.col) {
    const c = placedPos.col;
    const lo = Math.min(placedPos.row, movedPos.row);
    const hi = Math.max(placedPos.row, movedPos.row);
    for (let r = lo + 1; r < hi; r++) {
      if (board[r][c] === 'empty') candidates.push({ row: r, col: c });
    }
  } else {
    const r = placedPos.row;
    const lo = Math.min(placedPos.col, movedPos.col);
    const hi = Math.max(placedPos.col, movedPos.col);
    for (let c = lo + 1; c < hi; c++) {
      if (board[r][c] === 'empty') candidates.push({ row: r, col: c });
    }
  }

  return candidates;
}

/* ────────────────────── win detection ────────────────── */

const DIRS_4 = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

function findExactFour(board: CellType[][], type: CellType): Position[] | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== type) continue;

      for (const [dr, dc] of DIRS_4) {
        const pr = r - dr;
        const pc = c - dc;
        if (
          pr >= 0 && pr < BOARD_SIZE &&
          pc >= 0 && pc < BOARD_SIZE &&
          board[pr][pc] === type
        ) continue;

        const line: Position[] = [];
        let nr = r;
        let nc = c;
        while (
          nr >= 0 && nr < BOARD_SIZE &&
          nc >= 0 && nc < BOARD_SIZE &&
          board[nr][nc] === type
        ) {
          line.push({ row: nr, col: nc });
          nr += dr;
          nc += dc;
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

function checkWin(board: CellType[][], currentColor: 'black' | 'white'): WinResult | null {
  const oppColor: CellType = currentColor === 'black' ? 'white' : 'black';

  const myFour = findExactFour(board, currentColor);
  if (myFour) return { winner: 'current', type: currentColor, line: myFour };

  const neutralFour = findExactFour(board, 'neutral');
  if (neutralFour) return { winner: 'current', type: 'neutral', line: neutralFour };

  const oppFour = findExactFour(board, oppColor);
  if (oppFour) return { winner: 'opponent', type: oppColor as 'black' | 'white', line: oppFour };

  return null;
}

function hasEmptyCells(board: CellType[][]): boolean {
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === 'empty') return true;
  return false;
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
    return s.winType === 'no-space'
      ? '둘 곳이 없어 게임이 종료되었습니다.'
      : '사목이 완성되어 게임이 종료되었습니다.';
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

function broadcastState(io: IO, s: InternalState) {
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

/* ────────────────────── win / no-space handling ──────── */

function handleWin(io: IO, s: InternalState, wr: WinResult) {
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
    const payload = {
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
    gameStates.delete(roomId);
    onEndGame(io, roomId, payload);
  }, WIN_DISPLAY_MS);
}

function handleNoSpace(io: IO, s: InternalState) {
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
    const payload = {
      rankings: [
        { playerId: winnerId, nickname: winnerNick, rank: 1, score: 1 },
        { playerId: loserId, nickname: loserNick, rank: 2, score: 0 },
      ],
      totalTurns: s.turnNumber,
      gameResultData: {
        winType: 'no-space',
        finalBoard: s.board,
        blackStones: s.blackPlayer.stoneCount,
        whiteStones: s.whitePlayer.stoneCount,
        neutralStones: s.neutralCount,
      },
    };
    gameStates.delete(roomId);
    onEndGame(io, roomId, payload);
  }, WIN_DISPLAY_MS);
}

/* ────────────────────── turn management ──────────────── */

function finishTurn(io: IO, s: InternalState) {
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

/* ────────────────────── public API ───────────────────── */

export function initFourGravity(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
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

  const state: InternalState = {
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
  };

  gameStates.set(roomId, state);
  broadcastState(io, state);
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
      const row = data.row as number;
      const col = data.col as number;
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
      if (s.board[row][col] !== 'empty') {
        socket.emit('error', { message: '이미 돌이 있는 칸입니다.' });
        return;
      }
      s.board[row][col] = s.currentColor;
      s.placedPosition = { row, col };
      if (s.currentColor === 'black') s.blackPlayer.stoneCount++;
      else s.whitePlayer.stoneCount++;
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
        finishTurn(io, s);
        return;
      }

      const boardBefore = cloneBoard(s.board);
      s.board = applyGravity(s.board, dir);
      if (s.currentColor === 'black') s.lastGravityBlack = dir;
      else s.lastGravityWhite = dir;

      const movedPos = findMovedPosition(s.placedPosition!, dir, boardBefore, s.board);
      s.movedPosition = movedPos;

      const wr = checkWin(s.board, s.currentColor);
      if (wr) { handleWin(io, s, wr); return; }

      const cands = calcNeutralCandidates(s.placedPosition!, movedPos, s.board);
      s.neutralCandidates = cands;

      if (cands.length === 0) {
        finishTurn(io, s);
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
      const row = data.row as number;
      const col = data.col as number;
      if (!s.neutralCandidates.some((p) => p.row === row && p.col === col)) {
        socket.emit('error', { message: '이 위치에는 중립 돌을 놓을 수 없습니다.' });
        return;
      }
      s.board[row][col] = 'neutral';
      s.neutralCount++;
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

/* ═══════════════════════════════════════════════════════ *
 *  AI  –  Minimax + Alpha-Beta Pruning                  *
 * ═══════════════════════════════════════════════════════ */

function getValidDirections(lastGravity: Direction | null): Direction[] {
  const all: Direction[] = ['up', 'down', 'left', 'right', 'none'];
  if (lastGravity === null) return all;
  return all.filter((d) => d !== lastGravity);
}

function getCandidateCells(board: CellType[][]): Position[] {
  const near = new Set<string>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 'empty') continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 'empty') {
            near.add(`${nr},${nc}`);
          }
        }
      }
    }
  }

  // 돌이 하나도 없으면 중앙만 반환
  if (near.size === 0) {
    const mid = Math.floor(BOARD_SIZE / 2);
    return [{ row: mid, col: mid }];
  }

  return Array.from(near).map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { row: r, col: c };
  });
}

/* evaluation */

function evaluate(board: CellType[][], aiColor: 'black' | 'white'): number {
  const oppColor: CellType = aiColor === 'black' ? 'white' : 'black';
  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell === 'empty') continue;

      for (const [dr, dc] of DIRS_4) {
        const pr = r - dr;
        const pc = c - dc;
        if (pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE && board[pr][pc] === cell)
          continue;

        let len = 0;
        let nr = r;
        let nc = c;
        while (
          nr >= 0 && nr < BOARD_SIZE &&
          nc >= 0 && nc < BOARD_SIZE &&
          board[nr][nc] === cell
        ) {
          len++;
          nr += dr;
          nc += dc;
        }

        if (len >= 5) continue;

        const endOpen =
          nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 'empty';
        const startOpen =
          pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE && board[pr][pc] === 'empty';

        if (cell === aiColor) {
          if (len === 4) score += 100_000;
          else if (len === 3) score += startOpen && endOpen ? 1000 : startOpen || endOpen ? 100 : 0;
          else if (len === 2) score += 10;
        } else if (cell === oppColor) {
          if (len === 4) score -= 150_000;
          else if (len === 3) score -= startOpen && endOpen ? 1200 : startOpen || endOpen ? 120 : 0;
          else if (len === 2) score -= 10;
        } else {
          // 중립돌 연속: 다음 턴에 누구든 neutral 4목을 완성할 수 있는 위협
          // 이미 3연속이면 상대(인간)가 즉시 이길 수 있으므로 AI에게 큰 손해
          if (len === 3) score -= 8000;
          else if (len === 2) score -= 50;
        }
      }
    }
  }

  const mid = Math.floor(BOARD_SIZE / 2);
  for (let r = mid - 1; r <= mid + 1; r++)
    for (let c = mid - 1; c <= mid + 1; c++) {
      if (board[r][c] === aiColor) score += 5;
      else if (board[r][c] === oppColor) score -= 5;
    }

  return score;
}

/* minimax */

function minimax(
  board: CellType[][],
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  lastGravBlack: Direction | null,
  lastGravWhite: Direction | null,
  aiColor: 'black' | 'white',
): number {
  const curColor: 'black' | 'white' = isMax ? aiColor : (aiColor === 'black' ? 'white' : 'black');
  const curLastGrav = curColor === 'black' ? lastGravBlack : lastGravWhite;

  const wr = checkWin(board, curColor);
  if (wr) {
    const val = 100_000 + depth * 100;
    if (wr.winner === 'current') return isMax ? val : -val;
    return isMax ? -val : val;
  }
  if (!hasEmptyCells(board)) {
    return isMax ? (100_000 + depth * 100) : -(100_000 + depth * 100);
  }
  if (depth === 0) return evaluate(board, aiColor);

  let best = isMax ? -Infinity : Infinity;
  const cells = getCandidateCells(board);
  const dirs = getValidDirections(curLastGrav);

  for (const cell of cells) {
    if (board[cell.row][cell.col] !== 'empty') continue;

    for (const dir of dirs) {
      const b1 = cloneBoard(board);
      b1[cell.row][cell.col] = curColor;
      const b2 = applyGravity(b1, dir);

      const newLastGravBlack = curColor === 'black' ? dir : lastGravBlack;
      const newLastGravWhite = curColor === 'white' ? dir : lastGravWhite;

      const gw = checkWin(b2, curColor);
      if (gw) {
        const val = 100_000 + depth * 100;
        const s = gw.winner === 'current' ? (isMax ? val : -val) : (isMax ? -val : val);
        if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
        else { best = Math.min(best, s); beta = Math.min(beta, best); }
        if (beta <= alpha) return best;
        continue;
      }

      const mp = dir === 'none' ? cell : findMovedPosition(cell, dir, b1, b2);
      const ncands = dir === 'none' ? [] : calcNeutralCandidates(cell, mp, b2);

      if (ncands.length === 0) {
        const s = minimax(b2, depth - 1, alpha, beta, !isMax, newLastGravBlack, newLastGravWhite, aiColor);
        if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
        else { best = Math.min(best, s); beta = Math.min(beta, best); }
        if (beta <= alpha) return best;
      } else {
        for (const nc of ncands) {
          const bn = cloneBoard(b2);
          bn[nc.row][nc.col] = 'neutral';

          // 중립돌을 놓자마자 중립 4목이 완성되면 → 현재 플레이어(neutral을 놓은 쪽) 승리
          if (findExactFour(bn, 'neutral') !== null) {
            const val = 100_000 + depth * 100;
            const s = isMax ? val : -val;
            if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
            else { best = Math.min(best, s); beta = Math.min(beta, best); }
            if (beta <= alpha) return best;
            continue;
          }

          const s = minimax(bn, depth - 1, alpha, beta, !isMax, newLastGravBlack, newLastGravWhite, aiColor);
          if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
          else { best = Math.min(best, s); beta = Math.min(beta, best); }
          if (beta <= alpha) return best;
        }
      }
    }
    if (beta <= alpha) return best;
  }

  return best;
}

/* best-move search */

function findBestMove(s: InternalState): AIMove {
  const aiColor = s.currentColor; // AI is always white
  const board = s.board;
  const lastGravBlack = s.lastGravityBlack;
  const lastGravWhite = s.lastGravityWhite; // AI's own restriction
  const cells = getCandidateCells(board);
  const dirs = getValidDirections(lastGravWhite);

  let bestMove: AIMove = { place: cells[0] ?? { row: 4, col: 4 }, gravity: 'none', neutral: null };
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const cell of cells) {
    if (board[cell.row][cell.col] !== 'empty') continue;

    for (const dir of dirs) {
      const b1 = cloneBoard(board);
      b1[cell.row][cell.col] = aiColor;
      const b2 = applyGravity(b1, dir);

      // After AI (white) chooses dir, human (black) is next with lastGravBlack restriction
      const newLastGravWhite = dir;

      const gw = checkWin(b2, aiColor);
      if (gw && gw.winner === 'current') {
        return { place: cell, gravity: dir, neutral: null };
      }

      const mp = dir === 'none' ? cell : findMovedPosition(cell, dir, b1, b2);
      const ncands = dir === 'none' ? [] : calcNeutralCandidates(cell, mp, b2);

      if (ncands.length === 0) {
        const sc = minimax(b2, 2, alpha, beta, false, lastGravBlack, newLastGravWhite, aiColor);
        if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: null }; }
        alpha = Math.max(alpha, sc);
      } else {
        for (const nc of ncands) {
          const bn = cloneBoard(b2);
          bn[nc.row][nc.col] = 'neutral';

          const nw = checkWin(bn, aiColor);
          if (nw && nw.winner === 'current') {
            return { place: cell, gravity: dir, neutral: nc };
          }

          // AI가 neutral stone을 놓아 중립 4목이 완성되면 즉시 승리
          if (findExactFour(bn, 'neutral') !== null) {
            return { place: cell, gravity: dir, neutral: nc };
          }

          const sc = minimax(bn, 2, alpha, beta, false, lastGravBlack, newLastGravWhite, aiColor);
          if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: nc }; }
          alpha = Math.max(alpha, sc);
        }
      }
    }
  }

  return bestMove;
}

/* run AI turn (async, with delays for UX) */

async function runAITurn(io: IO, roomId: string) {
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
    finishTurn(io, s);
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
