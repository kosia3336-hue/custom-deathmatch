'use client';

import { motion } from 'framer-motion';
import type { CellType } from '@/classic-era/shared/types/four-gravity';

interface Props {
  cellType: CellType;
  clickable: boolean;
  isNeutralCandidate: boolean;
  isWinCell: boolean;
  isLastPlaced: boolean;
  isDimmed: boolean;
  previewColor: 'black' | 'white' | null;
  gameOver: boolean;
  onClick: () => void;
}

export default function Cell({
  cellType,
  clickable,
  isNeutralCandidate,
  isWinCell,
  isLastPlaced,
  isDimmed,
  previewColor,
  gameOver,
  onClick,
}: Props) {
  const bg = isWinCell && gameOver
    ? 'bg-red-50'
    : isNeutralCandidate
      ? 'bg-blue-50'
      : isDimmed
        ? 'bg-gray-100/50'
        : 'bg-[#f9fafb]';

  const border = isNeutralCandidate
    ? 'border border-dashed border-blue-400'
    : 'border border-gray-200';

  return (
    <div
      className={`
        relative flex items-center justify-center
        ${bg} ${border}
        ${clickable ? 'cursor-pointer' : ''}
        group
      `}
      onClick={clickable ? onClick : undefined}
    >
      {cellType !== 'empty' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`
            flex h-[80%] w-[80%] items-center justify-center
            ${cellType === 'neutral' ? '' : 'rounded-full'}
            ${cellType === 'black' ? 'bg-[#1a1a2e] shadow-md' : ''}
            ${cellType === 'white' ? 'border border-gray-300 bg-white shadow-md' : ''}
            ${isLastPlaced && !gameOver ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
            ${isWinCell && gameOver ? 'ring-2 ring-red-500' : ''}
          `}
        >
          {cellType === 'neutral' && (
            <div className="h-[65%] w-[65%] rotate-45 rounded-sm bg-gray-400 shadow-sm" />
          )}
        </motion.div>
      )}

      {clickable && cellType === 'empty' && previewColor && (
        <div
          className={`
            absolute h-[80%] w-[80%] rounded-full opacity-0 transition-opacity group-hover:opacity-40
            ${previewColor === 'black' ? 'bg-[#1a1a2e]' : 'border border-gray-300 bg-white'}
          `}
        />
      )}

      {isNeutralCandidate && cellType === 'empty' && (
        <div className="absolute h-[40%] w-[40%] rotate-45 rounded-sm bg-blue-300 opacity-40" />
      )}
    </div>
  );
}
