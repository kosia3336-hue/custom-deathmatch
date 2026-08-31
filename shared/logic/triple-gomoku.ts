import {
  TG_BOARD_RADIUS,
  TG_LINE_LENGTH,
  TG_MAX_HEIGHT,
  TG_TOP_CLUSTER_WIN,
  TG_TOP_LAYER_WIN,
  type TripleGomokuBoard,
  type TripleGomokuCell,
  type TripleGomokuStack,
  type TripleGomokuWin,
} from '../types/triple-gomoku';

/**
 * 판은 축좌표(q, r)를 쓰는 삼각격자다. 한 점은 최대 6개의 이웃을 갖고,
 * 직선은 세 축(q, r, q+r)으로만 만들어진다. 화면에서는 각 점을 잇는 선이
 * 정삼각형 그물이 되고, 돌은 점 위에 놓인다.
 */
export const TG_CENTER: TripleGomokuCell = { q: 0, r: 0 };

const NEIGHBOR_DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

/** 오목을 셀 때 쓰는 세 축. 반대 방향은 같은 직선이라 한 번만 본다. */
const LINE_AXES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, -1],
];

export function tripleGomokuCellKey(cell: TripleGomokuCell) {
  return `${cell.q},${cell.r}`;
}

export function parseTripleGomokuCellKey(key: string): TripleGomokuCell | null {
  const [rawQ, rawR] = key.split(',');
  const q = Number(rawQ);
  const r = Number(rawR);
  if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
  return { q, r };
}

/** 육각 판 안에 있는 좌표인지 확인한다. 클라이언트가 보낸 값 검증에도 쓴다. */
export function isTripleGomokuCell(value: unknown): value is TripleGomokuCell {
  if (!value || typeof value !== 'object') return false;
  const cell = value as Partial<TripleGomokuCell>;
  if (!Number.isInteger(cell.q) || !Number.isInteger(cell.r)) return false;
  const q = cell.q as number;
  const r = cell.r as number;
  return (
    Math.abs(q) <= TG_BOARD_RADIUS &&
    Math.abs(r) <= TG_BOARD_RADIUS &&
    Math.abs(q + r) <= TG_BOARD_RADIUS
  );
}

export function isSameTripleGomokuCell(a: TripleGomokuCell, b: TripleGomokuCell) {
  return a.q === b.q && a.r === b.r;
}

/** 판의 모든 칸. 위에서 아래로, 각 줄은 왼쪽에서 오른쪽 순서다. */
export function tripleGomokuCells(): TripleGomokuCell[] {
  const cells: TripleGomokuCell[] = [];
  for (let r = -TG_BOARD_RADIUS; r <= TG_BOARD_RADIUS; r += 1) {
    const minQ = Math.max(-TG_BOARD_RADIUS, -r - TG_BOARD_RADIUS);
    const maxQ = Math.min(TG_BOARD_RADIUS, -r + TG_BOARD_RADIUS);
    for (let q = minQ; q <= maxQ; q += 1) cells.push({ q, r });
  }
  return cells;
}

export function tripleGomokuNeighbors(cell: TripleGomokuCell): TripleGomokuCell[] {
  return NEIGHBOR_DIRECTIONS.map(([dq, dr]) => ({ q: cell.q + dq, r: cell.r + dr })).filter(
    isTripleGomokuCell,
  );
}

export function areTripleGomokuAdjacent(a: TripleGomokuCell, b: TripleGomokuCell) {
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  return NEIGHBOR_DIRECTIONS.some(([q, r]) => q === dq && r === dr);
}

export function tripleGomokuStackAt(
  board: TripleGomokuBoard,
  cell: TripleGomokuCell,
): TripleGomokuStack {
  return board[tripleGomokuCellKey(cell)] ?? [];
}

export function tripleGomokuHeightAt(board: TripleGomokuBoard, cell: TripleGomokuCell) {
  return tripleGomokuStackAt(board, cell).length;
}

/** 위에서 내려다볼 때 보이는 돌의 주인. 빈칸이면 null. */
export function tripleGomokuTopOwner(board: TripleGomokuBoard, cell: TripleGomokuCell) {
  return tripleGomokuStackAt(board, cell).at(-1) ?? null;
}

