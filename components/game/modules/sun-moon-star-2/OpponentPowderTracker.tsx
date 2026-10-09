'use client';

import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';
import type { OpponentPowderEstimate } from './types';

interface Props {
  round: number;
  latestRound: number;
  estimate: OpponentPowderEstimate;
  max: number;
  onSelectRound: (round: number) => void;
  onChange: (mark: SMS2MarkId, value: number) => void;
  onReset: () => void;
}

export default function OpponentPowderTracker({
  round,
  latestRound,
  estimate,
  max,
  onSelectRound,
  onChange,
  onReset,
}: Props) {
  const total = estimate.perMark.sun + estimate.perMark.moon + estimate.perMark.star;
  const roundButton =
    'border-cdm-border text-cdm-fg hover:bg-cdm-bg-elev-1 h-8 w-8 shrink-0 rounded border text-sm disabled:opacity-30';
  return (
    <div data-powder-note-round={round} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onReset}
          className="text-cdm-fg-muted hover:text-cdm-fg min-h-8 px-1 text-xs"
        >
          초기화
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="추리 이전 라운드"
            disabled={round <= 1}
            onClick={() => onSelectRound(round - 1)}
            className={roundButton}
          >
            ‹
          </button>
          <span className="text-cdm-fg min-w-6 text-center text-xs font-semibold tabular-nums">
            R{round}
          </span>
          <button
            type="button"
            aria-label="추리 다음 라운드"
            disabled={round >= latestRound}
            onClick={() => onSelectRound(round + 1)}
            className={roundButton}
          >
            ›
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {MARK_IDS.map((mark) => (
          <EstimateSlot
            key={mark}
            mark={mark}
            value={estimate.perMark[mark]}
            max={max}
            onChange={(value) => onChange(mark, value)}
          />
        ))}
      </div>
      <p className="text-cdm-fg-muted px-2 text-right text-xs">
        합 <span className="text-cdm-fg font-bold tabular-nums">{total}g</span>
      </p>
    </div>
  );
}

function EstimateSlot({
  mark,
  value,
  max,
  onChange,
}: {
  mark: SMS2MarkId;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const style = MARK_STYLES[mark];
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.floor(v)));
  return (
    <div className="bg-cdm-bg flex items-center gap-1.5 rounded px-2 py-1">
      <span className="flex w-10 shrink-0 items-center gap-1">
        <span className="text-sm">{style.icon}</span>
        <span className={`text-[11px] font-bold ${style.textSoft}`}>{style.label}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 0}
        aria-label={`${style.label} 추정 줄이기`}
        className="border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-8 w-8 shrink-0 rounded border text-sm font-bold disabled:opacity-40"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(isNaN(n) ? 0 : n));
        }}
        aria-label={`${style.label} 상대 추정`}
        className="border-cdm-border bg-cdm-bg text-cdm-fg focus:ring-cdm-primary h-8 min-w-0 flex-1 rounded border text-center text-sm font-bold tabular-nums focus:ring-2 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`${style.label} 추정 늘리기`}
        className="border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-8 w-8 shrink-0 rounded border text-sm font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
