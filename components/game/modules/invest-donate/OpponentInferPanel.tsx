'use client';

import type { IDCoinStock } from '@/shared/types/invest-donate';
import { stockTotal } from '@/shared/types/invest-donate';
import { COIN_DENOMINATIONS } from './constants';

interface Props {
  opponentNickname: string;
  opponentCoinStock: IDCoinStock;
}

export default function OpponentInferPanel({ opponentNickname, opponentCoinStock }: Props) {
  return (
    <div data-panel-inset className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-gray-400">
          {opponentNickname} 남은 코인
        </span>
        <span className="text-xs font-bold text-gray-500 tabular-nums">
          {stockTotal(opponentCoinStock)}원
        </span>
      </div>
      <div className="flex items-center justify-around">
        {COIN_DENOMINATIONS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${color}`}
            >
              {label}
            </span>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">
              {opponentCoinStock[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