export function cloneTripleGomokuBoard(board: TripleGomokuBoard): TripleGomokuBoard {
  const next: TripleGomokuBoard = {};
  for (const [key, stack] of Object.entries(board)) next[key] = [...stack];
  return next;
}

/**
 * 기본 배치에서 놓을 수 있는 칸인지 본다.
 * 정중앙과, 이미 놓은 자기 돌에 인접한 칸은 막힌다.
 */
export function canPlaceTripleGomokuSetup(
  board: TripleGomokuBoard,
  cell: TripleGomokuCell,
  playerId: string,
) {
  if (!isTripleGomokuCell(cell)) return false;
  if (isSameTripleGomokuCell(cell, TG_CENTER)) return false;
  if (tripleGomokuHeightAt(board, cell) > 0) return false;
  return !tripleGomokuNeighbors(cell).some((neighbor) =>
    tripleGomokuStackAt(board, neighbor).includes(playerId),
  );
}

/** 본 게임에서 새 돌을 놓을 수 있는 칸인지 본다. 빈칸이면 어디든 된다. */
export function canPlaceTripleGomokuStone(board: TripleGomokuBoard, cell: TripleGomokuCell) {
  return isTripleGomokuCell(cell) && tripleGomokuHeightAt(board, cell) === 0;
}

/**
 * 돌 이동이 가능한지 본다.
 * 맨 위 돌만 움직일 수 있고, 목적지는 인접해야 하며,
 * 원래 칸보다 높이 쌓인 칸으로는 갈 수 없고, 3층을 넘길 수도 없다.
 */
export function canMoveTripleGomokuStone(
  board: TripleGomokuBoard,
  from: TripleGomokuCell,
  to: TripleGomokuCell,
  playerId: string,
) {
  if (!isTripleGomokuCell(from) || !isTripleGomokuCell(to)) return false;
  if (!areTripleGomokuAdjacent(from, to)) return false;
  if (tripleGomokuTopOwner(board, from) !== playerId) return false;
  const fromHeight = tripleGomokuHeightAt(board, from);
  const toHeight = tripleGomokuHeightAt(board, to);
  if (toHeight > fromHeight) return false;
  return toHeight + 1 <= TG_MAX_HEIGHT;
}

/** 한 칸에서 옮겨 갈 수 있는 이웃 칸 목록. 클라이언트 하이라이트에 쓴다. */
export function tripleGomokuMoveTargets(
  board: TripleGomokuBoard,
  from: TripleGomokuCell,
  playerId: string,
) {
  return tripleGomokuNeighbors(from).filter((to) =>
    canMoveTripleGomokuStone(board, from, to, playerId),
  );
}

export function applyTripleGomokuAction(
  board: TripleGomokuBoard,
  action:
    | { type: 'place'; to: TripleGomokuCell }
    | { type: 'move'; from: TripleGomokuCell; to: TripleGomokuCell },
  playerId: string,
): TripleGomokuBoard {
  const next = cloneTripleGomokuBoard(board);
  const toKey = tripleGomokuCellKey(action.to);
  if (action.type === 'place') {
    next[toKey] = [...(next[toKey] ?? []), playerId];
    return next;
  }
  const fromKey = tripleGomokuCellKey(action.from);
  const source = [...(next[fromKey] ?? [])];
  const moving = source.pop();
  if (moving == null) return next;
  if (source.length === 0) delete next[fromKey];
  else next[fromKey] = source;
  next[toKey] = [...(next[toKey] ?? []), moving];
  return next;
}

/** 3층에 자기 돌이 올라가 있는 칸들. */
function topLayerCells(board: TripleGomokuBoard, playerId: string): TripleGomokuCell[] {
  const cells: TripleGomokuCell[] = [];
  for (const [key, stack] of Object.entries(board)) {
    if (stack.length !== TG_MAX_HEIGHT) continue;
    if (stack[TG_MAX_HEIGHT - 1] !== playerId) continue;
    const cell = parseTripleGomokuCellKey(key);
    if (cell) cells.push(cell);
  }
  return cells;
}

/**
 * 정확히 다섯 칸이 이어진 오목을 찾는다.
 * 여섯 칸 이상 이어지면 그 줄은 인정하지 않으므로 양 끝을 함께 확인한다.
 */
