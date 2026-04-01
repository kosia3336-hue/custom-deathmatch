'use client';

import type { Cell as CellType } from '@/shared/types/double-sided-chess';
import Piece from './Piece';
import { cn } from '@/lib/utils';

interface Props {
  cell: CellType;
  isSelected: boolean;
  isValidMove: boolean;
  isCaptureTarget: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  clickable: boolean;
  isDimmed: boolean;
  isTerritory: 'first' | 'second' | null;
  onClick: () => void;
}

export default function Cell({
  cell,
  isSelected,
  isValidMove,
  isCaptureTarget,
  isLastMoveFrom,
  isLastMoveTo,
  clickable,
  isDimmed,
  isTerritory,
  onClick,
}: Props) {  
  const bg = isSelected
    ? 'bg-amber-100'
    : isLastMoveTo
      ? 'bg-amber-200/60'
      : isLastMoveFrom
        ? 'bg-[#c8b070]/60'
        : isTerritory === 'first'
          ? 'bg-red-100/30'
          : isTerritory === 'second'
            ? 'bg-blue-100/30'
            : 'bg-[#e8d4a8]';

  const border = isSelected
    ? 'ring-2 ring-inset ring-amber-400'
    : isCaptureTarget
      ? 'ring-2 ring-inset ring-red-400'
      : '';

  return (
    <div
      className={cn(
        'relative border border-[#8b6914]/30',
        bg,
        border,
        clickable && 'cursor-pointer',
        isDimmed && 'opacity-40',
      )}
      onClick={clickable ? onClick : undefined}
    >
      {cell && (
        <Piece piece={cell.piece} owner={cell.owner} isPromoted={cell.isPromoted} />
      )}

      {isValidMove && !cell && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[30%] w-[30%] rounded-full bg-green-500/50" />
        </div>
      )}

      {isCaptureTarget && cell && (
        <div className="absolute inset-0 bg-red-400/20" />
      )}
    </div>
  );
}
