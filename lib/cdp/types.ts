/**
 * CDP / 상점 시스템 공용 타입.
 */

import type { ConsumableKind } from '@/lib/supabase/database.types';

export type { ConsumableKind };

export interface CdpSummary {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export type CdpReason =
  | 'rank_win' | 'rank_loss' | 'rank_draw' | 'rank_win_forfeit'
  | 'shop_purchase' | 'admin_adjust';

export type CdpRefKind = 'rank_match' | 'shop_purchase' | 'admin_action';

export interface CdpLedgerEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: CdpReason | string;
  refKind: CdpRefKind | string;
  refId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  isLimited: boolean;
  isActive: boolean;
  payload: Record<string, unknown>;
  availableFrom: string | null;
  availableUntil: string | null;
  sortOrder: number;
}

export interface ShopPurchaseEntry {
  id: string;
  itemId: string;
  name: string;
  type: string;
  pricePaid: number;
  purchasedAt: string;
}

export interface PurchaseSuccess {
  ok: true;
  /** 'event_chip_pack' 이면 칩 구매 분기, 그 외엔 일반 shop_purchase */
  kind?: string;
  purchaseId?: string;
  newBalance: number;
  pricePaid: number;
  priceOriginal: number;
  discountApplied: number;
  stockAfter: number | null;
  grantedTitleId: string | null;
  consumableKind: ConsumableKind | null;
  consumableAdded: number;
  /** event_chip_pack 분기에서만 채워짐 */
  grantedChips?: number;
  newChipBalance?: number;
}

export type PurchaseErrorCode =
  | 'forbidden' | 'unauthorized' | 'invalid_request'
  | 'member_not_active' | 'item_not_found' | 'item_inactive'
  | 'item_not_available_yet' | 'item_expired' | 'out_of_stock'
  | 'insufficient_balance' | 'already_owned' | 'effect_permanently_claimed'
  | 'service_unavailable' | 'internal_error';

// ── 인벤토리 / 소모성 ──────────────────────────────────────────────────

export interface ConsumableInventoryEntry {
  kind: ConsumableKind;
  count: number;
  updatedAt: string | null;
}

export interface ConsumableUseEntry {
  id: string;
  kind: ConsumableKind;
  refKind: string;
  refId: string;
  metadata: Record<string, unknown>;
  usedAt: string;
}

export interface PurchaseError {
  error: string;
  code: PurchaseErrorCode;
}

/** 자유 텍스트 type → 사람용 라벨. 매핑이 없으면 원문 사용. */
export const TYPE_LABELS: Record<string, string> = {
  cosmetic: '코스메틱',
  badge: '배지',
  limited: '한정판',
  title: '칭호',
  frame: '프레임',
  effect: '이펙트',
  consumable: '소모성',
  event_chip_pack: '이벤트 칩',
  event_chip_exchange: '칩 환전',
  gacha: '뽑기',
};

export function labelForType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** 소모성 종류 → 한글 라벨 */
export const CONSUMABLE_LABELS: Record<ConsumableKind, string> = {
  nickname_change: '닉네임 변경권',
  rank_reset: '랭크 초기화권',
  spectator_lock: '관전 잠금',
  anonymity: '익명물약',
  magnifier: '돋보기',
  ban_eraser: '밴 삭제',
  gacha_box: '뽑기 박스',
  gacha_ticket: '뽑기권',
  guild_charter: '길드 창설권',
  word_search: '검색 찬스',
};

export function labelForConsumable(kind: ConsumableKind | string): string {
  return (CONSUMABLE_LABELS as Record<string, string>)[kind] ?? kind;
}
