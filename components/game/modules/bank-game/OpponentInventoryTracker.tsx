'use client';

import { BANK_INITIAL_INVENTORY, type BankDenomination } from '@/shared/types/bank-game';
import { useState } from 'react';
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
    <div
      data-panel-inset
      className="bank-tracker border-cdm-border bg-cdm-bg-elev-1 space-y-3 rounded-xl border-2 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-cdm-fg-muted text-sm font-semibold">상대 잔여 추리</p>
        <button
          type="button"
          onClick={() => setSpent(buildInitial())}
          className="border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 rounded border px-3 py-1 text-xs font-semibold"
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
            <div
              key={denom}
              className={`bank-bet-row bank-bet-row--${denom} bg-cdm-bg flex items-center gap-1.5 rounded-lg px-2 py-1`}
            >
              <span className="bank-bet-denom text-cdm-fg-muted w-16 shrink-0 truncate text-xs font-bold">
                {style.label}
              </span>
              <button
                type="button"
                disabled={val <= 0}
                onClick={() => adjust(denom, -1)}
                className="bank-step-action border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-9 w-9 shrink-0 rounded-md border text-lg font-bold disabled:opacity-40"
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
                className="bank-quantity-input border-cdm-border bg-cdm-bg text-cdm-fg focus:ring-cdm-primary h-9 min-w-0 flex-1 rounded-md border text-center text-base font-bold tabular-nums focus:ring-2 focus:outline-none"
              />
              <button
                type="button"
                disabled={val >= max}
                onClick={() => adjust(denom, +1)}
                className="bank-step-action border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-9 w-9 shrink-0 rounded-md border text-lg font-bold disabled:opacity-40"
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
