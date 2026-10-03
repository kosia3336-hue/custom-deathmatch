'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { formatCdp } from '@/lib/cdp/format';
import type { ShopItem } from '@/lib/cdp/types';
import type { DevPackId } from '@/lib/shop/dev-pack';
import { devPackIdFromItem, devPackOdds, packPurchaseBlock } from '@/lib/shop/dev-pack';
import type { RankTier } from '@/shared/types/rank';
import GachaGradeBadge from './GachaGradeBadge';

const TONE: Record<DevPackId, { body: string; edge: string }> = {
  bronze: { body: '#8d5a34', edge: '#f3e2cc' },
  gold: { body: '#c7962e', edge: '#fff6d8' },
  diamond: { body: '#2f6fbe', edge: '#e7f3ff' },
};

export function PackArtwork({ packId, className = '' }: { packId: DevPackId; className?: string }) {
  const tone = TONE[packId];
  return (
    <svg viewBox="0 0 140 196" className={`w-full ${className}`} aria-hidden>
      <rect x="10" y="8" width="120" height="180" rx="6" fill={tone.body} />
      <path d="M10 36h120" stroke={tone.edge} strokeWidth="2" opacity="0.7" />
    </svg>
  );
}

export function PackBuy({
  item,
  balance,
  merchantDiscount,
  onBuy,
  viewerTier = null,
  compact = false,
}: {
  item: ShopItem;
  balance: number;
  merchantDiscount: boolean;
  onBuy: (item: ShopItem) => void;
  viewerTier?: RankTier | null;
  compact?: boolean;
}) {
  const [oddsOpen, setOddsOpen] = useState(false);
  const packId = devPackIdFromItem(item) ?? 'bronze';
  const paid = merchantDiscount ? Math.floor(item.price * 0.9) : item.price;
  const short = balance < paid;

  function openOdds() {
    if (viewerTier != null) {
      const blocked = packPurchaseBlock(packId, viewerTier);
      if (blocked) {
        toast.error(blocked);
        return;
      }
    }
    setOddsOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openOdds}
        className={`flex flex-col items-center gap-2 ${compact ? 'w-full' : 'w-36 sm:w-40'}`}
      >
        <PackArtwork packId={packId} />
        <span className="text-sm font-semibold text-cdm-fg">{item.name}</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-cdm-fg">
          <CdpIcon size={14} />
          {formatCdp(paid)}
        </span>
      </button>
      <PackOddsModal
        item={item}
        packId={packId}
        open={oddsOpen}
        paid={paid}
        short={short}
        balance={balance}
        onClose={() => setOddsOpen(false)}
        onBuy={() => {
          setOddsOpen(false);
          onBuy(item);
        }}
      />
    </>
  );
}

export function PackShelf({
  items,
  balance,
  merchantDiscount,
  onBuy,
  viewerTier = null,
}: {
  items: ShopItem[];
  balance: number;
  merchantDiscount: boolean;
  onBuy: (item: ShopItem) => void;
  viewerTier?: RankTier | null;
}) {
  return (
    <ul className="flex flex-wrap items-end justify-center gap-8 py-6">
      {items.map((item) => (
        <li key={item.id}>
          <PackBuy
            item={item}
            balance={balance}
            merchantDiscount={merchantDiscount}
            onBuy={onBuy}
            viewerTier={viewerTier}
          />
        </li>
      ))}
    </ul>
  );
}

function PackOddsModal({
  item,
  packId,
  open,
  paid,
  short,
  balance,
  onClose,
  onBuy,
}: {
  item: ShopItem;
  packId: DevPackId;
  open: boolean;
  paid: number;
  short: boolean;
  balance: number;
  onClose: () => void;
  onBuy: () => void;
}) {
  const odds = devPackOdds(packId);
  return (
    <Modal open={open} onClose={onClose} title={item.name} size="lg" className="sm:max-w-xl">
      <div
        className="max-h-[min(52dvh,420px)] overflow-y-auto overscroll-contain pr-1 -mr-1"
        role="region"
        aria-label="팩 확률표"
      >
        {item.description ? <p className="mb-3 text-sm text-cdm-fg-muted">{item.description}</p> : null}
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
          {odds.map((grade) => (
            <section key={grade.grade} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 border-b border-cdm-border pb-1.5">
                <div className="flex items-center gap-2">
                  <GachaGradeBadge grade={grade.grade} />
                  <span className="text-xs font-semibold text-cdm-fg-muted">
                    {grade.grade === 'S' ? '레전드' : `${grade.grade} 등급`}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-cdm-fg-muted">{formatPackPercent(grade.rate)}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {grade.rows.map((row) => (
                  <li key={row.name} className="flex items-start justify-between gap-2 py-0.5">
                    <span className="text-sm text-cdm-fg">{row.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-cdm-fg-muted">
                      {formatPackPercent(row.rate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 -mx-5 mt-4 border-t border-cdm-border bg-cdm-bg/95 px-5 py-4 backdrop-blur">
        <Button fullWidth variant={short ? 'secondary' : 'primary'} onClick={onBuy}>
          {short ? `구매 (${formatCdp(paid - balance)} 부족)` : `${formatCdp(paid)} CDP 로 구매`}
        </Button>
      </div>
    </Modal>
  );
}

function formatPackPercent(rate: number): string {
  if (rate >= 10) return `${Number(rate.toFixed(1))}%`;
  if (rate >= 1) return `${rate.toFixed(2)}%`;
  return `${rate.toFixed(3)}%`;
}
