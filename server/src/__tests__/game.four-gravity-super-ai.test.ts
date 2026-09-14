import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '../socket/games/four-gravity/board.js';
import { getCandidateCells, getCandidateCellsSuper } from '../socket/games/four-gravity/ai.js';

describe('사중력 슈퍼 AI 후보', () => {
  it('같은 줄 bounding box 밖 빈칸을 후보에 넣는다', () => {
    const board = createEmptyBoard();
    board[4][0] = 'black';
    board[4][1] = 'black';

    const near = getCandidateCells(board);
    const superCells = getCandidateCellsSuper(board);

    expect(near.some((p) => p.row === 4 && p.col === 8)).toBe(false);
    expect(superCells.some((p) => p.row === 4 && p.col === 8)).toBe(true);
  });
});
