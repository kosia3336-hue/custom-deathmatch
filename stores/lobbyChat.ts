import { create } from 'zustand';
import type { ChatMessage } from '@/shared/types';

export type LobbyChatTab = 'chat' | 'users';

interface LobbyChatState {
  messages: ChatMessage[];
  /** 마지막으로 읽은 메시지 인덱스 (배지용) */
  lastSeenMsgCount: number;
  /** 패널 모달 오픈 여부 */
  isOpen: boolean;
  /** 마지막으로 본 탭 (다음 오픈 시 복원) */
  activeTab: LobbyChatTab;

  addMessage: (msg: ChatMessage) => void;
  clearChatUnread: () => void;
  setOpen: (v: boolean) => void;
  setActiveTab: (t: LobbyChatTab) => void;
  /** 방 입장 / 소켓 단절 / 재연결 등에서 호출 — 메시지·미읽음 초기화 */
  clearAll: () => void;
}

const MAX_MESSAGES = 200;

export const useLobbyChatStore = create<LobbyChatState>((set) => ({
  messages: [],
  lastSeenMsgCount: 0,
  isOpen: false,
  activeTab: 'chat',

  addMessage: (msg) =>
    set((s) => {
      const next = [...s.messages, msg];
      const trimmed = next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      // 모달이 열려있으면 자동 읽음 처리
      const lastSeen = s.isOpen ? trimmed.length : s.lastSeenMsgCount;
      return { messages: trimmed, lastSeenMsgCount: lastSeen };
    }),

  clearChatUnread: () =>
    set((s) => ({ lastSeenMsgCount: s.messages.length })),

  setOpen: (v) =>
    set((s) => ({
      isOpen: v,
      lastSeenMsgCount: v ? s.messages.length : s.lastSeenMsgCount,
    })),

  setActiveTab: (t) => set({ activeTab: t }),

  clearAll: () =>
    set({ messages: [], lastSeenMsgCount: 0 }),
}));
