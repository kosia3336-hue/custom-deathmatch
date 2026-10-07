'use client';

import type { SMS2ChipBet, SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, firstMaxBet, secondMinBet, sumBet } from '@/shared/types/sun-moon-star-2';
import { useCallback } from 'react';
import { CelestialGlyph } from './CelestialGlyph';

interface Props {
  turn: 'first' | 'second';
  myChips: number;
  opponentChips: number;
  value: SMS2ChipBet;
  firstBet: SMS2ChipBet | null;
  submitting: boolean;
  disabled: boolean;
  onChange: (v: SMS2ChipBet) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const LABELS: Record<SMS2MarkId, string> = { sun: '해', moon: '달', star: '별' };

export default function DalmajiBetPanel({
  turn,
  myChips,
  opponentChips,
  value,
  firstBet,
  submitting,
  disabled,
  onChange,
  onSubmit,
  onReset,
}: Props) {
  const total = sumBet(value);
  const firstTotal = firstBet ? sumBet(firstBet) : 0;
  const minTotal = turn === 'first' ? 0 : secondMinBet(firstTotal);
  const maxTotal = turn === 'first' ? Math.min(myChips, firstMaxBet(opponentChips)) : myChips;
  const invalid = total > maxTotal || total < minTotal || total > myChips;
  const canSubmit = !submitting && !disabled && !invalid;

  const setSlot = useCallback(
    (slot: SMS2MarkId, next: number) => {
      const others = MARK_IDS.reduce((acc, m) => (m === slot ? acc : acc + value[m]), 0);
      const maxForSlot = Math.max(0, maxTotal - others);
      onChange({ ...value, [slot]: Math.max(0, Math.min(maxForSlot, Math.floor(next))) });
    },
    [value, maxTotal, onChange],
  );

  const submitLabel =
    total === 0 && minTotal === 0 ? '0칩 베팅 확정 (패스)' : `${total}칩 베팅 확정`;

  return (
    <div className="skin-dalmaji-panel">
      <div className="flex items-center justify-between">
        <p className="skin-dalmaji-panel-title">{turn === 'first' ? '선 베팅' : '후 베팅'}</p>
        <p className="skin-dalmaji-panel-meta">
          내 칩 <span className="tabular-nums">{myChips}</span>
        </p>
      </div>

      <div className="space-y-2">
        {MARK_IDS.map((mark) => (
          <BetSlot
            key={mark}
            mark={mark}
            value={value[mark]}
            max={Math.max(0, maxTotal - (total - value[mark]))}
            disabled={disabled || submitting}
            onChange={(v) => setSlot(mark, v)}
          />
        ))}
      </div>

      <p className="skin-dalmaji-panel-meta">
        {turn === 'first' ? `최대 ${maxTotal}칩` : `최소 ${minTotal}칩 · 최대 ${maxTotal}칩`}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || submitting || total === 0}
          onClick={onReset}
          className="skin-dalmaji-btn skin-dalmaji-btn--ghost"
        >
          초기화
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="skin-dalmaji-btn skin-dalmaji-btn--gold flex-1"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function BetSlot({
  mark,
  value,
  max,
  disabled,
  onChange,
}: {
  mark: SMS2MarkId;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.floor(v)));
  return (
    <div className="skin-dalmaji-slot">
      <span className="flex w-14 shrink-0 items-center gap-1">
        <span className="h-7 w-7">
          <CelestialGlyph mark={mark} />
        </span>
        <span className="skin-dalmaji-slot-label">{LABELS[mark]}</span>
      </span>
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - 1))}
        className="skin-dalmaji-step skin-dalmaji-step--lg"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        aria-label={`${LABELS[mark]}에 칩 베팅`}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(Number.isNaN(n) ? 0 : n));
        }}
        className="skin-dalmaji-step-input"
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="skin-dalmaji-step skin-dalmaji-step--lg"
      >
        +
      </button>
    </div>
  );
}
