'use client';

import { motion } from 'framer-motion';
import type { CellType } from '@/shared/types/four-gravity';
import type { SkinTheme } from '@/lib/skins/registry';

interface Props {
  cellType: CellType;
  clickable: boolean;
  isNeutralCandidate: boolean;
  isWinCell: boolean;
  isLastPlaced: boolean;
  isDimmed: boolean;
  previewColor: 'black' | 'white' | null;
  gameOver: boolean;
  skin?: SkinTheme | null;
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
  skin,
  onClick,
}: Props) {
  const isCosmos = skin === 'cosmos';

  const bg = isCosmos
    ? 'skin-cosmos-cell'
    : isWinCell && gameOver
      ? 'bg-red-50'
      : isNeutralCandidate
        ? 'bg-blue-50'
        : isDimmed
          ? 'bg-gray-100/50'
          : 'bg-[#f9fafb]';

  const border = isCosmos
    ? 'border'
    : isNeutralCandidate
      ? 'border border-dashed border-blue-400'
      : 'border border-gray-200';

  // 코스모스 돌 스타일
  const stoneClass = isCosmos
    ? cellType === 'black'
      ? 'skin-cosmos-stone skin-cosmos-stone-black'
      : cellType === 'white'
        ? 'skin-cosmos-stone skin-cosmos-stone-white'
        : ''
    : cellType === 'black'
      ? 'bg-[#1a1a2e] shadow-md'
      : cellType === 'white'
        ? 'border border-gray-300 bg-white shadow-md'
        : '';

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
            ${stoneClass}
            ${isLastPlaced && !gameOver ? (isCosmos ? 'ring-2 ring-violet-300 ring-offset-1 ring-offset-transparent' : 'ring-2 ring-yellow-400 ring-offset-1') : ''}
            ${isWinCell && gameOver ? (isCosmos ? 'skin-cosmos-win' : 'ring-2 ring-red-500') : ''}
          `}
        >
          {cellType === 'neutral' && (
            isCosmos
              ? <div className="skin-cosmos-neutral" />
              : <div className="h-[65%] w-[65%] rotate-45 rounded-sm bg-gray-400 shadow-sm" />
          )}
        </motion.div>
      )}

      {clickable && cellType === 'empty' && previewColor && (
        <div
          className={`
            absolute h-[80%] w-[80%] rounded-full opacity-0 transition-opacity group-hover:opacity-40
            ${isCosmos
              ? (previewColor === 'black' ? 'skin-cosmos-stone-black' : 'skin-cosmos-stone-white')
              : (previewColor === 'black' ? 'bg-[#1a1a2e]' : 'border border-gray-300 bg-white')}
          `}
        />
      )}

      {isNeutralCandidate && cellType === 'empty' && (
        <div className={`absolute h-[40%] w-[40%] rotate-45 rounded-sm opacity-40 ${isCosmos ? 'bg-amber-300' : 'bg-blue-300'}`} />
      )}
    </div>
  );
}
