import { create } from 'zustand';
import type { ConsumableKind } from '@/lib/cdp/types';

/**
 * 회원 소모성 인벤토리 글로벌 스토어.
 *
 *  - GNB / 마이페이지 / 모달 등이 공유.
 *  - null = 미로딩 (또는 비로그인).
 *  - 초기 fetch 는 useInitInventory 훅이 담당.
 */
export type InventoryMap = Record<ConsumableKind, number>;
export type AutoUseMap = Record<ConsumableKind, boolean>;

const EMPTY: InventoryMap = {
  nickname_change: 0,
  rank_reset: 0,
  spectator_lock: 0,
  anonymity: 0,
  magnifier: 0,
  ban_eraser: 0,
  gacha_box: 0,
  gacha_ticket: 0,
  guild_charter: 0,
  word_search: 0,
  counter_charm: 0,
  calm_charm: 0,
  demotion_shield: 0,
};

const EMPTY_AUTO_USE: AutoUseMap = {
  nickname_change: true,
  rank_reset: true,
  spectator_lock: true,
  anonymity: true,
  magnifier: true,
  ban_eraser: true,
  gacha_box: false,
  gacha_ticket: false,
  guild_charter: false,
  word_search: true,
  counter_charm: true,
  calm_charm: true,
  demotion_shield: true,
};

interface InventoryState {
  items: InventoryMap | null;
  autoUse: AutoUseMap | null;
  setAll: (next: InventoryMap, nextAutoUse: AutoUseMap) => void;
  setOne: (kind: ConsumableKind, count: number) => void;
  setAutoUse: (kind: ConsumableKind, value: boolean) => void;
  reset: () => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: null,
  autoUse: null,
  setAll: (next, nextAutoUse) =>
    set({ items: { ...EMPTY, ...next }, autoUse: { ...EMPTY_AUTO_USE, ...nextAutoUse } }),
  setOne: (kind, count) =>
    set((state) => ({
      items: { ...(state.items ?? EMPTY), [kind]: Math.max(0, Math.trunc(count)) },
    })),
  setAutoUse: (kind, value) =>
    set((state) => ({
      autoUse: { ...(state.autoUse ?? EMPTY_AUTO_USE), [kind]: value },
    })),
  reset: () => set({ items: null, autoUse: null }),
}));
