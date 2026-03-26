import { create } from 'zustand';

interface NicknameState {
  nickname: string | null;
  showModal: boolean;
  pendingAction: (() => void) | null;
  setNickname: (name: string) => void;
  openModal: (onComplete?: () => void) => void;
  closeModal: () => void;
  requireNickname: (action: () => void) => void;
}

export const useNicknameStore = create<NicknameState>((set, get) => ({
  nickname: null,
  showModal: false,
  pendingAction: null,

  setNickname: (name) => {
    set({ nickname: name, showModal: false });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('nickname', name);
    }
    const pending = get().pendingAction;
    if (pending) {
      set({ pendingAction: null });
      pending();
    }
  },

  openModal: (onComplete) => {
    set({ showModal: true, pendingAction: onComplete ?? null });
  },

  closeModal: () => {
    set({ showModal: false, pendingAction: null });
  },

  requireNickname: (action) => {
    const { nickname } = get();
    if (nickname) {
      action();
    } else {
      set({ showModal: true, pendingAction: action });
    }
  },
}));
