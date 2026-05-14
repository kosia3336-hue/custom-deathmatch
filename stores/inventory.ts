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

const EMPTY: InventoryMap = {
  nickname_change: 0,
  rank_reset: 0,
  spectator_lock: 0,
  anonymity: 0,
};

interface InventoryState {
  items: InventoryMap | null;
  setAll: (next: InventoryMap) => void;
  setOne: (kind: ConsumableKind, count: number) => void;
  reset: () => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: null,
  setAll: (next) => set({ items: { ...EMPTY, ...next } }),
  setOne: (kind, count) =>
    set((state) => ({
      items: { ...(state.items ?? EMPTY), [kind]: Math.max(0, Math.trunc(count)) },
    })),
  reset: () => set({ items: null }),
}));
