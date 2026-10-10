import {
  ESKIMO_BEAR,
  ESKIMO_SIZE,
  type EskimoAction,
  type EskimoBoard,
  type EskimoCell,
} from '../types/eskimo';

/** 가로·세로·대각선 여덟 방향. 내 말 미끄러뜨리기와 북극곰 한 칸 이동이 같이 쓴다. */
export const ESKIMO_DIRECTIONS: readonly [number, number][] = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];

/** 북극곰을 포위하는 '사방' — 상하좌우. */
const ORTHOGONAL: readonly [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export function eskimoCellKey(cell: EskimoCell) {
  return `${cell.row},${cell.col}`;
}

export function isEskimoCell(value: unknown): value is EskimoCell {
  if (!value || typeof value !== 'object') return false;
  const { row, col } = value as { row?: unknown; col?: unknown };
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    (row as number) >= 0 &&
    (row as number) < ESKIMO_SIZE &&
    (col as number) >= 0 &&
    (col as number) < ESKIMO_SIZE
  );
}

function inside(row: number, col: number) {
  return row >= 0 && row < ESKIMO_SIZE && col >= 0 && col < ESKIMO_SIZE;
}

/** 시작 판 — 선은 아래 줄(4행), 후는 위 줄(0행), 북극곰은 한가운데. */
export function createEskimoBoard(firstPlayerId: string, secondPlayerId: string): EskimoBoard {
  const board: EskimoBoard = Array.from({ length: ESKIMO_SIZE }, () =>
    Array<string | null>(ESKIMO_SIZE).fill(null),
  );
  for (let col = 0; col < ESKIMO_SIZE; col += 1) {
    board[0][col] = secondPlayerId;
    board[ESKIMO_SIZE - 1][col] = firstPlayerId;
  }
  const mid = Math.floor(ESKIMO_SIZE / 2);
  board[mid][mid] = ESKIMO_BEAR;
  return board;
}

export function cloneEskimoBoard(board: EskimoBoard): EskimoBoard {
  return board.map((row) => [...row]);
}

export function findEskimoBear(board: EskimoBoard): EskimoCell | null {
  for (let row = 0; row < ESKIMO_SIZE; row += 1) {
    for (let col = 0; col < ESKIMO_SIZE; col += 1) {
      if (board[row][col] === ESKIMO_BEAR) return { row, col };
    }
  }
  return null;
}

/**
 * 고른 말이 갈 수 있는 칸들.
 * · 내 말: 방향마다 다른 말이나 판 끝에 막히기 직전 칸 하나. 바로 막힌 방향은 없다.
 * · 북극곰: 비어 있는 이웃 한 칸씩. 잠겨 있으면(bearLocked) 없다.
 * 남의 말·빈칸을 고르면 빈 배열이다.
 */
export function eskimoMoveTargets(
  board: EskimoBoard,
  from: EskimoCell,
  playerId: string,
  bearLocked: boolean,
): EskimoCell[] {
  if (!isEskimoCell(from)) return [];
  const piece = board[from.row][from.col];
  if (piece === ESKIMO_BEAR) {
    if (bearLocked) return [];
    return ESKIMO_DIRECTIONS.map(([dr, dc]) => ({ row: from.row + dr, col: from.col + dc })).filter(
      (cell) => inside(cell.row, cell.col) && board[cell.row][cell.col] === null,
    );
  }
  if (piece !== playerId) return [];
  const targets: EskimoCell[] = [];
  for (const [dr, dc] of ESKIMO_DIRECTIONS) {
    let row = from.row;
    let col = from.col;
    while (inside(row + dr, col + dc) && board[row + dr][col + dc] === null) {
      row += dr;
      col += dc;
    }
    if (row !== from.row || col !== from.col) targets.push({ row, col });
  }
  return targets;
}

export function canEskimoMove(
  board: EskimoBoard,
  action: EskimoAction,
  playerId: string,
  bearLocked: boolean,
): boolean {
  if (!action || action.type !== 'move') return false;
  if (!isEskimoCell(action.from) || !isEskimoCell(action.to)) return false;
  return eskimoMoveTargets(board, action.from, playerId, bearLocked).some(
    (cell) => cell.row === action.to.row && cell.col === action.to.col,
  );
}

/** 지금 둘 수 있는 수가 하나라도 있는지. */
export function hasEskimoMove(board: EskimoBoard, playerId: string, bearLocked: boolean) {
  for (let row = 0; row < ESKIMO_SIZE; row += 1) {
    for (let col = 0; col < ESKIMO_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece !== playerId && piece !== ESKIMO_BEAR) continue;
      if (eskimoMoveTargets(board, { row, col }, playerId, bearLocked).length > 0) return true;
    }
  }
  return false;
}

/** 검증 없이 말 하나를 옮긴 새 판. */
export function applyEskimoAction(board: EskimoBoard, action: EskimoAction): EskimoBoard {
  const next = cloneEskimoBoard(board);
  next[action.to.row][action.to.col] = next[action.from.row][action.from.col];
  next[action.from.row][action.from.col] = null;
  return next;
}

/**
 * 북극곰의 상하좌우가 모두 막혔으면 북극곰과 그 칸의 말들을 돌려준다.
 * 판 끝은 막힌 것으로 본다. 포위하는 말은 누구 것이든 상관없다.
 */
export function findEskimoSurround(board: EskimoBoard): EskimoCell[] | null {
  const bear = findEskimoBear(board);
  if (!bear) return null;
  const cells: EskimoCell[] = [bear];
  for (const [dr, dc] of ORTHOGONAL) {
    const row = bear.row + dr;
    const col = bear.col + dc;
    if (!inside(row, col)) continue;
    if (board[row][col] === null) return null;
    cells.push({ row, col });
  }
  return cells;
}

/**
 * 반복수 판정에 쓰는 판 모양. 말의 위치만 본다(차례·북극곰 잠금은 넣지 않는다).
 * 선의 말 F, 후의 말 S, 북극곰 B, 빈칸 '.'.
 */
export function eskimoPositionKey(board: EskimoBoard, firstPlayerId: string): string {
  let key = '';
  for (const row of board) {
    for (const piece of row) {
      key +=
        piece === null ? '.' : piece === ESKIMO_BEAR ? 'B' : piece === firstPlayerId ? 'F' : 'S';
    }
  }
  return key;
}
