import { create } from 'zustand';

/**
 * v2 — 회원 닉네임 캐시.
 * 닉네임은 회원가입 시 결정되므로 모달은 더 이상 사용하지 않는다 (showModal 항상 false).
 * v1 호환을 위해 인터페이스는 유지하되, requireNickname 은 단순 가드로만 동작.
 */
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
  nickname: typeof window !== 'undefined'
    ? (() => { try { return localStorage.getItem('nickname'); } catch { return null; } })()
    : null,
  showModal: false,
  pendingAction: null,

  setNickname: (name) => {
    set({ nickname: name, showModal: false });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nickname', name);
      } catch {
        // ignore
      }
    }
    const pending = get().pendingAction;
    if (pending) {
      set({ pendingAction: null });
      pending();
    }
  },

  openModal: () => {
    // v2: no-op (회원 닉네임은 마이페이지에서만 변경)
  },

  closeModal: () => {
    set({ showModal: false, pendingAction: null });
  },

  requireNickname: (action) => {
    const { nickname } = get();
    if (nickname) {
      action();
      return;
    }
    // 닉네임 없음 = 비로그인 게스트 → 로그인 페이지로 이동
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  },
}));
