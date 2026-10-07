'use client';

import type { SMS2MarkId, SMS2PowderSubmission } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, sumPowder, zeroPowder } from '@/shared/types/sun-moon-star-2';
import { useCallback, useMemo } from 'react';
import { MARK_STYLES } from './constants';

/* ════════════════════════════════════════════════════════════
 * PowderInput — 통합 빛가루 분배 입력
 *   · 단일 카드에 3슬롯 (해·달·별)
 *   · 각 슬롯 [−5][−1] [수] [+1][+5]
 *   · 총합/잔여 프로그레스
 *   · 제출 버튼: 하단 단일
 * ════════════════════════════════════════════════════════════ */

interface Props {
  powderRemain: number;
  value: SMS2PowderSubmission;
  /** 이미 제출된 경우: 카드 disable + "제출 완료" 표시 */
  submitted: boolean;
  /** 상대도 제출 완료되면 cancelPowder 불가 */
  opponentSubmitted: boolean;
  submitting: boolean;
  onChange: (v: SMS2PowderSubmission) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export default function PowderInput({
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

  const setSlot = useCallback(
    (slot: SMS2MarkId, next: number) => {
      const others = MARK_IDS.reduce((acc, m) => (m === slot ? acc : acc + value[m]), 0);
      const max = Math.max(0, powderRemain - others);
      const clamped = Math.max(0, Math.min(max, Math.floor(next)));
      onChange({ ...value, [slot]: clamped });
    },
    [value, powderRemain, onChange],
  );

  const progressPct = useMemo(() => {
    if (powderRemain <= 0) return 0;
    return Math.min(100, Math.round((total / powderRemain) * 100));
  }, [total, powderRemain]);

  const progressColor =
    progressPct > 100
      ? 'bg-rose-400'
      : progressPct >= 90
        ? 'bg-amber-500'
        : progressPct >= 50
          ? 'bg-amber-400'
          : 'bg-amber-300';

  return (
    <div
      className={`space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-2 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-indigo-700">빛가루 분배</p>
        <p className="text-xs text-gray-500">
          잔여 <span className="font-bold text-gray-800 tabular-nums">{powderRemain}g</span>
        </p>
      </div>

      {/* 3슬롯 */}
      <div className="space-y-1">
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

      {/* 총합/프로그레스 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">
            총 <span className="font-bold text-gray-800 tabular-nums">{total}</span>g /{' '}
            <span className="tabular-nums">{powderRemain}</span>g
          </span>
          <span className={`font-bold tabular-nums ${over ? 'text-rose-600' : 'text-amber-600'}`}>
            {progressPct}%
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={powderRemain}
          aria-valuenow={total}
        >
          <div
            className={`h-full transition-all duration-200 ${progressColor}`}
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
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
        {submitted ? (
          <button
            type="button"
            disabled={opponentSubmitted || submitting}
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-500 py-2 text-sm font-bold text-white hover:bg-gray-600 disabled:opacity-40"
          >
            {opponentSubmitted ? '제출 완료 (취소 불가)' : '취소'}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting || over}
            onClick={onSubmit}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
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
  const style = MARK_STYLES[mark];
  const max = Math.max(0, powderRemain - othersSum);

  const clamp = (v: number) => Math.max(0, Math.min(max, Math.floor(v)));

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
      <span className="flex w-12 shrink-0 items-center gap-1">
        <span className="text-base">{style.icon}</span>
        <span className={`text-xs font-bold ${style.textSoft}`}>{style.label}</span>
      </span>

      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - 5))}
        className="h-9 w-8 shrink-0 rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
      >
        −5
      </button>
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
        aria-label={`${style.label}에 빛가루 분배`}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(isNaN(n) ? 0 : n));
        }}
        className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white text-center text-base font-bold text-gray-800 tabular-nums focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:bg-gray-100"
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="h-9 w-9 shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        +
      </button>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 5))}
        className="h-9 w-8 shrink-0 rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
      >
        +5
      </button>
    </div>
  );
}

export { zeroPowder };
