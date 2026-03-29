import { BOARD_SIZE } from './constants.js';
import type { CellType, Direction, Position } from './types.js';

export function createEmptyBoard(): CellType[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 'empty' as CellType),
  );
}

export function cloneBoard(board: CellType[][]): CellType[][] {
  return board.map((r) => [...r]);
}

export function applyGravity(board: CellType[][], direction: Direction): CellType[][] {
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

export function findMovedPosition(
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

export function calcNeutralCandidates(
  placedPos: Position,
  movedPos: Position,
  board: CellType[][],
): Position[] {
  if (placedPos.row === movedPos.row && placedPos.col === movedPos.col) return [];

  // 중력 이동은 항상 한 축만 변하므로 두 축이 모두 다르면 빈 배열 반환
  if (placedPos.row !== movedPos.row && placedPos.col !== movedPos.col) return [];

  const candidates: Position[] = [];

  if (placedPos.col === movedPos.col) {
    const c = placedPos.col;
    const lo = Math.min(placedPos.row, movedPos.row);
    const hi = Math.max(placedPos.row, movedPos.row);
    for (let r = lo; r <= hi; r++) {
      if (board[r][c] === 'empty') candidates.push({ row: r, col: c });
    }
  } else {
    const r = placedPos.row;
    const lo = Math.min(placedPos.col, movedPos.col);
    const hi = Math.max(placedPos.col, movedPos.col);
    for (let c = lo; c <= hi; c++) {
      if (board[r][c] === 'empty') candidates.push({ row: r, col: c });
    }
  }

  return candidates;
}
