'use client';

import type { Cell as CellType, Position } from '@/shared/types/double-sided-chess';
import Board from '@/components/game/modules/double-sided-chess/Board';

interface Props {
  board: CellType[][];
  lastMove: { from: Position | null; to: Position } | null;
}

export default function ReplayBoard({ board, lastMove }: Props) {
  return <Board board={board} lastMove={lastMove} />;
}
