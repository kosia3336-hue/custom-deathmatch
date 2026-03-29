import { BOARD_SIZE, DIRS_4 } from './constants.js';
import type { CellType, Direction, Position, AIMove, InternalState } from './types.js';
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

export function minimax(
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

export function findBestMove(s: InternalState): AIMove {
  const aiColor = s.currentColor;
  const board = s.board;
  const lastGravBlack = s.lastGravityBlack;
  const lastGravWhite = s.lastGravityWhite;
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
