import { describe, expect, it } from 'vitest';
import { applyEskimoAction, createEskimoBoard } from '@shared/logic/eskimo.js';
import type { EskimoAction, EskimoLastAction } from '@shared/types/eskimo.js';
import {
  getEskimoSlide,
  eskimoSlideOffset,
} from '../../../components/game/modules/eskimo/movement';

const start = { board: createEskimoBoard('first', 'second'), turnNumber: 1, lastAction: null };
function moved(
  previous: typeof start | ReturnType<typeof firstMove>,
  action: EskimoAction,
  actorId = 'first',
) {
  const lastAction: EskimoLastAction = {
    turn: previous.turnNumber,
    actorId,
    action,
    bear: previous.board[action.from.row][action.from.col] === 'bear',
  };
  return {
    board: applyEskimoAction(previous.board, action),
    turnNumber: previous.turnNumber + 1,
    lastAction,
  };
}
function firstMove() {
  return {
    board: applyEskimoAction(start.board, {
      type: 'move',
      from: { row: 4, col: 0 },
      to: { row: 1, col: 0 },
    }),
    turnNumber: 2,
    lastAction: {
      turn: 1,
      actorId: 'first',
      bear: false,
      action: { type: 'move' as const, from: { row: 4, col: 0 }, to: { row: 1, col: 0 } },
    },
  };
}

describe('Eskimo confirmed move animation', () => {
  it('slides a three-cell move and reverses the displayed offset for the second seat', () => {
    const slide = getEskimoSlide(start, firstMove())!;
    expect(slide.durationMs).toBe(420);
    expect(eskimoSlideOffset(slide, false)).toEqual({ x: 0, y: 3 });
    expect(eskimoSlideOffset(slide, true)).toEqual({ x: -0, y: -3 });
  });
  it('animates opponent moves and diagonal bear moves', () => {
    const previous = firstMove();
    const next = moved(
      previous,
      { type: 'move', from: { row: 0, col: 4 }, to: { row: 3, col: 4 } },
      'second',
    );
    expect(getEskimoSlide(previous, next)?.move.actorId).toBe('second');
    const bear = moved(next, { type: 'move', from: { row: 2, col: 2 }, to: { row: 1, col: 3 } });
    const slide = getEskimoSlide(next, bear)!;
    expect(slide.move.bear).toBe(true);
    expect(eskimoSlideOffset(slide, false)).toEqual({ x: -1, y: 1 });
  });
  it('does not replay initial load, duplicate updates, undo or skipped moves', () => {
    const next = firstMove();
    expect(getEskimoSlide(null, next)).toBeNull();
    expect(getEskimoSlide(next, structuredClone(next))).toBeNull();
    expect(getEskimoSlide(next, start)).toBeNull();
    const skipped = moved(
      next,
      { type: 'move', from: { row: 0, col: 4 }, to: { row: 3, col: 4 } },
      'second',
    );
    expect(getEskimoSlide(start, skipped)).toBeNull();
  });
  it('animates the final move even if the server keeps the final turn number', () => {
    expect(getEskimoSlide(start, { ...firstMove(), turnNumber: 1 })).not.toBeNull();
  });
  it('does not animate a board replacement with additional changed cells', () => {
    const next = firstMove();
    next.board[0][3] = null;
    expect(getEskimoSlide(start, next)).toBeNull();
  });
});
