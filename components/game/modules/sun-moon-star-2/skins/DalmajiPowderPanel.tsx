'use client';

import { useCallback, useMemo } from 'react';
import { MARK_IDS, sumPowder } from '@/shared/types/sun-moon-star-2';
import type { SMS2MarkId, SMS2PowderSubmission } from '@/shared/types/sun-moon-star-2';
import { CelestialGlyph } from './CelestialGlyph';

interface Props {
  powderRemain: number;
  value: SMS2PowderSubmission;
  submitted: boolean;
  opponentSubmitted: boolean;
  submitting: boolean;
  onChange: (v: SMS2PowderSubmission) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const LABELS: Record<SMS2MarkId, string> = { sun: '해', moon: '달', star: '별' };

export default function DalmajiPowderPanel({
  powderRemain,
  value,
  submitted,
  opponentSubmitted,
  submitting,
  onChange,
  onSubmit,
  onCancel,
  onReset,
}: Props) {
  const total = sumPowder(value);
  const over = total > powderRemain;
  const disabled = submitted || submitting;
  const progressPct = useMemo(() => {
    if (powderRemain <= 0) return 0;
    return Math.min(100, Math.round((total / powderRemain) * 100));
  }, [total, powderRemain]);

  const setSlot = useCallback(
    (slot: SMS2MarkId, next: number) => {
      const others = MARK_IDS.reduce((acc, m) => (m === slot ? acc : acc + value[m]), 0);
      const max = Math.max(0, powderRemain - others);
      onChange({ ...value, [slot]: Math.max(0, Math.min(max, Math.floor(next))) });
    },
    [value, powderRemain, onChange],
  );

  return (
    <div className={`skin-dalmaji-panel ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="skin-dalmaji-panel-title">빛가루 분배</p>
        <p className="skin-dalmaji-panel-meta">
          잔여 <span className="tabular-nums">{powderRemain}g</span>
        </p>
      </div>

      <div className="space-y-2">
        {MARK_IDS.map((mark) => (
          <PowderSlot
            key={mark}
            mark={mark}
            value={value[mark]}
            powderRemain={powderRemain}
            othersSum={total - value[mark]}
            disabled={disabled}
            onChange={(v) => setSlot(mark, v)}
          />
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="skin-dalmaji-panel-meta">
            총 <b className="tabular-nums">{total}</b>g / {powderRemain}g
          </span>
          <span className={`font-bold tabular-nums ${over ? 'text-rose-300' : 'text-[#f0d078]'}`}>
            {progressPct}%
          </span>
        </div>
        <div
          className="skin-dalmaji-dust-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={powderRemain}
          aria-valuenow={total}
        >
          <div className="skin-dalmaji-dust-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || total === 0}
          onClick={onReset}
          className="skin-dalmaji-btn skin-dalmaji-btn--ghost"
        >
          초기화
        </button>
        {submitted ? (
          <button
            type="button"
            disabled={opponentSubmitted || submitting}
            onClick={onCancel}
            className="skin-dalmaji-btn skin-dalmaji-btn--ghost flex-1"
          >
            {opponentSubmitted ? '제출 완료 (취소 불가)' : '취소'}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting || over}
            onClick={onSubmit}
            className="skin-dalmaji-btn skin-dalmaji-btn--gold flex-1"
          >
            {total}g 제출
          </button>
        )}
      </div>
    </div>
  );
}

function PowderSlot({
  mark,
  value,
  powderRemain,
  othersSum,
  disabled,
  onChange,
}: {
  mark: SMS2MarkId;
  value: number;
  powderRemain: number;
  othersSum: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const max = Math.max(0, powderRemain - othersSum);
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.floor(v)));

  return (
    <div className="skin-dalmaji-slot">
      <span className="flex w-14 shrink-0 items-center gap-1">
        <span className="h-7 w-7">
          <CelestialGlyph mark={mark} />
        </span>
        <span className="skin-dalmaji-slot-label">{LABELS[mark]}</span>
      </span>
      <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(clamp(value - 5))} className="skin-dalmaji-step">
        −5
      </button>
      <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(clamp(value - 1))} className="skin-dalmaji-step skin-dalmaji-step--lg">
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        aria-label={`${LABELS[mark]}에 빛가루 분배`}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(Number.isNaN(n) ? 0 : n));
        }}
        className="skin-dalmaji-step-input"
      />
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))} className="skin-dalmaji-step skin-dalmaji-step--lg">
        +
      </button>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 5))} className="skin-dalmaji-step">
        +5
      </button>
    </div>
  );
}
