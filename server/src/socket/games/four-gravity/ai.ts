import { BOARD_SIZE, DIRS_4 } from './constants.js';
import type { CellType, Direction, Position, AIMove } from './types.js';
import { cloneBoard, applyGravity, findMovedPosition, calcNeutralCandidates } from './board.js';
import { findExactFour, checkWin, hasEmptyCells } from './win.js';

export function getValidDirections(lastGravity: Direction | null): Direction[] {
  const all: Direction[] = ['up', 'down', 'left', 'right', 'none'];
  if (lastGravity === null) return all;
  return all.filter((d) => d !== lastGravity);
}

export function getCandidateCells(board: CellType[][]): Position[] {
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

  if (near.size === 0) {
    const mid = Math.floor(BOARD_SIZE / 2);
    return [{ row: mid, col: mid }];
  }

  return Array.from(near).map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { row: r, col: c };
  });
}

/** 슈퍼 AI 후보: 기존 ±2 + 같은 행/열에서 돌 bounding box 바깥 빈칸. */
export function getCandidateCellsSuper(board: CellType[][]): Position[] {
  const keys = new Set<string>();
  const out: Position[] = [];
  function add(r: number, c: number) {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
    if (board[r][c] !== 'empty') return;
    const k = `${r},${c}`;
    if (keys.has(k)) return;
    keys.add(k);
    out.push({ row: r, col: c });
  }
  for (const p of getCandidateCells(board)) add(p.row, p.col);

  for (let r = 0; r < BOARD_SIZE; r++) {
    let black = 0;
    let white = 0;
    let minC = BOARD_SIZE;
    let maxC = -1;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell !== 'black' && cell !== 'white') continue;
      if (cell === 'black') black++;
      else white++;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    if (black >= 2 || white >= 2) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c < minC || c > maxC) add(r, c);
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let black = 0;
    let white = 0;
    let minR = BOARD_SIZE;
    let maxR = -1;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const cell = board[r][c];
      if (cell !== 'black' && cell !== 'white') continue;
      if (cell === 'black') black++;
      else white++;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
    if (black >= 2 || white >= 2) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        if (r < minR || r > maxR) add(r, c);
      }
    }
  }
  return out.length > 0 ? out : getCandidateCells(board);
}

export function evaluate(board: CellType[][], aiColor: 'black' | 'white'): number {
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

        if (len >= 5) {
          // 5개 이상 연속은 정확히 4목 승리 불가 (findExactFour는 exactly 4만 인정)
          if (cell === aiColor) score -= 200;
          else if (cell === oppColor) score += 100;
          continue;
        }

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

/* ──────────────────────────────────────────────────────────────
   Iterative Deepening with Timeout
   - 각 depth를 완료하면 최선의 수를 갱신
   - 시간 초과 시 즉시 중단하고 마지막 완료 depth의 수를 반환
────────────────────────────────────────────────────────────── */

export interface AIWorkerData {
  board: CellType[][];
  currentColor: 'black' | 'white';
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
  /** 천하 솔로 토글만 강한 엔진을 켠다. COM은 항상 false. */
  useStrong?: boolean;
  useSuper?: boolean;
  /** 있으면 워커 기본 5s 대신 이 예산(ms)을 쓴다. 슈퍼 AI는 넘기지 않는다. */
  timeLimitMs?: number;
}

// 모듈 레벨 타임아웃 플래그 (워커 인스턴스당 하나이므로 동시성 안전)
let _timedOut = false;
let _deadline = Infinity;

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
  if (_timedOut) return 0;
  if (Date.now() >= _deadline) { _timedOut = true; return 0; }

  const curColor: 'black' | 'white' = isMax ? aiColor : (aiColor === 'black' ? 'white' : 'black');
  const curLastGrav = curColor === 'black' ? lastGravBlack : lastGravWhite;

  const wr = checkWin(board, curColor);
  if (wr) {
    const val = 100_000 + depth * 100;
    if (wr.winner === 'current') return isMax ? val : -val;
    return isMax ? -val : val;
  }
  if (!hasEmptyCells(board)) {
    return isMax ? -(100_000 + depth * 100) : (100_000 + depth * 100);
  }
  if (depth === 0) return evaluate(board, aiColor);

  let best = isMax ? -Infinity : Infinity;
  const cells = getCandidateCells(board);
  const dirs = getValidDirections(curLastGrav);

  for (const cell of cells) {
    if (_timedOut) return best;
    if (board[cell.row][cell.col] !== 'empty') continue;

    for (const dir of dirs) {
      if (_timedOut) return best;
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

      if (dir !== 'none' && ncands.length === 0) {
        const val = 100_000 + depth * 100;
        const s = isMax ? -val : val;
        if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
        else { best = Math.min(best, s); beta = Math.min(beta, best); }
        if (beta <= alpha) return best;
      } else if (ncands.length === 0) {
        const s = minimax(b2, depth - 1, alpha, beta, !isMax, newLastGravBlack, newLastGravWhite, aiColor);
        if (_timedOut) return best;
        if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
        else { best = Math.min(best, s); beta = Math.min(beta, best); }
        if (beta <= alpha) return best;
      } else {
        for (const nc of ncands) {
          if (_timedOut) return best;
          const bn = cloneBoard(b2);
          bn[nc.row][nc.col] = 'neutral';

          if (findExactFour(bn, 'neutral') !== null) {
            const val = 100_000 + depth * 100;
            const s = isMax ? val : -val;
            if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
            else { best = Math.min(best, s); beta = Math.min(beta, best); }
            if (beta <= alpha) return best;
            continue;
          }

          const s = minimax(bn, depth - 1, alpha, beta, !isMax, newLastGravBlack, newLastGravWhite, aiColor);
          if (_timedOut) return best;
          if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
          else { best = Math.min(best, s); beta = Math.min(beta, best); }
          if (beta <= alpha) return best;
        }
      }
    }
    if (_timedOut) return best;
    if (beta <= alpha) return best;
  }

  return best;
}

