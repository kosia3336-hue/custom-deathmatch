'use client';

import { useMemo } from 'react';
import type { CellType, Phase, Position } from '@/shared/types/four-gravity';
import { BOARD_SIZE } from '@/shared/types/four-gravity';
import Cell from './Cell';

interface Props {
  board: CellType[][];
  phase: Phase;
  isMyTurn: boolean;
  myColor: 'black' | 'white' | null;
  neutralCandidates: Position[];
  placedPosition: Position | null;
  winLine: Position[] | null;
  winner: string | null;
  onCellClick: (row: number, col: number) => void;
}

export default function Board({
  board,
  phase,
  isMyTurn,
  myColor,
  neutralCandidates,
  placedPosition,
  winLine,
  winner,
  onCellClick,
}: Props) {
  const neutralSet = useMemo(
    () => new Set(neutralCandidates.map((p) => `${p.row},${p.col}`)),
    [neutralCandidates],
  );

  const winLineSet = useMemo(
    () => new Set((winLine ?? []).map((p) => `${p.row},${p.col}`)),
    [winLine],
  );

  const isPlacePhase = isMyTurn && phase === 'place' && !winner;
  const isNeutralPhase = isMyTurn && phase === 'neutral' && !winner;

  return (
    <div
      className="grid rounded-lg border border-gray-300 bg-white shadow-sm"
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        width: 'min(100%, min(60vh, 500px))',
        aspectRatio: '1',
      }}
    >
      {board.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          const isNeutralCandidate = neutralSet.has(key);
          const isWinCell = winLineSet.has(key);
          const isLastPlaced = placedPosition?.row === r && placedPosition?.col === c;

          let clickable = false;
          if (isPlacePhase && cell === 'empty') clickable = true;
          if (isNeutralPhase && isNeutralCandidate) clickable = true;

          return (
            <Cell
              key={key}
              cellType={cell}
              clickable={clickable}
              isNeutralCandidate={isNeutralCandidate}
              isWinCell={isWinCell}
              isLastPlaced={isLastPlaced}
              isDimmed={isNeutralPhase && !isNeutralCandidate && cell === 'empty'}
              previewColor={isPlacePhase && cell === 'empty' ? myColor : null}
              gameOver={!!winner}
              onClick={() => onCellClick(r, c)}
            />
          );
        }),
      )}
    </div>
  );
}
