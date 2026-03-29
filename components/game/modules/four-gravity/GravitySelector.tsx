'use client';

import type { Direction, Phase } from '@/shared/types/four-gravity';

interface Props {
  phase: Phase;
  isMyTurn: boolean;
  lastGravity: Direction | null;
  onSelect: (direction: Direction) => void;
  winner: string | null;
}

const DIRECTIONS: { key: Direction; label: string }[] = [
  { key: 'up', label: '▲ 상' },
  { key: 'down', label: '▼ 하' },
  { key: 'left', label: '◀ 좌' },
  { key: 'right', label: '▶ 우' },
  { key: 'none', label: '무' },
];

export default function GravitySelector({ phase, isMyTurn, lastGravity, onSelect, winner }: Props) {
  const isActive = phase === 'gravity' && isMyTurn && !winner;

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {DIRECTIONS.map(({ key, label }) => {
        const isForbidden = lastGravity !== null && key === lastGravity;
        const disabled = !isActive || isForbidden;

        return (
          <button
            key={key}
            onClick={() => !disabled && onSelect(key)}
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
