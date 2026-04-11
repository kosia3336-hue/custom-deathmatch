'use client';

import { useState, useCallback } from 'react';
import { INITIAL_WHITE, INITIAL_BLACK } from '@/shared/types/number4';

interface TileTrackerProps {
  playerNickname?: string;
}

export default function TileTracker({ playerNickname }: TileTrackerProps = {}) {
  const [white, setWhite] = useState(INITIAL_WHITE);
  const [black, setBlack] = useState(INITIAL_BLACK);

  const adjust = useCallback(
    (color: 'white' | 'black', delta: number) => {
      if (color === 'white') {
        setWhite((v) => Math.min(INITIAL_WHITE, Math.max(0, v + delta)));
      } else {
        setBlack((v) => Math.min(INITIAL_BLACK, Math.max(0, v + delta)));
      }
    },
    [],
  );

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold text-gray-400 tracking-wide">
        {playerNickname ? `${playerNickname} 타일 추리` : '상대 타일 추리'}
      </div>

      <div className="flex flex-col gap-2">
        {/* 백색 행 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded border border-gray-300 bg-white" />
            <span className="text-xs text-gray-500">백색</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjust('white', -1)}
              disabled={white <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="백색 감소"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums text-gray-700">
              {white}
            </span>
            <button
              onClick={() => adjust('white', 1)}
              disabled={white >= INITIAL_WHITE}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="백색 증가"
            >
              +
            </button>
          </div>
        </div>

        {/* 흑색 행 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded border border-gray-600 bg-gray-800" />
            <span className="text-xs text-gray-500">흑색</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjust('black', -1)}
              disabled={black <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="흑색 감소"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums text-gray-700">
              {black}
            </span>
            <button
              onClick={() => adjust('black', 1)}
              disabled={black >= INITIAL_BLACK}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="흑색 증가"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
