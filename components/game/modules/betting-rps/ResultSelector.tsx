'use client';

import { useState } from 'react';
import type { BRPSResult } from '@/shared/types/betting-rps';
import { getSocket } from '@/lib/socket';
import { RESULT_LABELS } from './constants';

const RESULTS: BRPSResult[] = ['win', 'draw', 'lose'];

const BUTTON_STYLES: Record<BRPSResult, string> = {
  win: 'border-blue-300 text-blue-700 hover:border-blue-500 hover:bg-blue-50',
  draw: 'border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-50',
  lose: 'border-red-300 text-red-700 hover:border-red-500 hover:bg-red-50',
};

const SELECTED_STYLES: Record<BRPSResult, string> = {
  win: 'border-blue-500 bg-blue-500 text-white',
  draw: 'border-amber-500 bg-amber-500 text-white',
  lose: 'border-red-500 bg-red-500 text-white',
};

interface Props {
  disabled?: boolean;
}

export default function ResultSelector({ disabled }: Props) {
  const [selected, setSelected] = useState<BRPSResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    getSocket().emit('game:action', { type: 'submitMatch', result: selected });
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3 text-center text-sm font-medium text-blue-800">
        승부 결과를 선택하세요
      </div>
      <div className="flex gap-2">
        {RESULTS.map((r) => (
          <button
            key={r}
            onClick={() => !submitted && setSelected(r)}
            disabled={submitted || disabled}
            className={`flex-1 rounded-lg border-2 bg-white py-3 text-base font-bold transition disabled:cursor-not-allowed ${
              selected === r ? SELECTED_STYLES[r] : BUTTON_STYLES[r]
            }`}
          >
            {RESULT_LABELS[r]}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={!selected || submitted || disabled}
        className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitted ? '제출 완료' : '제출'}
      </button>
    </div>
  );
}
