'use client';
import { useState } from 'react';
import type { BRPSResult } from '@/shared/types/betting-rps';
import ResultChoices from './ResultChoices';
export default function ResultSelector({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (result: BRPSResult) => void;
}) {
  const [selected, setSelected] = useState<BRPSResult | null>(null);
  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="text-center text-sm font-medium text-blue-800">승부 결과를 선택하세요</div>
      <ResultChoices value={selected} onChange={setSelected} disabled={disabled} />
      <button
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
