import { create } from 'zustand';
import type { MailItem } from '@/lib/mailbox/types';

export type {
  GuildScoutMail,
  MailItem,
  MailKind,
  TitleGrantedMail,
} from '@/lib/mailbox/types';

interface MailboxState {
  items: MailItem[];
  hydrated: boolean;
  focusId: string | null;
  hydrate: () => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  reset: () => void;
  setFocusId: (id: string | null) => void;
}

let fetchSeq = 0;
const pendingReads = new Set<string>();
const pendingDeletes = new Set<string>();
let pendingAllRead = false;

function clearPending(): void {
  pendingReads.clear();
  pendingDeletes.clear();
  pendingAllRead = false;
}

function mergeFetched(items: MailItem[]): MailItem[] {
  const now = Date.now();
  const visible = items.filter((m) => !pendingDeletes.has(m.id));
  const fetchedIds = new Set(items.map((m) => m.id));

  for (const id of [...pendingDeletes]) {
    if (!fetchedIds.has(id)) pendingDeletes.delete(id);
  }
  for (const m of items) {
    if (m.readAt) pendingReads.delete(m.id);
  }
  if (pendingAllRead && visible.every((m) => m.readAt || pendingReads.has(m.id))) {
    pendingAllRead = false;
  }

  return visible.map((m) => {
    if (m.readAt) return m;
    if (pendingAllRead || pendingReads.has(m.id)) return { ...m, readAt: now };
    return m;
  });
}

async function fetchList(): Promise<MailItem[]> {
  const r = await fetch('/api/me/mailbox', { cache: 'no-store' });
  const data = (await r.json()) as { items?: MailItem[]; error?: string };
  if (!r.ok) throw new Error(data.error ?? '우편함을 불러오지 못했습니다.');
  return Array.isArray(data.items) ? data.items : [];
}

async function postAction(action: string, id?: string): Promise<void> {
  const r = await fetch('/api/me/mailbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { action, id } : { action }),
  });
  const data = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(data.error ?? '우편함 저장에 실패했습니다.');
}

export function mailboxUnreadCount(items: MailItem[]): number {
  return items.reduce((n, m) => n + (m.readAt ? 0 : 1), 0);
}

export const useMailboxStore = create<MailboxState>((set, get) => ({
  items: [],
  hydrated: false,
  focusId: null,

  setFocusId: (id) => set({ focusId: id }),

  reset: () => {
    fetchSeq += 1;
    clearPending();
    set({ items: [], hydrated: false, focusId: null });
  },

  hydrate: () => {
    if (get().hydrated) return;
    void get().refresh();
  },

  refresh: async () => {
    const seq = ++fetchSeq;
    try {
      const items = await fetchList();
      if (seq !== fetchSeq) return;
      set({ items: mergeFetched(items), hydrated: true });
    } catch {
      if (seq !== fetchSeq) return;
      set({ hydrated: true });
    }
  },

  markRead: (id) => {
    const prev = get().items;
    if (!prev.some((m) => m.id === id && !m.readAt)) return;
    pendingReads.add(id);
    set({
      items: prev.map((m) => (m.id === id && !m.readAt ? { ...m, readAt: Date.now() } : m)),
    });
    void postAction('read', id).catch(() => {
      pendingReads.delete(id);
      void get().refresh();
    });
  },

  markAllRead: () => {
    const prev = get().items;
    if (!prev.some((m) => !m.readAt)) return;
    pendingAllRead = true;
    const now = Date.now();
    set({ items: prev.map((m) => (m.readAt ? m : { ...m, readAt: now })) });
    void postAction('read_all').catch(() => {
      pendingAllRead = false;
      void get().refresh();
    });
  },

  remove: (id) => {
    const s = get();
    pendingDeletes.add(id);
    pendingReads.delete(id);
    set({
      items: s.items.filter((m) => m.id !== id),
      focusId: s.focusId === id ? null : s.focusId,
    });
    void postAction('delete', id).catch(() => {
      pendingDeletes.delete(id);
      void get().refresh();
    });
  },
}));
