'use client';

import type { Direction, Phase } from '@/classic-era/shared/types/four-gravity';
import { DIRECTION_LIST } from './constants';

interface Props {
  phase: Phase;
  isMyTurn: boolean;
  lastGravity: Direction | null;
  onSelect: (direction: Direction) => void;
  winner: string | null;
}

export default function GravitySelector({ phase, isMyTurn, lastGravity, onSelect, winner }: Props) {
  const isActive = phase === 'gravity' && isMyTurn && !winner;

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {DIRECTION_LIST.map(({ key, label }) => {
        const isForbidden = lastGravity !== null && key === lastGravity;
        const disabled = !isActive || isForbidden;

        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            disabled={disabled}
            className={`
              min-h-[44px] min-w-[52px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors
              ${
                isActive && !disabled
                  ? 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-100'
                  : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
              }
            `}
            title={isForbidden ? '직전에 사용한 방향입니다' : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
