'use client';

import type { BankPhase } from '@/shared/types/bank-game';
import { PHASE_LABELS, formatKRW } from './constants';

interface Props {
  round: number;
  maxRound: number;
  phase: BankPhase;
  firstNick: string;
  loserAmountTotal: number;
}

export default function MobileHeader({
  round,
  maxRound,
  phase,
  firstNick,
  loserAmountTotal,
}: Props) {
  const phaseLabel = PHASE_LABELS[phase] ?? '';
  return (
    <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-1 flex flex-col gap-1 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-base font-extrabold tabular-nums text-gray-800">
          R{round}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-gray-400">/{maxRound}</span>
        {phaseLabel && (
          <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            {phaseLabel}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-amber-600">
          {firstNick} 선
        </span>
      </div>
      {loserAmountTotal > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">누적 패자 금액</span>
          <span className="text-[11px] font-bold tabular-nums text-rose-700">
            {formatKRW(loserAmountTotal)}원
          </span>
        </div>
      )}
    </div>
  );
}
