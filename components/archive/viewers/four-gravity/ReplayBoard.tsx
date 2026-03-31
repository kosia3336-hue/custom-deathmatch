'use client';

import { useMemo } from 'react';
import type { CellType, Position } from '@/shared/types/four-gravity';
import { BOARD_SIZE } from '@/shared/types/four-gravity';

interface Props {
  board: CellType[][];
  placedPosition: Position | null;
  winLine: Position[] | null;
}

export default function ReplayBoard({ board, placedPosition, winLine }: Props) {
  const winLineSet = useMemo(
    () => new Set((winLine ?? []).map((p) => `${p.row},${p.col}`)),
    [winLine],
  );

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
          const isWinCell = winLineSet.has(key);
          const isLastPlaced =
            placedPosition?.row === r && placedPosition?.col === c;

          const bg = isWinCell
            ? 'bg-red-50'
            : 'bg-[#f9fafb]';

          return (
            <div
              key={key}
              className={`relative flex items-center justify-center border border-gray-200 ${bg}`}
            >
              {cell !== 'empty' && (
                <div
                  className={`
                    flex h-[80%] w-[80%] items-center justify-center
                    ${cell === 'neutral' ? '' : 'rounded-full'}
                    ${cell === 'black' ? 'bg-[#1a1a2e] shadow-md' : ''}
                    ${cell === 'white' ? 'border border-gray-300 bg-white shadow-md' : ''}
                    ${isLastPlaced ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                    ${isWinCell ? 'ring-2 ring-red-500' : ''}
                  `}
                >
                  {cell === 'neutral' && (
                    <div className="h-[65%] w-[65%] rotate-45 rounded-sm bg-gray-400 shadow-sm" />
                  )}
                </div>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
