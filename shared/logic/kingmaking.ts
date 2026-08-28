import {
  KM_BOARD_SIZE,
  KM_MAX_HEIGHT,
  type KingmakingAction,
  type KingmakingBoard,
  type KingmakingPiece,
  type KingmakingPosition,
} from '../types/kingmaking';

export function createKingmakingBoard(): KingmakingBoard {
  return Array.from({ length: KM_BOARD_SIZE }, () =>
    Array.from({ length: KM_BOARD_SIZE }, () => []),
  );
}

export function cloneKingmakingBoard(board: KingmakingBoard): KingmakingBoard {
  return board.map((row) => row.map((stack) => stack.map((piece) => ({ ...piece }))));
}

export function kingmakingPositionKey(position: KingmakingPosition) {
  return `${position.row}:${position.col}`;
}

export function isKingmakingPosition(value: unknown): value is KingmakingPosition {
  if (!value || typeof value !== 'object') return false;
  const position = value as Partial<KingmakingPosition>;
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row! >= 0 &&
    position.row! < KM_BOARD_SIZE &&
    position.col! >= 0 &&
    position.col! < KM_BOARD_SIZE
  );
}

function pathIsClear(board: KingmakingBoard, from: KingmakingPosition, to: KingmakingPosition) {
  const rowStep = Math.sign(to.row - from.row);
  const colStep = Math.sign(to.col - from.col);
  let row = from.row + rowStep;
  let col = from.col + colStep;
  while (row !== to.row || col !== to.col) {
    if (board[row][col].length > 0) return false;
    row += rowStep;
    col += colStep;
  }
  return true;
}

export function followsKingmakingMovement(
  board: KingmakingBoard,
  from: KingmakingPosition,
  to: KingmakingPosition,
  count: number,
) {
  const rowDistance = Math.abs(to.row - from.row);
  const colDistance = Math.abs(to.col - from.col);
  if (rowDistance === 0 && colDistance === 0) return false;
  if (count === 1) return rowDistance + colDistance === 1;
  if (count === 3) {
    return (rowDistance === 1 && colDistance === 2) || (rowDistance === 2 && colDistance === 1);
  }
  const orthogonal = rowDistance === 0 || colDistance === 0;
  const diagonal = rowDistance === colDistance;
  const directionAllowed =
    count === 2 ? orthogonal : count === 4 ? diagonal : count === 5 && (orthogonal || diagonal);
  return directionAllowed && pathIsClear(board, from, to);
}

export function canMoveKingmakingStack(
  board: KingmakingBoard,
  from: KingmakingPosition,
  to: KingmakingPosition,
  count: number,
) {
  if (!isKingmakingPosition(from) || !isKingmakingPosition(to)) return false;
  if (!Number.isInteger(count) || count < 1 || count > 5) return false;
  const source = board[from.row][from.col];
  const target = board[to.row][to.col];
  if (source.length < count || target.length === 0) return false;
  if (target.length + count > KM_MAX_HEIGHT) return false;
  if (target.at(-1)?.kind === 'special') return false;
  return followsKingmakingMovement(board, from, to, count);
}

export function getKingmakingLegalTargets(
  board: KingmakingBoard,
  from: KingmakingPosition,
  count: number,
) {
  const targets: KingmakingPosition[] = [];
  for (let row = 0; row < KM_BOARD_SIZE; row += 1) {
    for (let col = 0; col < KM_BOARD_SIZE; col += 1) {
      const to = { row, col };
      if (canMoveKingmakingStack(board, from, to, count)) targets.push(to);
    }
  }
  return targets;
}

export function applyKingmakingAction(
  board: KingmakingBoard,
  action: KingmakingAction,
  placedPiece?: KingmakingPiece,
) {
  const next = cloneKingmakingBoard(board);
  if (action.type === 'place') {
    if (!placedPiece) throw new Error('배치할 말이 필요합니다.');
    next[action.to.row][action.to.col].push({ ...placedPiece });
    return next;
  }
  const source = next[action.from.row][action.from.col];
  const moving = source.splice(source.length - action.count, action.count);
  next[action.to.row][action.to.col].push(...moving);
  return next;
}
