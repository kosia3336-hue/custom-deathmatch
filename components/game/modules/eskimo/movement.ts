import {
  ESKIMO_SIZE,
  type EskimoGameData,
  type EskimoLastAction,
} from '../../../../shared/types/eskimo';

type Snapshot = Pick<EskimoGameData, 'board' | 'turnNumber' | 'lastAction'>;
export type EskimoSlide = { move: EskimoLastAction; durationMs: number };

/** Animate one confirmed move only. Initial loads, undo and skipped snapshots snap to the board. */
export function getEskimoSlide(previous: Snapshot | null, next: Snapshot): EskimoSlide | null {
  const move = next.lastAction;
  if (
    !previous ||
    !move ||
    move.turn !== previous.turnNumber ||
    previous.lastAction?.turn === move.turn
  )
    return null;
  const { from, to } = move.action;
  const piece = previous.board[from.row][from.col];
  if (!piece || previous.board[to.row][to.col] !== null) return null;
  for (let row = 0; row < ESKIMO_SIZE; row += 1) {
    for (let col = 0; col < ESKIMO_SIZE; col += 1) {
      const expected =
        row === from.row && col === from.col
          ? null
          : row === to.row && col === to.col
            ? piece
            : previous.board[row][col];
      if (next.board[row][col] !== expected) return null;
    }
  }
  const distance = Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col));
  return { move, durationMs: 300 + distance * 40 };
}

/** Offsets are in displayed cells, so the second player's rotated board moves in the correct direction. */
export function eskimoSlideOffset(slide: EskimoSlide, flip: boolean) {
  const { from, to } = slide.move.action;
  const direction = flip ? -1 : 1;
  return { x: (from.col - to.col) * direction, y: (from.row - to.row) * direction };
}
