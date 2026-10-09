'use client';

import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, SMS2_INITIAL_POWDER } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';
import type { OpponentPowderEstimate } from './types';

interface Props {
  round: number;
  latestRound: number;
  estimate: OpponentPowderEstimate;
  max: number;
  /** 1라운드부터 최신 라운드까지 추정 합 */
  totalAll: number;
  onSelectRound: (round: number) => void;
  onChange: (mark: SMS2MarkId, value: number) => void;
  onReset: () => void;
}

export default function OpponentPowderTracker({
  round,
  latestRound,
  estimate,
  max,
  totalAll,
  onSelectRound,
  onChange,
  onReset,
}: Props) {
  const total = estimate.perMark.sun + estimate.perMark.moon + estimate.perMark.star;
  const roundButton =
    'border-cdm-border text-cdm-fg hover:bg-cdm-bg-elev-1 h-8 w-8 shrink-0 rounded border text-sm disabled:opacity-30';
  return (
    <div data-powder-note-round={round} className="@container flex flex-col gap-2">
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
      {/* 빛가루 분배 창의 '총 0g / 70g' 막대와 같은 모양 */}
      <div className="space-y-2 px-1">
        <SumBar label={`R${round} 합`} value={total} max={max} />
        <SumBar
          label={latestRound > 1 ? `전체 합 (R1~R${latestRound})` : '전체 합'}
          value={totalAll}
          max={SMS2_INITIAL_POWDER}
        />
      </div>
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
  /*
    빛가루 분배 창(PowderSlot)과 같은 한 줄: [−5][−] [수] [+][+5] — 손에 익은 모양 그대로.
    PC 메모 창처럼 폭이 좁으면(19rem 미만) 표식 글자를 숨기고 버튼을 좁혀 숫자 칸 자리를 남긴다.
  */
  const step =
    'border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 h-9 shrink-0 rounded-md border font-bold disabled:opacity-40';
  const small = `${step} w-8 text-[11px] @max-[19rem]:w-7`;
  const big = `${step} w-9 text-lg @max-[19rem]:w-8`;
  return (
    <div className="bg-cdm-bg flex items-center gap-1.5 rounded-lg px-2 py-1.5 @max-[19rem]:gap-1 @max-[19rem]:px-1.5">
      <span className="flex w-12 shrink-0 items-center gap-1 @max-[19rem]:w-auto">
        <span className="text-base">{style.icon}</span>
        <span className={`text-xs font-bold ${style.textSoft} @max-[19rem]:hidden`}>
          {style.label}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 5))}
        disabled={value <= 0}
        aria-label={`${style.label} 추정 5 줄이기`}
        className={small}
      >
        −5
      </button>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 0}
        aria-label={`${style.label} 추정 줄이기`}
        className={big}
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
        className="border-cdm-border bg-cdm-bg text-cdm-fg focus:ring-cdm-primary h-9 min-w-0 flex-1 rounded-md border text-center text-base font-bold tabular-nums focus:ring-2 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`${style.label} 추정 늘리기`}
        className={big}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 5))}
        disabled={value >= max}
        aria-label={`${style.label} 추정 5 늘리기`}
        className={small}
      >
        +5
      </button>
    </div>
  );
}

/** '총 Ng / 최대g' + 채움 막대 — PowderInput 의 총합 막대와 같은 모양·색 */
function SumBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const over = value > max;
  const color = over
    ? 'bg-rose-400'
    : pct >= 90
      ? 'bg-amber-500'
      : pct >= 50
        ? 'bg-amber-400'
        : 'bg-amber-300';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-cdm-fg-muted">
          {label} <span className="text-cdm-fg font-bold tabular-nums">{value}</span>g /{' '}
          <span className="tabular-nums">{max}</span>g
        </span>
        <span className={`font-bold tabular-nums ${over ? 'text-rose-600' : 'text-amber-600'}`}>
          {pct}%
        </span>
      </div>
      <div
        className="bg-cdm-bg-elev-2 h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className={`h-full transition-all duration-200 ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
