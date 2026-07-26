import { create } from 'zustand';
import type { ChatMessage } from '@/shared/types';

interface GuildChatState {
  messages: ChatMessage[];
  /** 마지막으로 읽은 메시지 개수 (배지용) */
  lastSeenMsgCount: number;
  /** 히스토리 로드 여부 (guild:chat:history 1회만 요청) */
  historyLoaded: boolean;

  setHistory: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  clearChatUnread: () => void;
  /** 길드 탈퇴/추방/로그아웃 등에서 호출 — 메시지·히스토리 상태 초기화 */
  clearAll: () => void;
}

const MAX_MESSAGES = 200;

export const useGuildChatStore = create<GuildChatState>((set) => ({
  messages: [],
  lastSeenMsgCount: 0,
  historyLoaded: false,

  setHistory: (msgs) =>
    set(() => ({ messages: msgs, historyLoaded: true, lastSeenMsgCount: msgs.length })),

  addMessage: (msg) =>
    set((s) => {
      const next = [...s.messages, msg];
      const trimmed = next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      return { messages: trimmed };
    }),

  clearChatUnread: () =>
    set((s) => ({ lastSeenMsgCount: s.messages.length })),

  clearAll: () =>
    set({ messages: [], lastSeenMsgCount: 0, historyLoaded: false }),
}));
