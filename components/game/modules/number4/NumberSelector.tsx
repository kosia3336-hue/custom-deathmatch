'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { NF4Number } from '@/shared/types/number4';
import { NUMBER_INFO } from './constants';
import Button from '@/components/ui/Button';

interface NumberSelectorProps {
  submitted: boolean;
  currentSide: 'player1' | 'player2' | null;
  isSpectator: boolean;
}

export default function NumberSelector({ submitted, currentSide, isSpectator }: NumberSelectorProps) {
  const [selected, setSelected] = useState<NF4Number | null>(null);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-8">
        <div className="text-green-600 font-medium">넘버 선택 완료 ✓</div>
        <div className="animate-pulse text-gray-400">●  ●  ●</div>
        <p className="text-sm text-gray-500">상대의 넘버 선택을 기다리는 중...</p>
      </div>
    );
  }

  const handleSubmit = () => {
    if (selected === null || isSpectator) return;
    getSocket().emit('game:action', { type: 'submitNumber', number: selected });
  };

  const sideLabel = currentSide === 'player1' ? '1P' : currentSide === 'player2' ? '2P' : '';

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6">
      {sideLabel && (
        <div className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
          {sideLabel} 차례
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 w-full sm:grid-cols-5">
        {NUMBER_INFO.map((info) => {
          const isSelected = selected === info.number;
          return (
            <button
              key={info.number}
              onClick={() => setSelected(info.number)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl font-bold" style={{ color: info.color }}>
                {info.number}
              </span>
              <span className="text-xs font-semibold" style={{ color: info.color }}>
                +{info.reward}점
              </span>
              <span className="text-[10px] leading-tight text-gray-500 text-center">
                {info.condition}
              </span>
            </button>
          );
        })}
      </div>

      <Button onClick={handleSubmit} disabled={selected === null || isSpectator}>
        확인
      </Button>
    </div>
  );
}
