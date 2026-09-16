'use client';

import { create } from 'zustand';
import type { RtbMetaPayload, RtbStatePayload } from '@shared/types/ring-the-bell';

interface GuildWarStore {
  state: RtbStatePayload | null;
  meta: RtbMetaPayload | null;
  setState: (s: RtbStatePayload) => void;
  setMeta: (m: RtbMetaPayload) => void;
  clear: () => void;
}

export const useGuildWarStore = create<GuildWarStore>((set) => ({
  state: null,
  meta: null,
  setState: (s) => set({ state: s }),
  setMeta: (m) => set({ meta: m }),
  clear: () => set({ state: null }),
}));
