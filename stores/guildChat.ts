import { create } from 'zustand';
import type { ChatMessage } from '@/shared/types';

interface GuildChatState {
  messages: ChatMessage[];
  /** 마지막으로 읽은 메시지 개수 (배지용) */
  lastSeenMsgCount: number;
  /** 히스토리 로드 여부 (guild:chat:history 1회만 요청) */
  historyLoaded: boolean;
  /** localStorage 키. 회원+길드. 없으면 워터마크를 안 읽는다 */
  seenScope: string | null;

  bindSeenScope: (memberId: string, guildId: string) => void;
  setHistory: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  clearChatUnread: () => void;
  /** 길드 탈퇴/추방/로그아웃 등에서 호출 — 메시지·히스토리 상태 초기화. 읽은 id는 유지 */
  clearAll: () => void;
}

const MAX_MESSAGES = 200;
const LS_PREFIX = 'cdm-guild-chat-seen:';

function seenStorageKey(memberId: string, guildId: string): string {
  return `${LS_PREFIX}${memberId}:${guildId}`;
}

function readSeenId(key: string | null): string | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeSeenId(key: string | null, id: string): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, id);
  } catch {
    /* quota / private mode */
  }
}

/** 저장된 메시지 id 까지가 읽음. 없거나 히스토리에서 빠지면 0(전부 안 읽음). */
function lastSeenFromMessages(msgs: ChatMessage[], seenId: string | null): number {
  if (!seenId) return 0;
  const idx = msgs.findIndex((m) => m.id === seenId);
  if (idx === -1) return 0;
  return idx + 1;
}

export const useGuildChatStore = create<GuildChatState>((set, get) => ({
  messages: [],
  lastSeenMsgCount: 0,
  historyLoaded: false,
  seenScope: null,

  bindSeenScope: (memberId, guildId) => {
    if (!memberId || !guildId) return;
    const key = seenStorageKey(memberId, guildId);
    const msgs = get().messages;
    set({
      seenScope: key,
      lastSeenMsgCount: lastSeenFromMessages(msgs, readSeenId(key)),
    });
  },

  setHistory: (msgs) => {
    const seenId = readSeenId(get().seenScope);
    set({
      messages: msgs,
      historyLoaded: true,
      lastSeenMsgCount: lastSeenFromMessages(msgs, seenId),
    });
  },

  addMessage: (msg) =>
    set((s) => {
      const next = [...s.messages, msg];
      const trimmed = next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      return { messages: trimmed };
    }),

  clearChatUnread: () =>
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (last) writeSeenId(s.seenScope, last.id);
      return { lastSeenMsgCount: s.messages.length };
    }),

  clearAll: () =>
    set({ messages: [], lastSeenMsgCount: 0, historyLoaded: false }),
}));