function findLineWin(board: TripleGomokuBoard, playerId: string): TripleGomokuCell[] | null {
  for (const cell of tripleGomokuCells()) {
    if (tripleGomokuTopOwner(board, cell) !== playerId) continue;
    for (const [dq, dr] of LINE_AXES) {
      const before = { q: cell.q - dq, r: cell.r - dr };
      // 줄의 시작점에서만 센다. 앞칸이 같은 편이면 이 줄은 이미 셌다.
      if (tripleGomokuTopOwner(board, before) === playerId) continue;
      const run: TripleGomokuCell[] = [];
      for (let step = 0; step < TG_LINE_LENGTH; step += 1) {
        const next = { q: cell.q + dq * step, r: cell.r + dr * step };
        if (!isTripleGomokuCell(next)) break;
        if (tripleGomokuTopOwner(board, next) !== playerId) break;
        run.push(next);
      }
      if (run.length !== TG_LINE_LENGTH) continue;
      const after = { q: cell.q + dq * TG_LINE_LENGTH, r: cell.r + dr * TG_LINE_LENGTH };
      if (tripleGomokuTopOwner(board, after) === playerId) continue;
      return run;
    }
  }
  return null;
}

/** 서로 인접한 3층 돌 세 개, 즉 격자의 작은 삼각형을 찾는다. */
function findTopClusterWin(cells: TripleGomokuCell[]): TripleGomokuCell[] | null {
  const owned = new Set(cells.map(tripleGomokuCellKey));
  for (const cell of cells) {
    const neighbors = tripleGomokuNeighbors(cell).filter((neighbor) =>
      owned.has(tripleGomokuCellKey(neighbor)),
    );
    for (let i = 0; i < neighbors.length; i += 1) {
      for (let j = i + 1; j < neighbors.length; j += 1) {
        if (areTripleGomokuAdjacent(neighbors[i], neighbors[j])) {
          return [cell, neighbors[i], neighbors[j]];
        }
      }
    }
  }
  return null;
}

/**
 * 세 가지 승리 조건을 순서대로 확인한다.
 * 어느 것도 아니면 null 이다.
 */
export function findTripleGomokuWin(
  board: TripleGomokuBoard,
  playerId: string,
): TripleGomokuWin | null {
  const line = findLineWin(board, playerId);
  if (line) return { playerId, type: 'line', cells: line };

  const topCells = topLayerCells(board, playerId);
  if (topCells.length >= TG_TOP_LAYER_WIN) {
    return { playerId, type: 'top-count', cells: topCells.slice(0, TG_TOP_LAYER_WIN) };
  }
  if (topCells.length >= TG_TOP_CLUSTER_WIN) {
    const cluster = findTopClusterWin(topCells);
    if (cluster) return { playerId, type: 'top-cluster', cells: cluster };
  }
  return null;
}

/**
 * 칸의 화면 위치를 0~1로 정규화해 돌려준다.
 * 가로는 줄마다 반 칸씩 밀리고, 세로는 정삼각형 높이만큼 내려간다.
 */
const TG_LAYOUT_SPAN = TG_BOARD_RADIUS * 2;
const TG_LAYOUT_HEIGHT = (Math.sqrt(3) / 2) * TG_LAYOUT_SPAN;

/** 판을 그릴 때 쓸 가로:세로 비율. */
export const TG_BOARD_ASPECT = TG_LAYOUT_SPAN / TG_LAYOUT_HEIGHT;

export function tripleGomokuPosition(cell: TripleGomokuCell) {
  return {
    x: (cell.q + cell.r / 2 + TG_BOARD_RADIUS) / TG_LAYOUT_SPAN,
    y: ((cell.r + TG_BOARD_RADIUS) * (Math.sqrt(3) / 2)) / TG_LAYOUT_HEIGHT,
  };
}

/** 격자선으로 그릴 이웃 쌍. 같은 변을 두 번 그리지 않도록 세 방향만 본다. */
export function tripleGomokuEdges(): [TripleGomokuCell, TripleGomokuCell][] {
  const edges: [TripleGomokuCell, TripleGomokuCell][] = [];
  for (const cell of tripleGomokuCells()) {
    for (const [dq, dr] of LINE_AXES) {
      const next = { q: cell.q + dq, r: cell.r + dr };
      if (isTripleGomokuCell(next)) edges.push([cell, next]);
    }
  }
  return edges;
}
