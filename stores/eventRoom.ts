import { create } from 'zustand';
import type {
  IPEMetaPayload,
  IPEStatePayload,
} from '@/shared/types';

/**
 * 인디언홀덤 (이벤트) — 룸 상태 스토어.
 * - meta: 로비 버튼/배너용 (전역 broadcast).
 * - state: 본인이 입장 중일 때만 채워짐.
 */
interface EventRoomState {
  meta: IPEMetaPayload | null;
  state: IPEStatePayload | null;
  setMeta: (m: IPEMetaPayload) => void;
  setState: (s: IPEStatePayload) => void;
  clearState: () => void;
}

const initialMeta: IPEMetaPayload = {
  activePlayers: 0,
  spectatorCount: 0,
  isOpen: false,
  status: 'waiting',
};

export const useEventRoomStore = create<EventRoomState>((set) => ({
  meta: initialMeta,
  state: null,
  setMeta: (m) => set({ meta: m }),
  setState: (s) => set({ state: s }),
  clearState: () => set({ state: null }),
}));
