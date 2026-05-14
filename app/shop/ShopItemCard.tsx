'use client';

import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { CDP_ICON, formatCdp } from '@/lib/cdp/format';
import type { ShopItem } from '@/lib/cdp/types';

interface Props {
  item: ShopItem;
  owned: boolean;
  balance: number;
  merchantDiscount: boolean;
  onBuy: () => void;
}

interface PayloadShape {
  unique?: boolean;
  kind?: string;
  subtype?: string;
  stockPerUnit?: number;
  no_discount?: boolean;
  bias_game_id?: string;
  bias_weight?: number;
  discount_rate?: number;
}

function effectivePrice(item: ShopItem, merchantDiscount: boolean): { paid: number; original: number; discounted: boolean } {
  const payload = (item.payload ?? {}) as PayloadShape;
  if (!merchantDiscount || payload.no_discount === true) {
    return { paid: item.price, original: item.price, discounted: false };
  }
  const paid = Math.floor(item.price * 0.9);
  return { paid, original: item.price, discounted: paid !== item.price };
}

export default function ShopItemCard({ item, owned, balance, merchantDiscount, onBuy }: Props) {
  const payload = (item.payload ?? {}) as PayloadShape;
  const isUnique = Boolean(payload.unique);
  const isSoldOut = item.stock !== null && item.stock <= 0;
  const isOwnedExclusive = isUnique && owned;
  const isPreSale = !!item.availableFrom && new Date(item.availableFrom) > new Date();
  const { paid, original, discounted } = effectivePrice(item, merchantDiscount);
  const insufficient = balance < paid;

  const isSoldOutOnly = isSoldOut && !isOwnedExclusive;

  let ctaLabel = '구매';
  let ctaVariant: 'primary' | 'secondary' = 'primary';
  let ctaDisabled = false;

  if (isOwnedExclusive) {
    ctaLabel = '보유 중';
    ctaVariant = 'secondary';
    ctaDisabled = true;
  } else if (isSoldOut) {
    ctaLabel = '품절';
    ctaVariant = 'secondary';
    ctaDisabled = true;
  } else if (isPreSale) {
    ctaLabel = '준비 중';
    ctaVariant = 'secondary';
    ctaDisabled = true;
  } else if (insufficient) {
    ctaLabel = `구매 (${formatCdp(paid - balance)} 부족)`;
    ctaVariant = 'secondary';
  }

  return (
    <article aria-labelledby={`shop-item-${item.id}`} className="h-full">
      <Card className="p-3! flex h-full flex-col gap-2">
        {/* 상품명 ↔ 가격 */}
        <div className="flex items-start justify-between gap-2">
          <h3 id={`shop-item-${item.id}`} className="text-sm font-semibold text-cdm-fg leading-snug">
            {item.name}
          </h3>
          <div className="shrink-0 text-right">
            {discounted ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[11px] text-cdm-fg-muted line-through tabular-nums leading-none">
                  {CDP_ICON} {formatCdp(original)}
                </span>
                <span className="text-sm font-bold tabular-nums text-cdm-primary leading-none">
                  {CDP_ICON} {formatCdp(paid)}
                </span>
                <span className="rounded-full bg-cdm-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-cdm-primary">
                  -10%
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold tabular-nums text-cdm-fg whitespace-nowrap">
                {CDP_ICON} {formatCdp(paid)}
              </span>
            )}
          </div>
        </div>

        <p className="line-clamp-2 min-h-[2.4em] text-xs text-cdm-fg-muted">
          {item.description || ' '}
        </p>

        <div className="mt-auto flex items-center justify-end gap-1.5 pt-1">
          {isOwnedExclusive && (
            <span className="rounded-full bg-cdm-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-cdm-primary">
              보유
            </span>
          )}
          {isSoldOutOnly && (
            <span className="rounded-full bg-cdm-fg/15 px-1.5 py-0.5 text-[10px] font-bold text-cdm-fg-muted">
              품절
            </span>
          )}
        </div>

        <Button
          size="sm"
          fullWidth
          variant={ctaVariant}
          disabled={ctaDisabled}
          onClick={onBuy}
          aria-label={`${item.name} 을(를) ${formatCdp(paid)} CDP 로 구매`}
        >
          {ctaLabel}
        </Button>
      </Card>
    </article>
  );
}
