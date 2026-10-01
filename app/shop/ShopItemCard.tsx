'use client';

import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { formatCdp } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { SongpyeonIcon } from '@/components/cdm/SongpyeonIcon';
import type { ShopItem } from '@/lib/cdp/types';

interface Props {
  item: ShopItem;
  owned: boolean;
  balance: number;
  /** 추석 상품은 CDP가 아니라 이 잔액으로 부족 여부를 본다. */
  songpyeonBalance?: number;
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
  /** 한가위 상품. 송편으로 산다. */
  priceUnit?: 'songpyeon';
  preview?: boolean;
  exchangeCdp?: number;
  grant?: string;
}

function effectivePrice(item: ShopItem, merchantDiscount: boolean): { paid: number; original: number; discounted: boolean } {
  const payload = (item.payload ?? {}) as PayloadShape;
  if (!merchantDiscount || payload.no_discount === true) {
    return { paid: item.price, original: item.price, discounted: false };
  }
  const paid = Math.floor(item.price * 0.9);
  return { paid, original: item.price, discounted: paid !== item.price };
}

export default function ShopItemCard({ item, owned, balance, songpyeonBalance = 0, merchantDiscount, onBuy }: Props) {
  const payload = (item.payload ?? {}) as PayloadShape;
  const isUnique = Boolean(payload.unique);
  const isSongpyeon = payload.priceUnit === 'songpyeon';
  const locksWhenOwned = isUnique || (isSongpyeon && !payload.grant && payload.exchangeCdp == null);
  const isSoldOut = item.stock !== null && item.stock <= 0;
  const isOwnedExclusive = locksWhenOwned && owned;
  const isPreSale = !!item.availableFrom && new Date(item.availableFrom) > new Date();
  const { paid, original, discounted } = effectivePrice(item, merchantDiscount);
  const payBalance = isSongpyeon ? songpyeonBalance : balance;
  const insufficient = payBalance < paid;
  const priceLabel = isSongpyeon ? formatCdp(paid) : null;

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
    const held = isSongpyeon ? songpyeonBalance : balance;
    ctaLabel = `구매 (${formatCdp(paid - held)} 부족)`;
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
                  {formatCdp(original)}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-cdm-primary leading-none">
                  <CdpIcon size={14} />
                  {formatCdp(paid)}
                </span>
                <span className="rounded-full bg-cdm-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-cdm-primary">
                  -10%
                </span>
              </div>
            ) : isSongpyeon ? (
              <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-cdm-fg whitespace-nowrap">
                <SongpyeonIcon size={20} />
                {typeof payload.exchangeCdp === 'number' ? (
                  <>
                    {formatCdp(paid)}
                    <span className="font-semibold text-cdm-fg-muted">=</span>
                    <CdpIcon size={14} />
                    {payload.exchangeCdp}
                  </>
                ) : (
                  priceLabel
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-cdm-fg whitespace-nowrap">
                <CdpIcon size={14} />
                {formatCdp(paid)}
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
          {item.stock !== null && item.stock > 0 && (
            <span className="rounded-full bg-cdm-fg/10 px-1.5 py-0.5 text-[10px] font-bold text-cdm-fg-muted">
              {item.stock}개
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
          aria-label={
            isSoldOut
              ? `${item.name} 품절`
              : `${item.name} 을(를) ${isSongpyeon ? priceLabel : `${formatCdp(paid)} CDP`} 로 구매`
          }
        >
          {ctaLabel}
        </Button>
      </Card>
    </article>
  );
}
