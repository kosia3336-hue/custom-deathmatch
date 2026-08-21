import { describe, it, expect } from 'vitest';
import type { Cell, Owner, PieceType } from '@shared/types/double-sided-chess.js';
import { DSC_BOARD_SIZE } from '@shared/types/double-sided-chess.js';
import { createInitialBoard } from '@shared/logic/double-sided-chess.js';
import { generateAllMoves } from '../socket/games/double-sided-chess/ai.js';
import {
  findImmediateWins,
  findSafeMoves,
  pickDoubleSidedChessAction,
  type DoubleSidedChessDummyView,
} from '../dummy/ai/double-sided-chess.js';

function emptyBoard(): Cell[][] {
  return Array.from({ length: DSC_BOARD_SIZE }, () =>
    Array.from({ length: DSC_BOARD_SIZE }, () => null),
  );
}

function cell(piece: PieceType, owner: Owner): NonNullable<Cell> {
  return { piece, owner, isPromoted: false };
}

function viewOf(board: Cell[][], dummyId = 'dummy'): DoubleSidedChessDummyView {
  return {
    gameOver: false,
    turnNumber: 6,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    data: {
      board,
      currentPlayer: dummyId,
      currentOwner: 'first',
      turnNumber: 6,
      players: {
        first: { id: dummyId, nickname: 'd' },
        second: { id: 'human', nickname: 'h' },
      },
      prisoners: { first: [], second: [] },
      lastMove: null,
      winner: null,
      winType: null,
    },
  };
}

describe('양면장기 더미 즉시승', () => {
  it('보병이 상대 왕을 잡을 수 있으면 즉시승으로 잡는다', () => {
    const board = emptyBoard();
    board[4][2] = cell('king', 'first');
    board[3][2] = cell('infantry', 'first');
    board[2][2] = cell('king', 'second');
    board[0][0] = cell('infantry', 'second');

    const wins = findImmediateWins(board, { first: [], second: [] }, 'first');
    expect(wins.some((m) =>
      m.type === 'move' && m.from.row === 3 && m.from.col === 2 && m.to.row === 2 && m.to.col === 2,
    )).toBe(true);
  });

  it('하 등급도 왕 포획 즉시승을 버린다', () => {
    const board = emptyBoard();
    board[4][2] = cell('king', 'first');
    board[3][2] = cell('infantry', 'first');
    board[2][2] = cell('king', 'second');
    board[0][0] = cell('infantry', 'second');

    const picked = pickDoubleSidedChessAction(viewOf(board), 'dummy', '하');
    expect(picked).toEqual({
      type: 'move',
      from: { row: 3, col: 2 },
      to: { row: 2, col: 2 },
    });
  });

  it('왕이 상대 진영(0행)으로 들어가면 즉시승이다', () => {
    const board = emptyBoard();
    board[1][2] = cell('king', 'first');
    board[4][0] = cell('infantry', 'first');
    board[0][4] = cell('king', 'second');
    board[0][0] = cell('infantry', 'second');

    const wins = findImmediateWins(board, { first: [], second: [] }, 'first');
    expect(wins.some((m) => m.type === 'move' && m.from.row === 1 && m.from.col === 2 && m.to.row === 0)).toBe(true);

    const picked = pickDoubleSidedChessAction(viewOf(board), 'dummy', '하');
    expect(picked?.type).toBe('move');
    if (picked?.type === 'move') {
      expect(picked.from).toEqual({ row: 1, col: 2 });
      expect(picked.to.row).toBe(0);
    }
  });
});

describe('양면장기 더미 초반 수', () => {
  it('시작 보드에서 중 등급이 3초 안에 합법 수를 낸다', () => {
    const board = createInitialBoard();
    const t0 = Date.now();
    const picked = pickDoubleSidedChessAction(viewOf(board), 'dummy', '중');
    const elapsed = Date.now() - t0;
    expect(picked).not.toBeNull();
    expect(elapsed).toBeLessThan(3000);
    const legal = generateAllMoves(board, { first: [], second: [] }, 'first');
    if (picked?.type === 'move') {
      expect(legal.some((m) =>
        m.type === 'move' && m.from.row === picked.from.row && m.from.col === picked.from.col
        && m.to.row === picked.to.row && m.to.col === picked.to.col,
      )).toBe(true);
    }
  }, 15_000);
});

describe('양면장기 더미 왕 자폭', () => {
  it('금이 때리는 칸으로 왕을 내주지 않는다', () => {
    const board = emptyBoard();
    board[4][2] = cell('king', 'first');
    board[4][0] = cell('infantry', 'first');
    board[2][2] = cell('gold', 'second');
    board[0][2] = cell('king', 'second');
    board[0][0] = cell('infantry', 'second');

    const safe = findSafeMoves(board, { first: [], second: [] }, 'first');
    expect(safe.some((m) =>
      m.type === 'move' && m.from.row === 4 && m.from.col === 2 && m.to.row === 3,
    )).toBe(false);
    expect(safe.length).toBeGreaterThan(0);

    for (let i = 0; i < 24; i++) {
      const picked = pickDoubleSidedChessAction(viewOf(board), 'dummy', '하');
      expect(picked).not.toBeNull();
      if (picked?.type === 'move' && picked.from.row === 4 && picked.from.col === 2) {
        expect(picked.to.row).not.toBe(3);
      }
    }
  });
});