function findBestMoveAtDepth(
  board: CellType[][],
  aiColor: 'black' | 'white',
  lastGravBlack: Direction | null,
  lastGravWhite: Direction | null,
  depth: number,
): AIMove | null {
  const cells = getCandidateCells(board);
  const lastGrav = aiColor === 'black' ? lastGravBlack : lastGravWhite;
  const dirs = getValidDirections(lastGrav);

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const cell of cells) {
    if (_timedOut) return bestMove;
    if (board[cell.row][cell.col] !== 'empty') continue;

    for (const dir of dirs) {
      if (_timedOut) return bestMove;

      const b1 = cloneBoard(board);
      b1[cell.row][cell.col] = aiColor;
      const b2 = applyGravity(b1, dir);

      const newLastGravBlack = aiColor === 'black' ? dir : lastGravBlack;
      const newLastGravWhite = aiColor === 'white' ? dir : lastGravWhite;

      const gw = checkWin(b2, aiColor);
      if (gw && gw.winner === 'current') {
        return { place: cell, gravity: dir, neutral: null };
      }

      const mp = dir === 'none' ? cell : findMovedPosition(cell, dir, b1, b2);
      const ncands = dir === 'none' ? [] : calcNeutralCandidates(cell, mp, b2);

      if (dir !== 'none' && ncands.length === 0) {
        const sc = -200_000;
        if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: null }; }
        alpha = Math.max(alpha, sc);
      } else if (ncands.length === 0) {
        const sc = minimax(b2, depth, alpha, beta, false, newLastGravBlack, newLastGravWhite, aiColor);
        if (_timedOut) return bestMove;
        if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: null }; }
        alpha = Math.max(alpha, sc);
      } else {
        for (const nc of ncands) {
          if (_timedOut) return bestMove;
          const bn = cloneBoard(b2);
          bn[nc.row][nc.col] = 'neutral';

          const nw = checkWin(bn, aiColor);
          if (nw && nw.winner === 'current') {
            return { place: cell, gravity: dir, neutral: nc };
          }
          if (findExactFour(bn, 'neutral') !== null) {
            return { place: cell, gravity: dir, neutral: nc };
          }

          const sc = minimax(bn, depth, alpha, beta, false, newLastGravBlack, newLastGravWhite, aiColor);
          if (_timedOut) return bestMove;
          if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: nc }; }
          alpha = Math.max(alpha, sc);
        }
      }
    }
  }

  return bestMove;
}

export function findBestMoveIterative(data: AIWorkerData, timeLimitMs: number): AIMove {
  _deadline = Date.now() + timeLimitMs;
  _timedOut = false;

  const { board, currentColor: aiColor, lastGravityBlack, lastGravityWhite } = data;

  // 기본 수: 첫 번째 유효한 빈 칸
  const cells = getCandidateCells(board);
  const lastGrav = aiColor === 'black' ? lastGravityBlack : lastGravityWhite;
  const dirs = getValidDirections(lastGrav);
  const firstCell = cells.find(c => board[c.row][c.col] === 'empty') ?? { row: 4, col: 4 };
  const firstDir = dirs[0] ?? 'none';
  let bestMove: AIMove = { place: firstCell, gravity: firstDir, neutral: null };

  // Iterative Deepening: depth 1부터 시간 내에 가능한 만큼 탐색
  for (let depth = 1; depth <= 20; depth++) {
    if (Date.now() >= _deadline) break;
    _timedOut = false;
    const result = findBestMoveAtDepth(board, aiColor, lastGravityBlack, lastGravityWhite, depth);
    if (result !== null && !_timedOut) bestMove = result;
    if (_timedOut) break;
  }

  return bestMove;
}

