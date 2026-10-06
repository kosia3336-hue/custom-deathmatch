'use client';
import { useState } from 'react';
import type { BRPSResult } from '@/shared/types/betting-rps';
import ResultChoices from './ResultChoices';
export default function ResultSelector({
  disabled,
  dreamshop = false,
  onSubmit,
}: {
  disabled?: boolean;
  dreamshop?: boolean;
  onSubmit: (result: BRPSResult) => void;
}) {
  const [selected, setSelected] = useState<BRPSResult | null>(null);
  return (
    <div data-brps-input className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="text-center text-sm font-medium text-blue-800">승부 결과를 선택하세요</div>
      <ResultChoices
        dreamshop={dreamshop}
        value={selected}
        onChange={setSelected}
        disabled={disabled}
      />
      <button
        data-brps-submit
        onClick={() => {
          if (selected && !disabled) onSubmit(selected);
        }}
        disabled={!selected || disabled}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        제출
      </button>
    </div>
  );
}
