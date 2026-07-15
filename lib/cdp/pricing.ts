/** 소모품 수량 구매 가격 계산 — db/purchase_consumable_qty.sql 과 동일한 공식. */

export const BULK_TIERS = [
  { minQty: 20, rate: 0.2 },
  { minQty: 5, rate: 0.1 },
] as const;

export interface ConsumablePricing {
  original: number;      // 단가 × 수량
  bulkRate: number;      // 0 | 0.1 | 0.2
  bulkDiscount: number;  // 대량 할인액
  merchantDiscount: number; // 거상 할인액
  paid: number;          // 최종 결제가
}

export function calcConsumablePricing(
  unitPrice: number,
  qty: number,
  merchant: boolean,
  noDiscount: boolean,
): ConsumablePricing {
  const original = unitPrice * qty;
  const bulkRate = BULK_TIERS.find((t) => qty >= t.minQty)?.rate ?? 0;
  const afterBulk = Math.floor(original * (1 - bulkRate));
  const paid = merchant && !noDiscount ? Math.floor(afterBulk * 0.9) : afterBulk;
  return {
    original,
    bulkRate,
    bulkDiscount: original - afterBulk,
    merchantDiscount: afterBulk - paid,
    paid,
  };
}
