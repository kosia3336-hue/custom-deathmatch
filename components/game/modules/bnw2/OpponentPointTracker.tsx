'use client';

import { bnw2NoteRange } from '@/lib/bnw2PointNotes';
import type { useBNW2PointNotes } from './useBNW2PointNotes';

export function OpponentPointTracker({ notes }: { notes: ReturnType<typeof useBNW2PointNotes> }) {
  const { round, currentRound, stage, estimate, change, reset, selectRound } = notes;
  const { lo, hi } = bnw2NoteRange(stage);

  return (
    <section aria-label={`R${round} 상대 잔여 추리`} className="text-cdm-fg flex flex-col gap-2">
      <div className="text-cdm-fg-muted flex flex-wrap items-center gap-2 text-[11px]">
        {round < currentRound && <span>이전 기록</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1" aria-label="메모 라운드 선택">
          <button
            type="button"
            onClick={reset}
            disabled={estimate === hi}
            className="mr-1 px-1 py-1 disabled:opacity-30"
          >
            초기화
          </button>
          <button
            type="button"
            aria-label="이전 라운드 메모"
            disabled={round <= 1}
            onClick={() => selectRound(round - 1)}
            className="border-cdm-border h-7 w-7 rounded border text-base disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-8 text-center font-semibold">R{round}</span>
          <button
            type="button"
            aria-label="다음 라운드 메모"
            disabled={round >= currentRound}
            onClick={() => selectRound(round + 1)}
            className="border-cdm-border h-7 w-7 rounded border text-base disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="상대 잔여 추정 줄이기"
          disabled={estimate <= lo}
          onClick={() => change(estimate - 1)}
          className="border-cdm-border text-cdm-fg bg-cdm-bg hover:bg-cdm-bg-elev-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg font-bold disabled:opacity-30"
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <input
            key={`${round}-${estimate}`}
            aria-label="상대 잔여 추정"
            type="number"
            inputMode="numeric"
            min={lo}
            max={hi}
            step={1}
            defaultValue={estimate}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              const raw = e.currentTarget.value;
              if (raw !== '' && Number.isFinite(Number(raw))) {
                const value = Math.max(lo, Math.min(hi, Math.floor(Number(raw))));
                e.currentTarget.value = String(value);
                change(value);
              } else e.currentTarget.value = String(estimate);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="border-cdm-border w-20 [appearance:textfield] rounded border bg-transparent py-1 text-center text-xl font-bold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs">p</span>
        </div>
        <button
          type="button"
          aria-label="상대 잔여 추정 늘리기"
          disabled={estimate >= hi}
          onClick={() => change(estimate + 1)}
          className="border-cdm-border text-cdm-fg bg-cdm-bg hover:bg-cdm-bg-elev-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg font-bold disabled:opacity-30"
        >
          +
        </button>
      </div>
    </section>
  );
}
