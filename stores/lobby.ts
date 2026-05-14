import { create } from 'zustand';
import type { RoomSummary } from '@/shared/types';

export type TabFilter = 'all' | 'rank' | 'public' | 'private' | 'waiting' | 'playing';
export type SortBy = 'newest' | 'most-players' | 'least-players';

interface LobbyState {
  rooms: RoomSummary[];
  searchQuery: string;
  gameFilter: string;
  tabFilter: TabFilter;
  sortBy: SortBy;

  setRooms: (rooms: RoomSummary[]) => void;
  addRoom: (room: RoomSummary) => void;
  updateRoom: (room: RoomSummary) => void;
  removeRoom: (roomId: string) => void;
  setSearchQuery: (q: string) => void;
  setGameFilter: (g: string) => void;
  setTabFilter: (t: TabFilter) => void;
  setSortBy: (s: SortBy) => void;
  getFilteredRooms: () => RoomSummary[];
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  rooms: [],
  searchQuery: '',
  gameFilter: 'all',
  tabFilter: 'all',
  sortBy: 'newest',

  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) => set((s) => ({ rooms: [room, ...s.rooms] })),
  updateRoom: (room) =>
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === room.id ? room : r)),
    })),
  removeRoom: (roomId) =>
    set((s) => ({ rooms: s.rooms.filter((r) => r.id !== roomId) })),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setGameFilter: (g) => set({ gameFilter: g }),
  setTabFilter: (t) => set({ tabFilter: t }),
  setSortBy: (s) => set({ sortBy: s }),

  getFilteredRooms: () => {
    const { rooms, searchQuery, gameFilter, tabFilter, sortBy } = get();
    let filtered = [...rooms];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.title.toLowerCase().includes(q));
    }

    if (gameFilter !== 'all') {
      filtered = filtered.filter((r) => r.gameId === gameFilter);
    }

    switch (tabFilter) {
      case 'rank':
        filtered = filtered.filter((r) => r.isRanked === true);
        break;
      case 'public':
        filtered = filtered.filter((r) => r.roomType === 'public');
        break;
      case 'private':
        filtered = filtered.filter((r) => r.roomType === 'private');
        break;
      case 'waiting':
        filtered = filtered.filter((r) => r.status === 'waiting');
        break;
      case 'playing':
        filtered = filtered.filter((r) => r.status === 'playing');
        break;
    }

    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'most-players':
        filtered.sort((a, b) => b.currentPlayers - a.currentPlayers);
        break;
      case 'least-players':
        filtered.sort((a, b) => a.currentPlayers - b.currentPlayers);
        break;
    }

    return filtered;
  },
}));
