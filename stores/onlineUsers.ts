import { create } from 'zustand';
import type { OnlineUser } from '@/shared/types/events';

interface OnlineUsersState {
  users: OnlineUser[];
  setUsers: (users: OnlineUser[]) => void;
}

export const useOnlineUsersStore = create<OnlineUsersState>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
}));
