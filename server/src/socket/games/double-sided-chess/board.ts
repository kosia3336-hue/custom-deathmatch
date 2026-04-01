import type { Cell, PieceType, Owner, Position } from '@shared/types/double-sided-chess.js';
import { DSC_BOARD_SIZE } from '@shared/types/double-sided-chess.js';
import {
  createInitialBoard,
  getValidMoves,
  getValidPrisonerPlacements,
} from '@shared/logic/double-sided-chess.js';

export { createInitialBoard, getValidMoves, getValidPrisonerPlacements };

export function hasAnyValidAction(
  board: Cell[][],
  prisoners: PieceType[],
  owner: Owner,
): boolean {
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell && cell.owner === owner && getValidMoves(board, r, c).length > 0) return true;
    }
  }
  if (prisoners.length > 0 && getValidPrisonerPlacements(board, owner).length > 0) return true;
  return false;
}

export function isKingInOpponentTerritory(board: Cell[][], owner: Owner): boolean {
  const targetRow = owner === 'first' ? 0 : DSC_BOARD_SIZE - 1;
  for (let c = 0; c < DSC_BOARD_SIZE; c++) {
    const cell = board[targetRow][c];
    if (cell && cell.owner === owner && cell.piece === 'king') return true;
  }
  return false;
}

export function countNonKingPieces(board: Cell[][], owner: Owner): number {
  let count = 0;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell && cell.owner === owner && cell.piece !== 'king') count++;
    }
  }
  return count;
}

export type { Position, PieceType, Owner, Cell };
