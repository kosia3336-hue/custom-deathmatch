'use client';

import { useCallback } from 'react';
import type {
  SMS2ChipBet,
  SMS2MarkId,
  SMS2Side,
} from '@/shared/types/sun-moon-star-2';
import {
  MARK_IDS,
  firstMaxBet,
  secondMinBet,
  sumBet,
} from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';

/* ════════════════════════════════════════════════════════════
 * BetInput — 통합 칩 베팅 입력 (선/후 분기)
 *   · 선: 최대 = min(본인, floor(상대/2))
 *   · 후: 최소 = firstTotal==0 ? 0 : 2*firstTotal, 최대 = 본인 칩
 *   · 제약 위반 시 버튼 비활성 + 안내
 * ════════════════════════════════════════════════════════════ */

interface Props {
  turn: 'first' | 'second';
  myChips: number;
  opponentChips: number;
  value: SMS2ChipBet;
  /** 후 베팅: 선이 낸 베팅 (공개) */
  firstBet: SMS2ChipBet | null;
  firstSide: SMS2Side | null;
  submitting: boolean;
  disabled: boolean;
  onChange: (v: SMS2ChipBet) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export default function BetInput({
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
  const maxTotal =
    turn === 'first' ? Math.min(myChips, firstMaxBet(opponentChips)) : myChips;

  const overMax = total > maxTotal;
  const underMin = total < minTotal;
  const overChips = total > myChips;
  const invalid = overMax || underMin || overChips;
  const canSubmit = !submitting && !disabled && !invalid;

  const setSlot = useCallback(
    (slot: SMS2MarkId, next: number) => {
      const others = MARK_IDS.reduce(
        (acc, m) => (m === slot ? acc : acc + value[m]),
        0,
      );
      const maxForSlot = Math.max(0, maxTotal - others);
      const clamped = Math.max(0, Math.min(maxForSlot, Math.floor(next)));
      onChange({ ...value, [slot]: clamped });
    },
    [value, maxTotal, onChange],
  );

  const submitLabel =
    total === 0 && minTotal === 0
      ? '0칩 베팅 확정 (패스)'
      : `${total}칩 베팅 확정`;

  return (
    <div
      className={`space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-700">
          🪙 {turn === 'first' ? '선 베팅 👑' : '후 베팅'}
        </p>
        <p className="text-xs text-gray-500">
          보유 <span className="font-bold text-gray-800 tabular-nums">{myChips}칩</span>
        </p>
      </div>

      {/* 제약 안내 */}
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <span
          className={`rounded px-1.5 py-0.5 font-semibold ${
            underMin ? 'bg-rose-100 text-rose-700' : 'bg-white text-gray-600'
          }`}
        >
          최소 {minTotal}칩
        </span>
        <span
          className={`rounded px-1.5 py-0.5 font-semibold ${
            overMax || overChips
              ? 'bg-rose-100 text-rose-700'
              : 'bg-white text-gray-600'
          }`}
        >
          최대 {maxTotal}칩
        </span>
        {turn === 'first' && opponentChips < 2 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">
            상대 칩 적음
          </span>
        )}
      </div>

      {/* 3슬롯 */}
      <div className="space-y-1.5">
        {MARK_IDS.map((m) => (
          <BetSlot
            key={m}
            mark={m}
            value={value[m]}
            othersSum={total - value[m]}
            maxTotal={maxTotal}
            disabled={disabled}
            onChange={(v) => setSlot(m, v)}
          />
        ))}
      </div>

      {/* 총합 */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">
          총 <span className="font-bold tabular-nums text-gray-800">{total}</span>칩
        </span>
        {underMin && (
          <span className="font-bold text-rose-600">최소 {minTotal - total}칩 부족</span>
        )}
        {overMax && (
          <span className="font-bold text-rose-600">
            한도 {total - maxTotal}칩 초과
          </span>
        )}
      </div>

      {/* 액션 */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || total === 0}
          onClick={onReset}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          초기화
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 whitespace-nowrap"
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
  othersSum,
  maxTotal,
  disabled,
  onChange,
}: {
  mark: SMS2MarkId;
  value: number;
  othersSum: number;
  maxTotal: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const style = MARK_STYLES[mark];
  const maxForSlot = Math.max(0, maxTotal - othersSum);
  const clamp = (v: number) => Math.max(0, Math.min(maxForSlot, Math.floor(v)));

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1">
      <span className="flex w-12 shrink-0 items-center gap-1">
        <span className="text-base">{style.icon}</span>
        <span className={`text-xs font-bold ${style.textSoft}`}>{style.label}</span>
      </span>
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - 1))}
        className="h-9 w-9 shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        aria-label={`${style.label}에 칩 베팅`}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(isNaN(n) ? 0 : n));
        }}
        className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white text-center text-base font-bold tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-100"
      />
      <button
        type="button"
        disabled={disabled || value >= maxForSlot}
        onClick={() => onChange(clamp(value + 1))}
        className="h-9 w-9 shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
