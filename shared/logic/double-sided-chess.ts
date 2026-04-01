import type { Cell, PieceType, Owner, Position } from '../types/double-sided-chess';
import {
  DSC_BOARD_SIZE,
  INITIAL_FIRST_ROW,
  INITIAL_SECOND_ROW,
} from '../types/double-sided-chess';

type Dir = [number, number];
type MoveInfo = { type: 'step' | 'slide' | 'jump'; dirs: Dir[] };

/** 말이 이동한 뒤의 승격 상태를 반환합니다. 왕은 항상 비승격 상태입니다. */
export function nextIsPromoted(piece: PieceType, isPromoted: boolean): boolean {
  if (piece === 'king') return false;
  return !isPromoted;
}

export function createInitialBoard(): Cell[][] {
  const board: Cell[][] = Array.from({ length: DSC_BOARD_SIZE }, () =>
    Array.from({ length: DSC_BOARD_SIZE }, () => null),
  );
  for (let c = 0; c < DSC_BOARD_SIZE; c++) {
    board[0][c] = { piece: INITIAL_SECOND_ROW[c], owner: 'second', isPromoted: false };
    board[DSC_BOARD_SIZE - 1][c] = { piece: INITIAL_FIRST_ROW[c], owner: 'first', isPromoted: false };
  }
  return board;
}

function getMoveInfo(piece: PieceType, isPromoted: boolean, owner: Owner): MoveInfo {
  const fwd = owner === 'first' ? -1 : 1;

  if (piece === 'king') {
    return {
      type: 'step',
      dirs: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
    };
  }

  if (!isPromoted) {
    switch (piece) {
      case 'infantry':
        return { type: 'step', dirs: [[fwd, 0]] };
      case 'gold':
      case 'copper':
        return {
          type: 'step',
          dirs: [[fwd, -1], [fwd, 0], [fwd, 1], [0, -1], [0, 1], [-fwd, 0]],
        };
      case 'silver':
        return {
          type: 'step',
          dirs: [[fwd, -1], [fwd, 0], [fwd, 1], [-fwd, -1], [-fwd, 1]],
        };
    }
  } else {
    switch (piece) {
      case 'infantry': // 룩
        return { type: 'slide', dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]] };
      case 'gold': // 나이트 (전방)
        return {
          type: 'jump',
          dirs: [[fwd * 2, -1], [fwd * 2, 1], [fwd, -2], [fwd, 2]],
        };
      case 'silver': // 비숍
        return { type: 'slide', dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]] };
      case 'copper': // 향차
        return { type: 'slide', dirs: [[fwd, 0]] };
    }
  }

  return { type: 'step', dirs: [] };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < DSC_BOARD_SIZE && c >= 0 && c < DSC_BOARD_SIZE;
}

export function getValidMoves(board: Cell[][], row: number, col: number): Position[] {
  const cell = board[row][col];
  if (!cell) return [];

  const info = getMoveInfo(cell.piece, cell.isPromoted, cell.owner);
  const moves: Position[] = [];

  if (info.type === 'step' || info.type === 'jump') {
    for (const [dr, dc] of info.dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && target.owner === cell.owner) continue;
      moves.push({ row: nr, col: nc });
    }
  } else {
    for (const [dr, dc] of info.dirs) {
      let nr = row + dr;
      let nc = col + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (target) {
          if (target.owner !== cell.owner) moves.push({ row: nr, col: nc });
          break;
        }
        moves.push({ row: nr, col: nc });
        nr += dr;
        nc += dc;
      }
    }
  }

  return moves;
}

export function getValidPrisonerPlacements(board: Cell[][], owner: Owner): Position[] {
  const row = owner === 'first' ? DSC_BOARD_SIZE - 1 : 0;
  const positions: Position[] = [];
  for (let c = 0; c < DSC_BOARD_SIZE; c++) {
    if (!board[row][c]) positions.push({ row, col: c });
  }
  return positions;
}
