import { create } from 'zustand';

interface SessionTakeoverState {
  pending: { nickname: string; roomId?: string } | null;
  setPending: (data: { nickname: string; roomId?: string }) => void;
  clearPending: () => void;
}

export const useSessionTakeoverStore = create<SessionTakeoverState>((set) => ({
  pending: null,
  setPending: (data) => set({ pending: data }),
  clearPending: () => set({ pending: null }),
}));
