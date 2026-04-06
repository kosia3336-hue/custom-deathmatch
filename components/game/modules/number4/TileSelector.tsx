'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { NF4PlayerInfo } from '@/shared/types/number4';
import { TILES_PER_ROUND } from '@/shared/types/number4';
import Button from '@/components/ui/Button';

interface TileSelectorProps {
  player: NF4PlayerInfo;
  currentSide: 'player1' | 'player2' | null;
  isSpectator: boolean;
}

export default function TileSelector({ player, currentSide, isSpectator }: TileSelectorProps) {
  const maxWhite = Math.min(TILES_PER_ROUND, player.remainingWhite);
  const minWhite = Math.max(0, TILES_PER_ROUND - player.remainingBlack);
  const [white, setWhite] = useState(Math.max(minWhite, Math.min(4, maxWhite)));
  const black = TILES_PER_ROUND - white;

  const isValid = white >= minWhite && white <= maxWhite && black >= 0 && black <= player.remainingBlack;

  const handleSubmit = () => {
    if (!isValid || isSpectator) return;
    getSocket().emit('game:action', { type: 'submitTiles', white, black });
  };

  const sideLabel = currentSide === 'player1' ? '1P' : currentSide === 'player2' ? '2P' : '';

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6">
      {sideLabel && (
        <div className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
          {sideLabel} 차례
        </div>
      )}

      <div className="text-sm text-gray-500">
        보유 타일: <span className="font-medium">□{player.remainingWhite}</span>{' '}
        <span className="font-medium">■{player.remainingBlack}</span>
      </div>

      {/* 스테퍼 */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500">백색 □</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWhite((v) => Math.max(minWhite, v - 1))}
              disabled={white <= minWhite}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className="w-8 text-center text-xl font-bold">{white}</span>
            <button
              onClick={() => setWhite((v) => Math.min(maxWhite, v + 1))}
              disabled={white >= maxWhite}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500">흑색 ■</span>
          <span className="text-xl font-bold text-gray-700">{black}</span>
        </div>
      </div>

      {/* 타일 미리보기 */}
      <div className="flex gap-1.5">
        {Array.from({ length: TILES_PER_ROUND }, (_, i) => (
          <div
            key={i}
            className={`h-8 w-8 rounded-md border-2 transition-colors ${
              i < white
                ? 'border-gray-300 bg-white'
                : 'border-gray-600 bg-gray-800'
            }`}
          />
        ))}
      </div>

      {/* 잔여 표시 */}
      <div className="text-xs text-gray-400">
        제시 후 잔여: □{player.remainingWhite - white} ■{player.remainingBlack - black}
      </div>

      <Button onClick={handleSubmit} disabled={!isValid || isSpectator}>
        확인
      </Button>
    </div>
  );
}
