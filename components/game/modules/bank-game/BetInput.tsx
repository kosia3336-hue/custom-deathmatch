'use client';

import type { BankBet, BankDenomination } from '@/shared/types/bank-game';
import { sumBetAmount, sumBetCount } from '@/shared/types/bank-game';
import { useCallback } from 'react';
import { DENOM_ORDER, DENOM_STYLES, formatKRW } from './constants';

/* ════════════════════════════════════════════════════════════
 * BetInput — 4 액면 스테퍼 베팅 입력
 *   · turn='first' → 인디고 톤 (선)
 *   · turn='second' → 앰버 톤 (후)
 *   · 각 액면 행: [라벨] [-] [숫자] [+] [잔여 → 베팅 후]
 *   · 합계 행 + 초기화/확정 버튼
 *   · size='sm' (모바일) / 'md' (데스크탑)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  turn: 'first' | 'second';
  inventory: BankBet;
  inventoryAmount: number;
  inventoryCount: number;
  value: BankBet;
  submitting: boolean;
  disabled: boolean;
  onChange: (v: BankBet) => void;
  onSubmit: () => void;
  onReset: () => void;
  size?: 'sm' | 'md';
}

export default function BetInput({
  turn,
  inventory,
  inventoryAmount,
  inventoryCount,
  value,
  submitting,
  disabled,
  onChange,
  onSubmit,
  onReset,
  size = 'sm',
}: Props) {
  const totalCount = sumBetCount(value);
  const totalAmount = sumBetAmount(value);

  // 잔여 부족 검증 — 행별 + 전체
  const overflow = DENOM_ORDER.find((d) => (value[d] ?? 0) > (inventory[d] ?? 0)) ?? null;
  const invalid = overflow !== null;
  const canSubmit = !submitting && !disabled && !invalid;

  const setDenom = useCallback(
    (denom: BankDenomination, next: number) => {
      const max = inventory[denom] ?? 0;
      const clamped = Math.max(0, Math.min(max, Math.floor(next)));
      onChange({ ...value, [denom]: clamped });
    },
    [value, inventory, onChange],
  );

  const accentBorder = turn === 'first' ? 'border-indigo-200' : 'border-amber-200';
  const accentBg = turn === 'first' ? 'bg-indigo-50' : 'bg-amber-50';
  const accentText = turn === 'first' ? 'text-indigo-700' : 'text-amber-700';
  const accentBtn =
    turn === 'first' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700';
  const accentRing = turn === 'first' ? 'focus:ring-indigo-400' : 'focus:ring-amber-400';

  const submitLabel =
    totalCount === 0
      ? '0장 베팅 확정 (패스)'
      : `${totalCount}장 / ${formatKRW(totalAmount)}원 확정`;

  /*
    판 폭은 게임판에 맞춘다(w-full, 넓은 화면은 max-w-md). 예전에는 내용 폭에 맞춰
    잡혔는데, 숫자 입력칸이 폭을 정하지 않으면 기본 폭(20자 분량)을 고집해 판이
    374px 밑으로 줄지 않았다 — 375px 폰에서 게임판(336px) 양옆으로 삐져나갔다.
  */
  return (
    <div
      className={`bank-bet-panel bank-bet-panel--${turn} w-full max-w-md min-w-0 space-y-3 rounded-xl border-2 ${accentBorder} ${accentBg} p-3 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`bank-bet-title text-sm font-semibold ${accentText}`}>
          {turn === 'first' ? '선 베팅' : '후 베팅'}
        </p>
        <p className="text-[11px] text-gray-500">
          잔고{' '}
          <span className="text-sm font-bold text-gray-800 tabular-nums">
            {inventoryCount}장 / {formatKRW(inventoryAmount)}원
          </span>
        </p>
      </div>

      {/* 4행 액면 */}
      <div className="space-y-1.5">
        {DENOM_ORDER.map((denom) => (
          <BetRow
            key={denom}
            denom={denom}
            value={value[denom] ?? 0}
            invMax={inventory[denom] ?? 0}
            disabled={disabled}
            size={size}
            accentRing={accentRing}
            onChange={(v) => setDenom(denom, v)}
          />
        ))}
      </div>

      {/* 합계 + 검증 */}
      <div className="bank-bet-total flex items-center justify-between text-xs">
        <span className="text-gray-600">
          합계{' '}
          <span className={`font-bold tabular-nums ${accentText}`}>
            {totalCount}장 / {formatKRW(totalAmount)}원
          </span>
        </span>
        {invalid && overflow !== null && (
          <span className="font-bold text-rose-600 tabular-nums">
            잔여 부족: {DENOM_STYLES[overflow].shortLabel}
          </span>
        )}
      </div>

      {/* 액션 */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || totalCount === 0}
          onClick={onReset}
          className="bank-reset-action rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          초기화
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className={`bank-primary-action flex-1 rounded-lg py-2 text-sm font-bold whitespace-nowrap text-white disabled:opacity-40 ${accentBtn}`}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function BetRow({
  denom,
  value,
  invMax,
  disabled,
  size,
  accentRing,
  onChange,
}: {
  denom: BankDenomination;
  value: number;
  invMax: number;
  disabled: boolean;
  size: 'sm' | 'md';
  accentRing: string;
  onChange: (v: number) => void;
}) {
  const style = DENOM_STYLES[denom];
  const remain = invMax - value;
  const stepSize = size === 'md' ? 'h-10 w-10' : 'h-9 w-9';
  const inputSize = size === 'md' ? 'h-10' : 'h-9';
  const labelW = size === 'md' ? 'w-20' : 'w-16';

  const clamp = (v: number) => Math.max(0, Math.min(invMax, Math.floor(v)));

  return (
    <div
      className={`bank-bet-row bank-bet-row--${denom} flex items-center gap-1.5 rounded-lg bg-white px-2 py-1`}
    >
      <span
        className={`bank-bet-denom ${labelW} shrink-0 truncate text-xs font-bold ${style.text}`}
      >
        {style.label}
      </span>
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - 1))}
        className={`bank-step-action ${stepSize} shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40`}
        aria-label={`${style.label} 1장 빼기`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        aria-label={`${style.label} 베팅 장수`}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(isNaN(n) ? 0 : n));
        }}
        className={`bank-quantity-input ${inputSize} w-0 min-w-0 flex-1 rounded-md border border-gray-300 bg-white text-center text-base font-bold text-gray-800 tabular-nums focus:ring-2 focus:outline-none ${accentRing} disabled:bg-gray-100`}
      />
      <button
        type="button"
        disabled={disabled || value >= invMax}
        onClick={() => onChange(clamp(value + 1))}
        className={`bank-step-action ${stepSize} shrink-0 rounded-md border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40`}
        aria-label={`${style.label} 1장 더`}
      >
        +
      </button>
      <span
        className={`min-w-0 flex-1 text-right text-xs tabular-nums ${
          remain <= 0 ? 'font-bold text-rose-600' : 'text-gray-500'
        }`}
      >
        잔여 {remain}
      </span>
    </div>
  );
}
