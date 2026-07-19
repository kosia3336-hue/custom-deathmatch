'use client';

import { useEffect, useState } from 'react';
import type { SBNWTile } from '@/shared/types/silper-bnw';
import { SBNW_INITIAL_TILES } from '@/shared/types/silper-bnw';
import type { SkinTheme } from '@/lib/skins/registry';

interface Props {
  /** 상대가 사용한 타일 누적 카운트 */
  opponentUsed: Record<SBNWTile, number>;
  rematchIndex: number;
  skin?: SkinTheme | null;
}

const TILE_VALUES: SBNWTile[] = [0, 1, 2, 3, 4];

export default function OpponentTileTracker({ opponentUsed, rematchIndex, skin }: Props) {
  const isMeow = skin === 'meow';
  const computeAuto = (): Record<SBNWTile, number> => ({
    0: SBNW_INITIAL_TILES[0] - (opponentUsed[0] ?? 0),
    1: SBNW_INITIAL_TILES[1] - (opponentUsed[1] ?? 0),
    2: SBNW_INITIAL_TILES[2] - (opponentUsed[2] ?? 0),
    3: SBNW_INITIAL_TILES[3] - (opponentUsed[3] ?? 0),
    4: SBNW_INITIAL_TILES[4] - (opponentUsed[4] ?? 0),
  });

  const [memo, setMemo] = useState<Record<SBNWTile, number>>(computeAuto);

  // 재대결(새 세그먼트) 시작 시에만 리셋
  useEffect(() => {
    setMemo(computeAuto());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rematchIndex]);

  const adjust = (t: SBNWTile, delta: number) => {
    setMemo((prev) => ({
      ...prev,
      [t]: Math.min(SBNW_INITIAL_TILES[t], Math.max(0, prev[t] + delta)),
    }));
  };

  return (
    <div
      className={
        isMeow
          ? 'skin-meow-tracker space-y-1.5 p-3'
          : 'space-y-1.5 rounded-xl border border-gray-200 bg-gray-50 p-3'
      }
    >
      <p className={`text-xs font-semibold ${isMeow ? 'skin-meow-heading' : 'text-gray-500'}`}>
        {isMeow ? '🐾 상대 잔여 타일 추정' : '상대 잔여 타일 추정'}
      </p>
      {TILE_VALUES.map((t) => {
        const val = memo[t];
        const canDec = val > 0;
        const canInc = val < SBNW_INITIAL_TILES[t];
        return (
          <div key={t} className="flex items-center gap-2 text-xs">
            <span className={`w-4 font-bold ${isMeow ? 'skin-meow-heading' : 'text-gray-700'}`}>{t}:</span>
            <button
              onClick={() => adjust(t, -1)}
              disabled={!canDec}
              className={`flex h-6 w-6 items-center justify-center rounded border text-sm font-bold transition-colors
                ${isMeow
                  ? 'skin-meow-tracker-btn'
                  : canDec
                    ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                }`}
              aria-label={`${t} 감소`}
            >
              −
            </button>
            <span className={`w-6 text-center text-sm font-bold tabular-nums ${isMeow ? 'skin-meow-heading' : 'text-gray-800'}`}>{val}</span>
            <button
              onClick={() => adjust(t, +1)}
              disabled={!canInc}
              className={`flex h-6 w-6 items-center justify-center rounded border text-sm font-bold transition-colors
                ${isMeow
                  ? 'skin-meow-tracker-btn'
                  : canInc
                    ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                }`}
              aria-label={`${t} 증가`}
            >
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}
