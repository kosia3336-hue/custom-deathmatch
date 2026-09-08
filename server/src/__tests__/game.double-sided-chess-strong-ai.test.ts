import { describe, expect, it } from 'vitest';
import { createInitialBoard } from '../socket/games/double-sided-chess/board.js';
import {
  evaluateStrong,
  findBestMoveIterativeStrong,
  findBestMoveIterativeSuper,
  probeOpeningBook,
} from '../socket/games/double-sided-chess/ai-strong.js';
import type { Cell } from '@shared/types/double-sided-chess.js';

function emptyBoard(): Cell[][] {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null));
}

describe('양면장기 강한 AI v4', () => {
  it('시작 국면 평가는 유한하고 대칭에 가깝다', () => {
    const board = createInitialBoard();
    const score = evaluateStrong(board, { first: [], second: [] }, 'first');
    expect(Number.isFinite(score)).toBe(true);
    expect(Math.abs(score)).toBeLessThan(400);
  });

  it('선 첫 수는 우보 44-34 정석이다', () => {
    const board = createInitialBoard();
    const book = probeOpeningBook(board, 'first', 1);
    expect(book).toEqual({
      type: 'move',
      from: { row: 4, col: 4 },
      to: { row: 3, col: 4 },
    });
    const move = findBestMoveIterativeSuper({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'first',
      turnNumber: 1,
    }, 200);
    expect(move).toEqual(book);
  });

  it('후 첫 수는 동사선 04-13 정석이다', () => {
    const board = createInitialBoard();
    board[3][4] = { piece: 'infantry', owner: 'first', isPromoted: true };
    board[4][4] = null;
    const book = probeOpeningBook(board, 'second', 2);
    expect(book).toEqual({
      type: 'move',
      from: { row: 0, col: 4 },
      to: { row: 1, col: 3 },
    });
    const move = findBestMoveIterativeStrong({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'second',
      turnNumber: 2,
    }, 200);
    expect(move).toEqual(book);
  });

  it('우보 이후 선 3수는 동사선 40-31이다', () => {
    const board = createInitialBoard();
    board[3][4] = { piece: 'infantry', owner: 'first', isPromoted: true };
    board[4][4] = null;
    board[1][3] = { piece: 'copper', owner: 'second', isPromoted: true };
    board[0][4] = null;
    const move = findBestMoveIterativeStrong({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'first',
      turnNumber: 3,
    }, 200);
    expect(move).toEqual({
      type: 'move',
      from: { row: 4, col: 0 },
      to: { row: 3, col: 1 },
    });
  });

  it('상대 왕이 진입 두 칸 앞이면 큰 음수다', () => {
    const board = emptyBoard();
    board[4][2] = { piece: 'king', owner: 'first', isPromoted: false };
    board[2][1] = { piece: 'king', owner: 'second', isPromoted: false };
    board[4][3] = { piece: 'gold', owner: 'first', isPromoted: false };
    board[0][1] = { piece: 'gold', owner: 'second', isPromoted: false };
    const score = evaluateStrong(board, { first: [], second: [] }, 'first');
    expect(score).toBeLessThan(-8_000);
  });

  it('왕이 공격받는 칸의 비왕을 되잡지 않는다', () => {
    const board = emptyBoard();
    board[4][2] = { piece: 'king', owner: 'first', isPromoted: false };
    board[4][1] = { piece: 'silver', owner: 'first', isPromoted: false };
    board[4][3] = { piece: 'gold', owner: 'first', isPromoted: false };
    board[4][4] = { piece: 'infantry', owner: 'first', isPromoted: false };
    board[0][2] = { piece: 'king', owner: 'second', isPromoted: false };
    board[3][1] = { piece: 'silver', owner: 'second', isPromoted: true };
    board[1][2] = { piece: 'gold', owner: 'second', isPromoted: true };

    const move = findBestMoveIterativeStrong({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'first',
      turnNumber: 8,
    }, 1_000);

    expect(move.type).toBe('move');
    if (move.type === 'move') {
      const from = board[move.from.row][move.from.col];
      const kingRecapture = from?.piece === 'king' && move.to.row === 3 && move.to.col === 1;
      expect(kingRecapture).toBe(false);
    }
  });

  it('1수 왕 캡처를 즉시 고른다', () => {
    const board = emptyBoard();
    board[4][0] = { piece: 'king', owner: 'first', isPromoted: false };
    board[3][2] = { piece: 'gold', owner: 'first', isPromoted: false };
    board[2][2] = { piece: 'king', owner: 'second', isPromoted: false };
    board[0][4] = { piece: 'gold', owner: 'second', isPromoted: false };

    const move = findBestMoveIterativeStrong({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'first',
      turnNumber: 12,
    }, 800);

    expect(move).toEqual({
      type: 'move',
      from: { row: 3, col: 2 },
      to: { row: 2, col: 2 },
    });
  });

  it('초반 첫 수로 왕을 움직이지 않는다', () => {
    const board = createInitialBoard();
    const move = findBestMoveIterativeStrong({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'first',
      turnNumber: 1,
    }, 1_200);

    expect(move.type).toBe('move');
    if (move.type === 'move') {
      const from = board[move.from.row][move.from.col];
      expect(from?.piece).not.toBe('king');
    }
  });

  it('슈퍼 엔진도 1수 왕 캡처를 고른다', () => {
    const board = emptyBoard();
    board[4][0] = { piece: 'king', owner: 'first', isPromoted: false };
    board[3][2] = { piece: 'gold', owner: 'first', isPromoted: false };
    board[2][2] = { piece: 'king', owner: 'second', isPromoted: false };
    board[0][4] = { piece: 'gold', owner: 'second', isPromoted: false };

    const move = findBestMoveIterativeSuper({
      board,
      prisoners: { first: [], second: [] },
      currentOwner: 'first',
      turnNumber: 12,
    }, 800);

    expect(move).toEqual({
      type: 'move',
      from: { row: 3, col: 2 },
      to: { row: 2, col: 2 },
    });
  });
});
