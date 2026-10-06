'use client';

import CoinStepper from './CoinStepper';
import { useCoinAllocation } from './useCoinAllocation';
import type { IDCoinStock, IDCoinAllocation } from '@/shared/types/invest-donate';
import { coinValue } from '@/shared/types/invest-donate';
import { COIN_DENOMINATIONS } from './constants';

/** 스테퍼(− 0 +) 실제 폭과 동일하게 맞춰 헤더·합계를 가운데 정렬 */
const STEPPER_COL_CLASS = 'w-[90px] shrink-0';

interface Props {
  coinStock: IDCoinStock;
  submitted: boolean;
  submittedCoins?: { invest: IDCoinAllocation; donate: IDCoinAllocation } | null;
  canCancel?: boolean;
  onSubmit: (invest: IDCoinAllocation, donate: IDCoinAllocation) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function CoinSelector({
  coinStock,
  submitted,
  submittedCoins,
  canCancel,
  onSubmit,
  onCancel,
  disabled = false,
}: Props) {
  const { invest, donate, update, error } = useCoinAllocation(coinStock);
  const investTotal = coinValue(invest);
  const donateTotal = coinValue(donate);

  if (submitted) {
    const shownInvest = submittedCoins ? coinValue(submittedCoins.invest) : null;
    const shownDonate = submittedCoins ? coinValue(submittedCoins.donate) : null;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm font-semibold text-emerald-700">제출 완료</p>
        {shownInvest !== null && shownDonate !== null && (
          <p className="text-xs text-emerald-600">
            투자 {shownInvest}원 / 기부 {shownDonate}원
          </p>
        )}
        {canCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50"
          >
            제출 취소
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      {/* Header — 투자·기부 열 너비 = 스테퍼 열, 라벨은 스테퍼 중앙(숫자 0 위)에 정렬 */}
      <div className="mb-2 grid grid-cols-[1fr_90px_90px] gap-x-1 gap-y-0 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
        <span className="self-end pb-0.5">보유</span>
        <div className={`${STEPPER_COL_CLASS} flex justify-center`}>
          <span className="text-blue-500">투자</span>
        </div>
        <div className={`${STEPPER_COL_CLASS} flex justify-center`}>
          <span className="text-emerald-500">기부</span>
        </div>
      </div>

      {/* Denomination rows */}
      {COIN_DENOMINATIONS.map(({ key, label, color }) => {
        const owned = coinStock[key];
        const maxInvest = owned - donate[key];
        const maxDonate = owned - invest[key];

        return (
          <div key={key} className="mb-1.5 grid grid-cols-[1fr_90px_90px] items-center gap-x-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${color}`}
              >
                {label}
              </span>
              <span className="text-xs text-gray-600 tabular-nums">{owned}개</span>
            </div>
            <div className={`${STEPPER_COL_CLASS} flex justify-center`}>
              <CoinStepper
                value={invest[key]}
                max={maxInvest}
                onChange={(v) => update('invest', key, v)}
                disabled={disabled}
                theme="invest"
              />
            </div>
            <div className={`${STEPPER_COL_CLASS} flex justify-center`}>
              <CoinStepper
                value={donate[key]}
                max={maxDonate}
                onChange={(v) => update('donate', key, v)}
                disabled={disabled}
                theme="donate"
              />
            </div>
          </div>
        );
      })}

      {/* Totals */}
      <div className="mt-2 grid grid-cols-[1fr_90px_90px] gap-x-1 border-t border-gray-100 pt-2 text-sm font-bold">
        <span className="text-gray-500">합계</span>
        <div className={`${STEPPER_COL_CLASS} flex justify-center text-blue-600 tabular-nums`}>
          {investTotal}원
        </div>
        <div className={`${STEPPER_COL_CLASS} flex justify-center text-emerald-600 tabular-nums`}>
          {donateTotal}원
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => !disabled && !error && onSubmit(invest, donate)}
        disabled={disabled || !!error}
        className="mt-3 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
      >
        제출하기
      </button>
    </div>
  );
}
