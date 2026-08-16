import type { ShopItem } from '@/lib/cdp/types';

export function effectIdFromShopPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  const v = payload?.effect_id;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** 누군가(개발자 천하 제외) 영구 보유한 이펙트는 상점 이용권을 전역에서 뺀다. 이미 산 기간제는 만료까지 유지. */
export function hidePermanentlyOwnedEffectItems<T extends { payload: Record<string, unknown> }>(
  items: T[],
  permanentEffectIds: Iterable<string>,
): T[] {
  const hide = new Set(permanentEffectIds);
  if (hide.size === 0) return items;
  return items.filter((it) => {
    const eid = effectIdFromShopPayload(it.payload);
    return !eid || !hide.has(eid);
  });
}

export function isEffectShopItem(item: Pick<ShopItem, 'type' | 'payload'>): boolean {
  return item.type === 'effect' || effectIdFromShopPayload(item.payload) !== null;
}
