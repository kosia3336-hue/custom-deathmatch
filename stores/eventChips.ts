import { create } from 'zustand';

/**
 * 이벤트 칩 잔액 글로벌 스토어.
 *  - GNB / 상점 / 이벤트 룸이 공유하는 단일 SoT.
 *  - 초기값 null = 미로딩 (비로그인).
 */
interface EventChipsState {
  balance: number | null;
  setBalance: (next: number) => void;
  reset: () => void;
}

export const useEventChipsStore = create<EventChipsState>((set) => ({
  balance: null,
  setBalance: (next) => set({ balance: Math.max(0, Math.trunc(next)) }),
  reset: () => set({ balance: null }),
}));
