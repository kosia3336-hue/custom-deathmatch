/** 사각목 규칙 — 서버 판정과 화면 표시가 같은 함수를 쓴다. 규칙 설명은 shared/types/square-mok.ts */
import {
  SQM_COLS,
  SQM_ROWS,
  type SquareMokBoard,
  type SquareMokCell,
  type SquareMokDecider,
  type SquareMokLineCounts,
  type SquareMokScore,
  type SquareMokSquare,
} from '../types/square-mok';

export function createSquareMokBoard(): SquareMokBoard {
  return Array.from({ length: SQM_ROWS }, () => Array<string | null>(SQM_COLS).fill(null));
}

export function cloneSquareMokBoard(board: SquareMokBoard): SquareMokBoard {
  return board.map((row) => [...row]);
}

export function squareMokCellKey(cell: SquareMokCell): string {
  return `${cell.row},${cell.col}`;
}

export function isSquareMokCell(cell: unknown): cell is SquareMokCell {
  if (!cell || typeof cell !== 'object') return false;
  const { row, col } = cell as SquareMokCell;
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < SQM_ROWS &&
    col >= 0 &&
    col < SQM_COLS
  );
}

export function squareMokEmptyCount(board: SquareMokBoard): number {
  return board.reduce((n, row) => n + row.filter((v) => v === null).length, 0);
}

/**
 * 이번 차례에 놓을 개수. 첫 차례는 1개, 그 뒤로는 2개씩, 마지막에 1칸만 남으면 1개.
 * 6×5=30칸이면 선 1 → (후 2, 선 2)×7 → 후 1 로 끝나 두 사람 모두 15개씩 놓는다.
 */
export function squareMokQuota(turnNumber: number, board: SquareMokBoard): number {
  return turnNumber <= 1 ? 1 : Math.min(2, squareMokEmptyCount(board));
}

/** 놓을 수 있는 칸 묶음인가 — 개수가 맞고, 모두 빈칸이며, 서로 다른 칸 */
export function canPlaceSquareMok(
  board: SquareMokBoard,
  cells: unknown,
  quota: number,
): cells is SquareMokCell[] {
  if (!Array.isArray(cells) || cells.length !== quota) return false;
  const seen = new Set<string>();
  for (const cell of cells) {
    if (!isSquareMokCell(cell)) return false;
    if (board[cell.row][cell.col] !== null) return false;
    const key = squareMokCellKey(cell);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

export function applySquareMokPlacement(
  board: SquareMokBoard,
  cells: SquareMokCell[],
  playerId: string,
): SquareMokBoard {
  const next = cloneSquareMokBoard(board);
  for (const cell of cells) next[cell.row][cell.col] = playerId;
  return next;
}

/**
 * 내 말 네 개가 꼭짓점인 정사각형을 모두 찾는다(기울어진 것 포함, 하나는 한 번만).
 * 꼭짓점 A 에서 변 벡터 v=(dx,dy) 로 B=A+v, C=B+w, D=A+w (w 는 v 를 90° 돌린 것).
 * 한 정사각형의 네 변 벡터 중 dx>0, dy≥0 인 것은 꼭 하나라 그것만 세면 겹치지 않는다.
 */
export function findSquareMokSquares(board: SquareMokBoard, playerId: string): SquareMokSquare[] {
  const own = (row: number, col: number) =>
    row >= 0 && row < SQM_ROWS && col >= 0 && col < SQM_COLS && board[row][col] === playerId;
  const out: SquareMokSquare[] = [];
  for (let row = 0; row < SQM_ROWS; row += 1) {
    for (let col = 0; col < SQM_COLS; col += 1) {
      if (!own(row, col)) continue;
      for (let dx = 1; dx < SQM_COLS; dx += 1) {
        for (let dy = 0; dy < SQM_ROWS; dy += 1) {
          // x=col, y=row. v=(dx,dy), w=(-dy,dx)
          const b = { row: row + dy, col: col + dx };
          const c = { row: row + dy + dx, col: col + dx - dy };
          const d = { row: row + dx, col: col - dy };
          if (own(b.row, b.col) && own(c.row, c.col) && own(d.row, d.col)) {
            out.push({ cells: [{ row, col }, b, c, d], area: dx * dx + dy * dy });
          }
        }
      }
    }
  }
  return out.sort((a, b) => b.area - a.area);
}

const LINE_DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** 가로·세로·대각선으로 이어진 내 말 줄을 길이별로 센다 — 끊긴 데까지가 한 줄(딱 그 길이만). */
export function countSquareMokLines(board: SquareMokBoard, playerId: string): SquareMokLineCounts {
  const own = (row: number, col: number) =>
    row >= 0 && row < SQM_ROWS && col >= 0 && col < SQM_COLS && board[row][col] === playerId;
  const counts: SquareMokLineCounts = { six: 0, five: 0, four: 0 };
  for (const [dr, dc] of LINE_DIRS) {
    for (let row = 0; row < SQM_ROWS; row += 1) {
      for (let col = 0; col < SQM_COLS; col += 1) {
        // 줄의 첫 칸에서만 센다
        if (!own(row, col) || own(row - dr, col - dc)) continue;
        let length = 0;
        while (own(row + dr * length, col + dc * length)) length += 1;
        if (length === 6) counts.six += 1;
        else if (length === 5) counts.five += 1;
        else if (length === 4) counts.four += 1;
      }
    }
  }
  return counts;
}

export function scoreSquareMok(board: SquareMokBoard, playerId: string): SquareMokScore {
  const squares = findSquareMokSquares(board, playerId);
  return {
    points: squares.reduce((sum, s) => sum + s.area, 0),
    maxArea: squares[0]?.area ?? 0,
    squares,
    lines: countSquareMokLines(board, playerId),
  };
}

const DECIDER_ORDER: Array<{
  decider: Exclude<SquareMokDecider, 'draw'>;
  value: (s: SquareMokScore) => number;
}> = [
  { decider: 'points', value: (s) => s.points },
  { decider: 'max-square', value: (s) => s.maxArea },
  { decider: 'six', value: (s) => s.lines.six },
  { decider: 'five', value: (s) => s.lines.five },
  { decider: 'four', value: (s) => s.lines.four },
];

export const SQUARE_MOK_DECIDER_LABEL: Record<SquareMokDecider, string> = {
  points: '승점이 더 높아',
  'max-square': '승점이 같아 더 넓은 정사각형으로',
  six: '승점·최대 정사각형이 같아 육목 수로',
  five: '육목 수까지 같아 오목 수로',
  four: '오목 수까지 같아 사목 수로',
  draw: '승점과 동점 규칙이 모두 같아',
};

/** 승자 — 승점, 최대 정사각형, 육목, 오목, 사목 순으로 견준다. 모두 같으면 무승부(null). */
export function decideSquareMok(
  scores: Record<string, SquareMokScore>,
  firstId: string,
  secondId: string,
): { winnerId: string | null; decider: SquareMokDecider } {
  const a = scores[firstId];
  const b = scores[secondId];
  for (const { decider, value } of DECIDER_ORDER) {
    if (value(a) !== value(b))
      return { winnerId: value(a) > value(b) ? firstId : secondId, decider };
  }
  return { winnerId: null, decider: 'draw' };
}
