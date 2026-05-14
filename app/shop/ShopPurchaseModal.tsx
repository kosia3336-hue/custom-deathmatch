'use client';

import { useState } from 'react';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { CDP_ICON, formatCdp } from '@/lib/cdp/format';
import type { ShopItem } from '@/lib/cdp/types';

interface Props {
  item: ShopItem | null;
  balance: number;
  merchantDiscount: boolean;
  onClose: () => void;
  /** true 반환 시 모달 닫음, false 반환 시 모달 유지 */
  onConfirm: (item: ShopItem) => Promise<boolean>;
}

interface PayloadShape {
  unique?: boolean;
  kind?: string;
  subtype?: string;
  stockPerUnit?: number;
  no_discount?: boolean;
}

function pricing(item: ShopItem, merchantDiscount: boolean) {
  const payload = (item.payload ?? {}) as PayloadShape;
  if (!merchantDiscount || payload.no_discount === true) {
    return { paid: item.price, original: item.price, discount: 0, discounted: false };
  }
  const paid = Math.floor(item.price * 0.9);
  return { paid, original: item.price, discount: item.price - paid, discounted: paid !== item.price };
}

export default function ShopPurchaseModal({ item, balance, merchantDiscount, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const { paid, original, discount, discounted } = pricing(item, merchantDiscount);
  const insufficient = balance < paid;
  const remaining = balance - paid;
  const payload = (item.payload ?? {}) as PayloadShape;
  const isConsumable = item.type === 'consumable';
  const stockPerUnit = isConsumable ? Math.max(1, Number(payload.stockPerUnit ?? 1)) : 1;
  const isSpecialTitle = item.type === 'title' && payload.subtype === 'special';

  async function handleConfirm() {
    if (!item || busy) return;
    setBusy(true);
    try {
      const closeAfter = await onConfirm(item);
      if (closeAfter) onClose();
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title="아이템 구매"
      size="sm"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={busy}
            disabled={insufficient || busy}
          >
            {insufficient ? 'CDP 부족' : `${formatCdp(paid)} CDP 로 구매`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-cdm-fg">{item.name}</p>
          {item.description && (
            <p className="mt-1 text-sm text-cdm-fg-muted">{item.description}</p>
          )}
          {isConsumable && stockPerUnit > 1 && (
            <p className="mt-1 text-xs text-cdm-fg-muted">패키지: {stockPerUnit}개입 (인벤토리에 +{stockPerUnit})</p>
          )}
          {isSpecialTitle && (
            <p className="mt-1 text-xs text-cdm-primary">시즌 한정 — 1명만 구매 가능</p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 rounded-cdm-md bg-cdm-bg-elev-1 p-3 text-sm">
          <dt className="text-cdm-fg-muted">정가</dt>
          <dd className={`col-span-2 text-right tabular-nums ${discounted ? 'line-through text-cdm-fg-muted' : 'font-semibold'}`}>
            {CDP_ICON} {formatCdp(original)}
          </dd>
          {discounted && (
            <>
              <dt className="text-cdm-primary">거상 할인</dt>
              <dd className="col-span-2 text-right font-semibold tabular-nums text-cdm-primary">
                -{formatCdp(discount)} (-10%)
              </dd>
              <dt className="text-cdm-fg-muted">결제가</dt>
              <dd className="col-span-2 text-right font-bold tabular-nums text-cdm-fg">
                {CDP_ICON} {formatCdp(paid)}
              </dd>
            </>
          )}
          <dt className="text-cdm-fg-muted">현재 잔액</dt>
          <dd className="col-span-2 text-right tabular-nums">
            {CDP_ICON} {formatCdp(balance)}
          </dd>
          <dt className="text-cdm-fg-muted">구매 후 잔액</dt>
          <dd
            className={`col-span-2 text-right font-semibold tabular-nums ${
              insufficient ? 'text-cdm-accent' : 'text-cdm-fg'
            }`}
          >
            {CDP_ICON} {insufficient ? `${formatCdp(remaining)} (부족)` : formatCdp(remaining)}
          </dd>
        </dl>
        <p className="text-xs text-cdm-fg-muted">
          ※ 구매한 아이템은 환불되지 않아요.
        </p>
      </div>
    </Modal>
  );
}
