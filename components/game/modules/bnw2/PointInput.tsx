'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';

interface Props {
  remaining: number;
  actionType: 'submitFirst' | 'submitSecond';
  label: string;
}

export default function PointInput({ remaining, actionType, label }: Props) {
  const [value, setValue] = useState<number>(0);

  const clamp = (v: number) => Math.min(remaining, Math.max(0, Math.round(v)));

  const handleSubmit = () => {
    getSocket().emit('game:action', { type: actionType, points: value });
  };

  if (remaining === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-center text-sm font-semibold text-indigo-700">{label}</p>
        <p className="text-center text-xs text-gray-500">잔여 포인트가 없습니다. 0을 제시합니다.</p>
        <button
          onClick={handleSubmit}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 active:bg-indigo-800"
        >
          0 제시
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-center text-sm font-semibold text-indigo-700">{label}</p>
      <p className="text-center text-xs text-gray-500">
        잔여 포인트: <span className="font-bold text-gray-800">{remaining}</span>
      </p>

      {/* 빠른 조절 버튼 (위 줄) */}
      <div className="flex justify-center gap-2">
        {([-10, -5, 5, 10] as const).map(delta => (
          <button
            key={delta}
            onClick={() => setValue(v => clamp(v + delta))}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>
      {/* 정밀 조절 + 입력 (아래 줄) */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setValue(v => clamp(v - 1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={e => {
            const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
            setValue(isNaN(n) ? 0 : clamp(n));
          }}
          className="w-24 rounded-lg border border-gray-300 bg-white py-2 text-center text-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => setValue(v => clamp(v + 1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >
          +
        </button>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 active:bg-indigo-800"
      >
        {value}포인트 제시
      </button>
    </div>
  );
}
