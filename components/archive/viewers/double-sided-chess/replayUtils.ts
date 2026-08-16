import type { Cell, PieceType } from '@/shared/types/double-sided-chess';
import type { DSCTurnActionLog } from '@/shared/types/archive';
import {
  createInitialBoard,
  nextIsPromoted,
} from '@/shared/logic/double-sided-chess';

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export interface ReplayFrame {
  board: Cell[][];
  lastMove: { from: { row: number; col: number } | null; to: { row: number; col: number } } | null;
  turnNumber: number;
  player: 'first' | 'second' | null;
  nickname: string | null;
  actionType: 'start' | 'move' | 'place-prisoner';
}

export function computeFrames(actions: DSCTurnActionLog[]): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const board = createInitialBoard();

  frames.push({
    board: cloneBoard(board),
    lastMove: null,
    turnNumber: 0,
    player: null,
    nickname: null,
    actionType: 'start',
  });

  for (const entry of actions) {
    const action = entry.action;

    if (action.type === 'move') {
      const cell = board[action.from.row][action.from.col];
      if (cell) {
        board[action.to.row][action.to.col] = {
          piece: cell.piece,
          owner: cell.owner,
          isPromoted: nextIsPromoted(cell.piece, cell.isPromoted),
        };
        board[action.from.row][action.from.col] = null;
      }
      frames.push({
        board: cloneBoard(board),
        lastMove: { from: action.from, to: action.to },
        turnNumber: entry.turnNumber,
        player: entry.player,
        nickname: entry.nickname,
        actionType: 'move',
      });
    } else if (action.type === 'place-prisoner') {
      board[action.position.row][action.position.col] = {
        piece: action.pieceType as PieceType,
        owner: entry.player,
        isPromoted: false,
      };
      frames.push({
        board: cloneBoard(board),
        lastMove: { from: null, to: action.position },
        turnNumber: entry.turnNumber,
        player: entry.player,
        nickname: entry.nickname,
        actionType: 'place-prisoner',
      });
    }
  }

  return frames;
}
