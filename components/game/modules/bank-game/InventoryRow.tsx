'use client';

import type { BankBet, BankDenomination } from '@/shared/types/bank-game';
import { sumBetAmount, sumBetCount } from '@/shared/types/bank-game';
import { DENOM_ORDER, DENOM_STYLES, formatKRW } from './constants';

/* ════════════════════════════════════════════════════════════
 * InventoryRow — 본인 인벤토리 4 액면 가로 카드
 *   · 4 액면 색 토큰: 1k=emerald · 3k=amber · 5k=rose · 10k=violet
 *   · pendingBet 입력 중이면 차감 표시
 *   · size='sm' (모바일, 80px) / 'md' (데스크탑, 100px)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  inventory: BankBet;
  inventoryAmount: number | null;
  pendingBet?: BankBet | null;
  size?: 'sm' | 'md';
}

export default function InventoryRow({
  inventory,
  inventoryAmount,
  pendingBet,
  size = 'sm',
}: Props) {
  const totalCount = DENOM_ORDER.reduce((sum, d) => sum + (inventory[d] ?? 0), 0);
  const pendingCount = pendingBet ? sumBetCount(pendingBet) : 0;
  const pendingAmount = pendingBet ? sumBetAmount(pendingBet) : 0;
  const remainCount = totalCount - pendingCount;
  const remainAmount = (inventoryAmount ?? 0) - pendingAmount;

  return (
    <div className="bank-inventory space-y-1.5">
      <div className="bank-inventory-grid grid grid-cols-4 gap-2">
        {DENOM_ORDER.map((denom) => (
          <DenomCard
            key={denom}
            denom={denom}
            count={inventory[denom] ?? 0}
            pending={pendingBet?.[denom] ?? 0}
            size={size}
          />
        ))}
      </div>
      {size === 'md' && (
        <p className="text-center text-xs text-gray-500 tabular-nums">
          합계: <b className="text-gray-700">{remainCount}장</b>
          {inventoryAmount != null && (
            <>
              {' '}
              / <b className="text-gray-700">{formatKRW(remainAmount)}원</b>
            </>
          )}
          {pendingBet && pendingCount > 0 && (
            <span className="ml-2 text-rose-600">(베팅 차감 후)</span>
          )}
        </p>
      )}
    </div>
  );
}

function DenomCard({
  denom,
  count,
  pending,
  size,
}: {
  denom: BankDenomination;
  count: number;
  pending: number;
  size: 'sm' | 'md';
}) {
  const style = DENOM_STYLES[denom];
  const remain = count - pending;
  const empty = remain <= 0;
  const sizeCls = size === 'md' ? 'min-h-[100px] px-2 py-2.5' : 'min-h-[80px] px-1.5 py-2';
  const numCls = size === 'md' ? 'text-3xl' : 'text-2xl';
  const labelCls = size === 'md' ? 'text-xs' : 'text-[10px]';

  return (
    <div
      aria-label={`${style.label} ${count}장, 베팅 ${pending}장`}
      className={`bank-denom-card bank-denom-card--${denom} relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition-all duration-300 ${sizeCls} ${
        empty ? 'border-gray-200 bg-gray-50' : `${style.border} ${style.bg}`
      }`}
    >
      <span
        className={`bank-denom-label ${labelCls} font-semibold ${empty ? 'text-gray-400' : style.text}`}
      >
        {style.shortLabel}
      </span>
      <span
        className={`bank-denom-count ${numCls} leading-none font-extrabold tabular-nums ${
          empty ? 'text-gray-400' : style.textStrong
        }`}
      >
        {remain}
      </span>
      {pending > 0 && (
        <span className="bank-denom-pending rounded bg-rose-100 px-1 py-0 text-[10px] font-bold text-rose-700 tabular-nums">
          −{pending}
        </span>
      )}
      {pending === 0 && size === 'md' && (
        <span className="text-[9px] text-gray-400">/ {count}장</span>
      )}
    </div>
  );
}
