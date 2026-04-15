'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { NF4PlayerInfo, NF4Number } from '@/shared/types/number4';
import { TILES_PER_ROUND } from '@/shared/types/number4';
import { NUMBER_INFO } from './constants';
import Button from '@/components/ui/Button';

interface SubmitSelectorProps {
  player: NF4PlayerInfo;
  currentSide: 'player1' | 'player2' | null;
  isSpectator: boolean;
}

export default function SubmitSelector({ player, currentSide, isSpectator }: SubmitSelectorProps) {
  const maxWhite = Math.min(TILES_PER_ROUND, player.remainingWhite);
  const minWhite = Math.max(0, TILES_PER_ROUND - player.remainingBlack);
  const [white, setWhite] = useState(Math.max(minWhite, Math.min(4, maxWhite)));
  const black = TILES_PER_ROUND - white;
  const [selectedNumber, setSelectedNumber] = useState<NF4Number | null>(null);

  const tilesValid = white >= minWhite && white <= maxWhite && black >= 0 && black <= player.remainingBlack;
  const isValid = tilesValid && selectedNumber !== null;
  const tileChoiceFixed = minWhite === maxWhite;

  const handleSubmit = () => {
    if (!isValid || isSpectator) return;
    getSocket().emit('game:action', { type: 'submit', white, black, number: selectedNumber! });
  };

  const sideLabel = currentSide === 'player1' ? '1P' : currentSide === 'player2' ? '2P' : '';

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4">
      {sideLabel && (
        <div className="flex justify-center">
          <div className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
            {sideLabel} 차례
          </div>
        </div>
      )}

      {/* 타일 선택 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">타일</span>
          <span className="text-xs text-gray-400">
            보유 □{player.remainingWhite} ■{player.remainingBlack}
          </span>
        </div>

        {tileChoiceFixed ? (
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <span>백색 □ <strong>{white}</strong></span>
            <span>흑색 ■ <strong>{black}</strong></span>
            <span className="text-xs text-gray-400">(선택 불가)</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">백색 □</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWhite((v) => Math.max(minWhite, v - 1))}
                  disabled={white <= minWhite}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center text-xl font-bold">{white}</span>
                <button
                  onClick={() => setWhite((v) => Math.min(maxWhite, v + 1))}
                  disabled={white >= maxWhite}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
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
        )}

        {/* 타일 미리보기 */}
        <div className="flex justify-center gap-1">
          {Array.from({ length: TILES_PER_ROUND }, (_, i) => (
            <div
              key={i}
              className={`h-7 w-7 rounded border-2 transition-colors ${
                i < white ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'
              }`}
            />
          ))}
        </div>

        <div className="text-center text-xs text-gray-400">
          제시 후 잔여: □{player.remainingWhite - white} ■{player.remainingBlack - black}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 넘버 선택 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">넘버</span>
        <div className="grid grid-cols-5 gap-1.5">
          {NUMBER_INFO.map((info) => {
            const isSelected = selectedNumber === info.number;
            return (
              <button
                key={info.number}
                onClick={() => setSelectedNumber(info.number)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl font-bold" style={{ color: info.color }}>
                  {info.number}
                </span>
                <span className="text-xs font-semibold" style={{ color: info.color }}>
                  +{info.reward}
                </span>
                <span className="text-center text-[9px] leading-tight text-gray-400">
                  {info.condition}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={!isValid || isSpectator}>
        확인
      </Button>
    </div>
  );
}
