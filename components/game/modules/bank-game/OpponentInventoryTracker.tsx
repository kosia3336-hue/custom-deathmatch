'use client';

import { useState } from 'react';
import { BANK_INITIAL_INVENTORY, type BankDenomination } from '@/shared/types/bank-game';
import { DENOM_ORDER, DENOM_STYLES } from './constants';

/* ════════════════════════════════════════════════════════════
 * OpponentInventoryTracker — 상대 잔여 추리 (클라 전용)
 *   · BetInput BetRow 와 동일한 레이아웃
 *   · 입력값 = 상대가 썼다고 추정하는 장수, 잔n = 남은 장수 추정
 *   · 라운드 넘어가도 리셋 안 됨 (silper-bnw 패턴)
 * ════════════════════════════════════════════════════════════ */

type Spent = Record<BankDenomination, number>;

function buildInitial(): Spent {
  return { ...BANK_INITIAL_INVENTORY };
}

export default function OpponentInventoryTracker() {
  const [spent, setSpent] = useState<Spent>(buildInitial);

  const adjust = (denom: BankDenomination, delta: number) => {
    setSpent((prev) => ({
      ...prev,
      [denom]: Math.max(0, Math.min(BANK_INITIAL_INVENTORY[denom], prev[denom] + delta)),
    }));
  };

  const setDenom = (denom: BankDenomination, next: number) => {
    const max = BANK_INITIAL_INVENTORY[denom];
    setSpent((prev) => ({ ...prev, [denom]: Math.max(0, Math.min(max, Math.floor(next))) }));
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-600">🔍 상대 잔여 추리</p>
        <button
          type="button"
          onClick={() => setSpent(buildInitial())}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          초기화
        </button>
      </div>

      <div className="space-y-1.5">
        {DENOM_ORDER.map((denom) => {
          const val = spent[denom];
          const max = BANK_INITIAL_INVENTORY[denom];
          const style = DENOM_STYLES[denom];
          return (
            <div key={denom} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1">
              <span className="w-16 shrink-0 truncate text-xs font-bold text-gray-500">
                {style.label}
              </span>
              <button
                type="button"
                disabled={val <= 0}
                onClick={() => adjust(denom, -1)}
                className="h-9 w-9 shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={val}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                  setDenom(denom, isNaN(n) ? 0 : n);
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white text-center text-base font-bold tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <button
                type="button"
                disabled={val >= max}
                onClick={() => adjust(denom, +1)}
                className="h-9 w-9 shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
