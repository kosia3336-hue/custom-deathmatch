import { describe, it, expect } from 'vitest';
import { findExactFour, checkWin, hasEmptyCells } from '../socket/games/four-gravity/win.js';
import type { CellType } from '@shared/types/four-gravity.js';

const BOARD_SIZE = 9;

function emptyBoard(): CellType[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill('empty') as CellType[]);
}

/** 보드에 연속으로 셀을 채우는 헬퍼 (수평) */
function setRow(
  board: CellType[][],
  row: number,
  colStart: number,
  count: number,
  type: CellType,
) {
  for (let c = colStart; c < colStart + count; c++) {
    board[row][c] = type;
  }
}

/** 보드에 연속으로 셀을 채우는 헬퍼 (수직) */
function setCol(
  board: CellType[][],
  col: number,
  rowStart: number,
  count: number,
  type: CellType,
) {
  for (let r = rowStart; r < rowStart + count; r++) {
    board[r][col] = type;
  }
}

describe('findExactFour', () => {
  it('수평 4칸 연속이면 위치를 반환한다', () => {
    const board = emptyBoard();
    setRow(board, 2, 1, 4, 'black');
    const result = findExactFour(board, 'black');
    expect(result).not.toBeNull();
    expect(result!.length).toBe(4);
  });

  it('수직 4칸 연속이면 위치를 반환한다', () => {
    const board = emptyBoard();
    setCol(board, 3, 0, 4, 'white');
    const result = findExactFour(board, 'white');
    expect(result).not.toBeNull();
    expect(result!.length).toBe(4);
  });

  it('대각선 4칸 연속이면 위치를 반환한다', () => {
    const board = emptyBoard();
    for (let i = 0; i < 4; i++) board[i][i] = 'black';
    const result = findExactFour(board, 'black');
    expect(result).not.toBeNull();
  });

  it('5칸 연속이면 null을 반환한다 (정확히 4칸만 인정)', () => {
    const board = emptyBoard();
    setRow(board, 0, 0, 5, 'black');
    const result = findExactFour(board, 'black');
    // 5칸 연속은 "정확히 4"가 아님
    expect(result).toBeNull();
  });

  it('3칸 연속이면 null을 반환한다', () => {
    const board = emptyBoard();
    setRow(board, 0, 0, 3, 'black');
    const result = findExactFour(board, 'black');
    expect(result).toBeNull();
  });

  it('빈 보드에서는 null을 반환한다', () => {
    const board = emptyBoard();
    expect(findExactFour(board, 'black')).toBeNull();
  });

  it('중립 돌 4칸 연속도 인식한다', () => {
    const board = emptyBoard();
    setRow(board, 4, 2, 4, 'neutral');
    expect(findExactFour(board, 'neutral')).not.toBeNull();
  });
});

describe('checkWin', () => {
  it('현재 플레이어(black) 4칸이면 current 승리', () => {
    const board = emptyBoard();
    setRow(board, 0, 0, 4, 'black');
    const result = checkWin(board, 'black');
    expect(result?.winner).toBe('current');
    expect(result?.type).toBe('black');
  });

  it('상대방(white) 4칸이면 opponent 승리', () => {
    const board = emptyBoard();
    setRow(board, 0, 0, 4, 'white');
    const result = checkWin(board, 'black'); // 현재 플레이어는 black
    expect(result?.winner).toBe('opponent');
    expect(result?.type).toBe('white');
  });

  it('중립 4칸이면 현재 플레이어 승리 (중립 완성은 current에게 유리)', () => {
    const board = emptyBoard();
    setRow(board, 1, 0, 4, 'neutral');
    const result = checkWin(board, 'black');
    expect(result?.winner).toBe('current');
    expect(result?.type).toBe('neutral');
  });

  it('승리 조건 없으면 null 반환', () => {
    const board = emptyBoard();
    setRow(board, 0, 0, 3, 'black');
    setRow(board, 1, 0, 2, 'white');
    expect(checkWin(board, 'black')).toBeNull();
  });

  it('내 4칸과 상대 4칸이 동시에 있으면 내 4칸 우선', () => {
    const board = emptyBoard();
    setRow(board, 0, 0, 4, 'black');
    setRow(board, 1, 0, 4, 'white');
    const result = checkWin(board, 'black');
    expect(result?.winner).toBe('current');
    expect(result?.type).toBe('black');
  });
});

describe('hasEmptyCells', () => {
  it('빈 셀이 있으면 true', () => {
    const board = emptyBoard();
    expect(hasEmptyCells(board)).toBe(true);
  });

  it('모든 셀이 채워지면 false', () => {
    const board = emptyBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c] = 'black';
      }
    }
    expect(hasEmptyCells(board)).toBe(false);
  });

  it('마지막 셀만 비어 있어도 true', () => {
    const board = emptyBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c] = 'black';
      }
    }
    board[BOARD_SIZE - 1][BOARD_SIZE - 1] = 'empty';
    expect(hasEmptyCells(board)).toBe(true);
  });
});
