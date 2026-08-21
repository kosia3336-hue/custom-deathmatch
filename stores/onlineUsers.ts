import { create } from 'zustand';
import type { OnlineUser } from '@/shared/types/events';

interface OnlineUsersState {
  users: OnlineUser[];
  count: number;
  setSnapshot: (users: OnlineUser[], count: number) => void;
}

export const useOnlineUsersStore = create<OnlineUsersState>((set) => ({
  users: [],
  count: 0,
  setSnapshot: (users, count) => set({ users, count }),
}));
