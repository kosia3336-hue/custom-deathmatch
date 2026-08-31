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
  /** 종 아이콘으로 여는 우편함 모달. 채팅 패널과 따로 논다. */
  isOpen: boolean;
  claiming: string | null;
  hydrate: () => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  reset: () => void;
  setFocusId: (id: string | null) => void;
  setOpen: (v: boolean) => void;
  claim: (id: string) => Promise<{ ok: boolean; amount: number; error?: string }>;
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
  isOpen: false,
  claiming: null,

  setFocusId: (id) => set({ focusId: id }),

  setOpen: (v) => {
    set({ isOpen: v });
    if (v) void get().refresh();
    else set({ focusId: null });
  },

  /*
    보상 수령. 서버가 멱등하므로 실패하면 그냥 목록을 다시 맞춘다.
    낙관적 갱신은 하지 않는다 — 잔액이 걸린 일이라 서버 답을 보고 반영한다.
  */
  claim: async (id) => {
    if (get().claiming) return { ok: false, amount: 0, error: '수령 중입니다.' };
    set({ claiming: id });
    try {
      const r = await fetch('/api/me/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', id }),
      });
      const data = (await r.json()) as { claimed?: boolean; amount?: number; error?: string };
      if (!r.ok) throw new Error(data.error ?? '보상을 받지 못했습니다.');
      await get().refresh();
      return { ok: Boolean(data.claimed), amount: Number(data.amount ?? 0) };
    } catch (e) {
      await get().refresh();
      return { ok: false, amount: 0, error: (e as Error).message };
    } finally {
      set({ claiming: null });
    }
  },

  reset: () => {
    fetchSeq += 1;
    clearPending();
    set({ items: [], hydrated: false, focusId: null, isOpen: false, claiming: null });
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
