'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { formatCdp } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { SongpyeonIcon } from '@/components/cdm/SongpyeonIcon';
import { calcConsumablePricing } from '@/lib/cdp/pricing';
import type { ShopItem } from '@/lib/cdp/types';

interface Props {
  item: ShopItem | null;
  balance: number;
  songpyeonBalance?: number;
  merchantDiscount: boolean;
  onClose: () => void;
  /** true 반환 시 모달 닫음, false 반환 시 모달 유지 */
  onConfirm: (item: ShopItem, quantity: number) => Promise<boolean>;
}

interface PayloadShape {
  unique?: boolean;
  kind?: string;
  subtype?: string;
  no_discount?: boolean;
  priceUnit?: 'songpyeon';
  exchangeCdp?: number;
  preview?: boolean;
}

const QTY_MAX = 99;

export default function ShopPurchaseModal({
  item,
  balance,
  songpyeonBalance = 0,
  merchantDiscount,
  onClose,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [item?.id]);

  if (!item) return null;

  const payload = (item.payload ?? {}) as PayloadShape;
  const isSongpyeon = payload.priceUnit === 'songpyeon';
  const isPreviewPack = item.type === 'pack' && payload.preview === true;
  const exchangeRate = payload.exchangeCdp;
  const isExchange = typeof exchangeRate === 'number';
  const isConsumable = !isSongpyeon && item.type === 'consumable' && payload.kind !== 'event_chip_pack';
  const noDiscount = payload.no_discount === true;
  const isSpecialTitle = item.type === 'title' && payload.subtype === 'special';
  const qtyCap = isExchange ? Math.max(1, item.stock ?? 10000) : QTY_MAX;

  const quantity = isExchange || isConsumable ? qty : 1;
  const p = calcConsumablePricing(item.price, quantity, merchantDiscount, noDiscount || isSongpyeon);
  const songCost = item.price * quantity;
  const cdpGain = (exchangeRate ?? 0) * quantity;
  const insufficient = isSongpyeon ? songpyeonBalance < songCost : balance < p.paid;
  const remaining = isSongpyeon ? songpyeonBalance - songCost : balance - p.paid;

  function setQtyClamped(n: number) {
    setQty(Math.max(1, Math.min(qtyCap, Math.floor(Number.isFinite(n) ? n : 1))));
  }

  async function handleConfirm() {
    if (!item || busy) return;
    setBusy(true);
    try {
      const closeAfter = await onConfirm(item, quantity);
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
      title={isExchange ? '송편 환전' : '아이템 구매'}
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
            {insufficient
              ? isSongpyeon
                ? '송편 부족'
                : 'CDP 부족'
              : isExchange
                ? `${formatCdp(songCost)} 송편 → ${formatCdp(cdpGain)} CDP`
                : isSongpyeon
                  ? `${formatCdp(songCost)} 송편으로 구매`
                  : `${formatCdp(p.paid)} CDP 로 구매`}
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
          {isSpecialTitle && (
            <p className="mt-1 text-xs text-cdm-primary">시즌 한정 — 1명만 구매 가능</p>
          )}
        </div>

        {isExchange && (
          <div>
            <label className="text-xs font-semibold text-cdm-fg-muted">바꿀 송편</label>
            <div className="mt-1 flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={busy || qty <= 1} onClick={() => setQtyClamped(qty - 1)} aria-label="수량 줄이기">
                −
              </Button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={qtyCap}
                value={qty}
                onChange={(e) => setQtyClamped(Number(e.target.value))}
                className="w-24 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-center text-sm tabular-nums"
                disabled={busy}
              />
              <Button size="sm" variant="secondary" disabled={busy || qty >= qtyCap} onClick={() => setQtyClamped(qty + 1)} aria-label="수량 늘리기">
                +
              </Button>
              <div className="ml-1 flex gap-1">
                {[10, 100, 1000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy || n > qtyCap}
                    onClick={() => setQtyClamped(n)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      qty === n
                        ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                        : 'border-cdm-border text-cdm-fg-muted hover:border-cdm-primary hover:text-cdm-primary'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-cdm-fg-subtle">
              1송편 = {exchangeRate} CDP
              {item.stock != null ? ` · 남은 수량 ${formatCdp(item.stock)}개` : ''}
            </p>
          </div>
        )}

        {isConsumable && (
          <div>
            <label className="text-xs font-semibold text-cdm-fg-muted">수량</label>
            <div className="mt-1 flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={busy || qty <= 1} onClick={() => setQtyClamped(qty - 1)} aria-label="수량 줄이기">
                −
              </Button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={QTY_MAX}
                value={qty}
                onChange={(e) => setQtyClamped(Number(e.target.value))}
                className="w-20 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-center text-sm tabular-nums"
                disabled={busy}
              />
              <Button size="sm" variant="secondary" disabled={busy || qty >= QTY_MAX} onClick={() => setQtyClamped(qty + 1)} aria-label="수량 늘리기">
                +
              </Button>
              <div className="ml-1 flex gap-1">
                {[5, 20].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy}
                    onClick={() => setQtyClamped(n)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      qty === n
                        ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                        : 'border-cdm-border text-cdm-fg-muted hover:border-cdm-primary hover:text-cdm-primary'
                    }`}
                  >
                    {n}개
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-cdm-fg-subtle">
              5개 이상 구매 시 10%, 20개 이상 구매 시 20% 대량 할인이 적용됩니다.
            </p>
          </div>
        )}

        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 rounded-cdm-md bg-cdm-bg-elev-1 p-3 text-sm">
          <dt className="text-cdm-fg-muted">정가</dt>
          <dd className={`col-span-2 inline-flex items-center justify-end gap-1 tabular-nums ${!isSongpyeon && p.paid < p.original ? 'line-through text-cdm-fg-muted' : 'font-semibold'}`}>
            {isSongpyeon ? <SongpyeonIcon size={18} /> : <CdpIcon size={14} />}
            {formatCdp(isSongpyeon ? songCost : p.original)}
            {quantity > 1 && (
              <span className="ml-1 text-xs text-cdm-fg-subtle">({formatCdp(item.price)} × {quantity})</span>
            )}
          </dd>
          {!isSongpyeon && p.bulkDiscount > 0 && (
            <>
              <dt className="text-cdm-primary">대량 할인</dt>
              <dd className="col-span-2 text-right font-semibold tabular-nums text-cdm-primary">
                -{formatCdp(p.bulkDiscount)} (-{Math.round(p.bulkRate * 100)}%)
              </dd>
            </>
          )}
          {!isSongpyeon && p.merchantDiscount > 0 && (
            <>
              <dt className="text-cdm-primary">거상 할인</dt>
              <dd className="col-span-2 text-right font-semibold tabular-nums text-cdm-primary">
                -{formatCdp(p.merchantDiscount)} (-10%)
              </dd>
            </>
          )}
          {!isSongpyeon && p.paid < p.original && (
            <>
              <dt className="text-cdm-fg-muted">결제가</dt>
              <dd className="col-span-2 inline-flex items-center justify-end gap-1 font-bold tabular-nums text-cdm-fg">
                <CdpIcon size={14} />
                {formatCdp(p.paid)}
              </dd>
            </>
          )}
          <dt className="text-cdm-fg-muted">현재 잔액</dt>
          <dd className="col-span-2 inline-flex items-center justify-end gap-1 tabular-nums">
            {isSongpyeon ? <SongpyeonIcon size={18} /> : <CdpIcon size={14} />}
            {formatCdp(isSongpyeon ? songpyeonBalance : balance)}
          </dd>
          <dt className="text-cdm-fg-muted">구매 후 잔액</dt>
          <dd
            className={`col-span-2 inline-flex items-center justify-end gap-1 font-semibold tabular-nums ${
              insufficient ? 'text-cdm-accent' : 'text-cdm-fg'
            }`}
          >
            {isSongpyeon ? <SongpyeonIcon size={18} /> : <CdpIcon size={14} />}
            {insufficient ? `${formatCdp(remaining)} (부족)` : formatCdp(remaining)}
            {isExchange && !insufficient && (
              <span className="ml-1 inline-flex items-center gap-1 text-xs text-cdm-fg-muted">
                <CdpIcon size={12} />+{formatCdp(cdpGain)}
              </span>
            )}
          </dd>
        </dl>
        <p className="text-xs text-cdm-fg-muted">
          {isPreviewPack
            ? '데브 프리뷰입니다. 화면의 잔액만 줄고, 아이템은 지급되지 않습니다.'
            : item.type === 'pack'
              ? '구매한 팩은 환불되지 않습니다. 고르다 닫으면 남은 칸은 사라집니다.'
              : '※ 구매한 아이템은 환불되지 않습니다. (판매 시 구매가의 10% 환급)'}
        </p>
      </div>
    </Modal>
  );
}
