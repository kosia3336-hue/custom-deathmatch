import { create } from 'zustand';

export type MailKind = 'title' | 'guild' | 'notice' | 'reward' | 'system';

export interface GuildScoutMail {
  inviteId: string;
  guildId: string;
  guildName: string;
  fromNickname: string;
  targetHadGuild: boolean;
  targetGuildName: string | null;
}

/** title:granted 페이로드. 예전 획득 모달과 같은 칸. */
export interface TitleGrantedMail {
  titleId: string;
  name: string;
  color: string;
  description: string | null;
  effect?: string | null;
}

export interface MailItem {
  id: string;
  kind: MailKind;
  title: string;
  body: string;
  sender: string;
  createdAt: number;
  readAt: number | null;
  titleGrant?: TitleGrantedMail;
  scoutInvite?: GuildScoutMail;
}

export interface MailDraft {
  id?: string;
  kind: MailKind;
  title: string;
  body: string;
  sender: string;
  titleGrant?: TitleGrantedMail;
  scoutInvite?: GuildScoutMail;
}

interface MailboxState {
  items: MailItem[];
  hydrated: boolean;
  /** 우편함 탭이 이 편지를 본문으로 연다. persist 안 함. */
  focusId: string | null;
  hydrate: () => void;
  addMail: (draft: MailDraft) => MailItem | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  setFocusId: (id: string | null) => void;
}

const STORAGE_KEY = 'cdm-mailbox-v1';
const MAX_MAILS = 80;

function loadItems(): MailItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MailItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m) => ({
      id: String(m.id),
      kind: m.kind,
      title: m.title,
      body: m.body,
      sender: m.sender,
      createdAt: m.createdAt,
      readAt: m.readAt ?? null,
      titleGrant: m.titleGrant,
      scoutInvite: m.scoutInvite,
    }));
  } catch {
    return [];
  }
}

function saveItems(items: MailItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode */
  }
}

let storageBound = false;

function bindStorageSync() {
  if (storageBound || typeof window === 'undefined') return;
  storageBound = true;
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      const items = e.newValue ? (JSON.parse(e.newValue) as MailItem[]) : [];
      useMailboxStore.setState({ items: Array.isArray(items) ? loadItems() : [] });
    } catch {
      /* ignore */
    }
  });
}

export function mailboxUnreadCount(items: MailItem[]): number {
  return items.reduce((n, m) => n + (m.readAt ? 0 : 1), 0);
}

export const useMailboxStore = create<MailboxState>((set, get) => ({
  items: [],
  hydrated: false,
  focusId: null,

  setFocusId: (id) => set({ focusId: id }),

  hydrate: () => {
    bindStorageSync();
    if (get().hydrated) return;
    set({ items: loadItems(), hydrated: true });
  },

  addMail: (draft) => {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) return null;
    const id =
      draft.id?.trim() ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mail-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    const existing = get().items.find((m) => m.id === id);
    if (existing) return existing;

    const item: MailItem = {
      id,
      kind: draft.kind,
      title,
      body,
      sender: draft.sender.trim() || '시스템',
      createdAt: Date.now(),
      readAt: null,
      titleGrant: draft.titleGrant,
      scoutInvite: draft.scoutInvite,
    };
    set((s) => {
      const items = [item, ...s.items].slice(0, MAX_MAILS);
      saveItems(items);
      return { items };
    });
    return item;
  },

  markRead: (id) =>
    set((s) => {
      if (!s.items.some((m) => m.id === id && !m.readAt)) return s;
      const now = Date.now();
      const items = s.items.map((m) =>
        m.id === id && !m.readAt ? { ...m, readAt: now } : m,
      );
      saveItems(items);
      return { items };
    }),

  markAllRead: () =>
    set((s) => {
      if (!s.items.some((m) => !m.readAt)) return s;
      const now = Date.now();
      const items = s.items.map((m) => (m.readAt ? m : { ...m, readAt: now }));
      saveItems(items);
      return { items };
    }),

  remove: (id) =>
    set((s) => {
      const items = s.items.filter((m) => m.id !== id);
      saveItems(items);
      return { items, focusId: s.focusId === id ? null : s.focusId };
    }),

  clearAll: () => {
    saveItems([]);
    set({ items: [] });
  },
}));
