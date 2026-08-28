import { create } from 'zustand';
import type { ChatMessage } from '@/shared/types';

interface GuildChatState {
  messages: ChatMessage[];
  /** 마지막으로 읽은 메시지 개수 (배지용) */
  lastSeenMsgCount: number;
  /** 히스토리 로드 여부 (guild:chat:history 1회만 요청) */
  historyLoaded: boolean;
  /** localStorage 키. DB가 비었을 때만 보조 */
  seenScope: string | null;
  /** 정본 워터마크. 스냅샷·저장 후 메모리 */
  seenMessageId: string | null;

  bindSeenScope: (memberId: string, guildId: string) => void;
  setSeenMessageId: (id: string | null) => void;
  setHistory: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  clearChatUnread: () => void;
  /** 길드 탈퇴/추방/로그아웃 등에서 호출 — 메시지·히스토리 상태 초기화. 읽은 id는 유지 */
  clearAll: () => void;
}

const MAX_MESSAGES = 200;
const LS_PREFIX = 'cdm-guild-chat-seen:';
const MSG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** 히스토리에 둘 다 있으면 더 뒤쪽. 스냅샷이 늦게 오면 메모리 워터마크를 안 되돌린다. */
function preferLaterSeen(
  msgs: ChatMessage[],
  a: string | null,
  b: string | null,
): string | null {
  if (!a) return b;
  if (!b) return a;
  const ia = msgs.findIndex((m) => m.id === a);
  const ib = msgs.findIndex((m) => m.id === b);
  if (ia === -1 && ib === -1) return b;
  if (ia === -1) return b;
  if (ib === -1) return a;
  return ia >= ib ? a : b;
}

function persistSeen(id: string): void {
  if (!MSG_ID_RE.test(id)) return;
  void fetch('/api/guild2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark_chat_seen', messageId: id }),
  }).catch(() => {});
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistId: string | null = null;

function schedulePersist(id: string): void {
  pendingPersistId = id;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const next = pendingPersistId;
    pendingPersistId = null;
    if (next) persistSeen(next);
  }, 400);
}

export const useGuildChatStore = create<GuildChatState>((set, get) => ({
  messages: [],
  lastSeenMsgCount: 0,
  historyLoaded: false,
  seenScope: null,
  seenMessageId: null,

  bindSeenScope: (memberId, guildId) => {
    if (!memberId || !guildId) return;
    const key = seenStorageKey(memberId, guildId);
    const msgs = get().messages;
    const seenId = get().seenMessageId ?? readSeenId(key);
    set({
      seenScope: key,
      seenMessageId: seenId,
      lastSeenMsgCount: lastSeenFromMessages(msgs, seenId),
    });
  },

  setSeenMessageId: (id) => {
    const cur = get().seenMessageId ?? readSeenId(get().seenScope);
    const seenId = preferLaterSeen(get().messages, cur, id);
    set({
      seenMessageId: seenId,
      lastSeenMsgCount: lastSeenFromMessages(get().messages, seenId),
    });
  },

  setHistory: (msgs) => {
    const seenId = get().seenMessageId ?? readSeenId(get().seenScope);
    set({
      messages: msgs,
      historyLoaded: true,
      seenMessageId: seenId,
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
      if (last) {
        writeSeenId(s.seenScope, last.id);
        schedulePersist(last.id);
      }
      return {
        lastSeenMsgCount: s.messages.length,
        seenMessageId: last?.id ?? s.seenMessageId,
      };
    }),

  clearAll: () =>
    set({ messages: [], lastSeenMsgCount: 0, historyLoaded: false }),
}));
