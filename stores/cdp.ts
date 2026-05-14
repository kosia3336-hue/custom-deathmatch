import { create } from 'zustand';

/**
 * CDP 잔액 글로벌 스토어.
 *  - GNB / 상점 / 마이페이지가 공유하는 단일 SoT.
 *  - 초기값 null = 미로딩 (또는 비로그인).
 *  - 적립/소비/조정 발생 시 setBalance 로 갱신.
 */
interface CdpState {
  balance: number | null;
  setBalance: (next: number) => void;
  reset: () => void;
}

export const useCdpStore = create<CdpState>((set) => ({
  balance: null,
  setBalance: (next) => set({ balance: Math.max(0, Math.trunc(next)) }),
  reset: () => set({ balance: null }),
}));
