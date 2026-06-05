import { create } from 'zustand';
import type { SmsMetaPayload, SmsStatePayload } from '@/shared/types/sun-moon-star-event';

interface SmsEventRoomState {
  meta: SmsMetaPayload;
  state: SmsStatePayload | null;
  lastRoundResult: SmsStatePayload['gameData'] | null;
  setMeta: (m: SmsMetaPayload) => void;
  setState: (s: SmsStatePayload) => void;
  clearState: () => void;
}

const initialMeta: SmsMetaPayload = {
  activePlayers: 0,
  spectatorCount: 0,
  isOpen: false,
  status: 'waiting',
};

export const useSmsEventRoomStore = create<SmsEventRoomState>((set) => ({
  meta: initialMeta,
  state: null,
  lastRoundResult: null,
  setMeta: (m) => set({ meta: m }),
  setState: (s) => set({ state: s }),
  clearState: () => set({ state: null }),
}));
