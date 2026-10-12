'use client';

import { BANK_INITIAL_INVENTORY } from '@/shared/types/bank-game';
import type { useBankInventoryNotes } from './hooks/useBankInventoryNotes';
import { DENOM_ORDER, DENOM_STYLES } from './constants';

/** 잔여 장수 메모. 기록 창의 선택과 독립적으로 라운드를 이동한다. */
export default function OpponentInventoryTracker({
  notes,
}: {
  notes: ReturnType<typeof useBankInventoryNotes>;
}) {
  const { note, round, currentRound, selectRound, setNote, reset } = notes;

  return (
    <div
      data-panel-inset
      className="bank-tracker border-cdm-border bg-cdm-bg-elev-1 min-w-0 space-y-3 rounded-xl border p-2"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={reset}
          className="border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 rounded border px-3 py-1 text-xs font-semibold"
        >
          초기화
        </button>
        <div className="flex items-center gap-1 text-xs tabular-nums">
          <button
            type="button"
            aria-label="이전 라운드 메모"
            disabled={round <= 1}
            onClick={() => selectRound(round - 1)}
            className="border-cdm-border h-8 w-8 rounded border text-lg disabled:opacity-30"
          >
            ‹
          </button>
          <span aria-live="polite" className="text-cdm-fg min-w-8 text-center">
            R{round}
          </span>
          <button
            type="button"
            aria-label="다음 라운드 메모"
            disabled={round >= currentRound}
            onClick={() => selectRound(round + 1)}
            className="border-cdm-border h-8 w-8 rounded border text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {DENOM_ORDER.map((denom) => {
          const val = note[denom];
          const max = BANK_INITIAL_INVENTORY[denom];
          const style = DENOM_STYLES[denom];
          return (
            <div
              key={denom}
              className={`bank-bet-row bank-bet-row--${denom} bg-cdm-bg grid min-w-0 grid-cols-[minmax(0,1fr)_28px_minmax(40px,0.8fr)_28px] items-center gap-1 rounded-lg px-1 py-1`}
            >
              <span className="bank-bet-denom text-cdm-fg-muted min-w-0 max-w-full text-[11px] font-bold whitespace-nowrap">
                {style.label}
              </span>
              <button
                type="button"
                aria-label={`${style.label} 메모 1장 빼기`}
                disabled={val <= 0}
                onClick={() => setNote(denom, val - 1)}
                className="bank-step-action border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-8 w-7 rounded-md border text-lg font-bold disabled:opacity-40"
              >
                −
              </button>
              <input
                aria-label={`${style.label} 잔여 추리`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={val}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                  setNote(denom, isNaN(n) ? 0 : n);
                }}
                className="bank-quantity-input border-cdm-border bg-cdm-bg text-cdm-fg focus:ring-cdm-primary h-8 w-full min-w-0 rounded-md border text-center text-[16px] font-bold tabular-nums focus:ring-2 focus:outline-none"
              />
              <button
                type="button"
                aria-label={`${style.label} 메모 1장 더`}
                disabled={val >= max}
                onClick={() => setNote(denom, val + 1)}
                className="bank-step-action border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-8 w-7 rounded-md border text-lg font-bold disabled:opacity-40"
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
