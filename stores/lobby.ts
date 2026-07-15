import { create } from 'zustand';
import type { RoomSummary } from '@/shared/types';
import { getGameRule } from '@/lib/gameRules';

export type TabFilter = 'all' | 'rank' | 'public' | 'private' | 'waiting' | 'playing';
export type SortBy = 'newest' | 'most-players' | 'least-players';

interface LobbyState {
  rooms: RoomSummary[];
  searchQuery: string;
  /** 다중 선택 게임 필터 — 게임 id 또는 'gcat:갈래'. 빈 배열 = 전체 */
  gameFilters: string[];
  /** 다중 선택 방 종류 필터. 빈 배열 = 전체 */
  tabFilters: TabFilter[];
  sortBy: SortBy;

  setRooms: (rooms: RoomSummary[]) => void;
  addRoom: (room: RoomSummary) => void;
  updateRoom: (room: RoomSummary) => void;
  removeRoom: (roomId: string) => void;
  setSearchQuery: (q: string) => void;
  toggleGameFilter: (g: string) => void;
  toggleTabFilter: (t: TabFilter) => void;
  clearFilters: () => void;
  setSortBy: (s: SortBy) => void;
  getFilteredRooms: () => RoomSummary[];
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  rooms: [],
  searchQuery: '',
  gameFilters: [],
  tabFilters: [],
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
  toggleGameFilter: (g) =>
    set((s) => ({
      gameFilters: s.gameFilters.includes(g)
        ? s.gameFilters.filter((x) => x !== g)
        : [...s.gameFilters, g],
    })),
  toggleTabFilter: (t) =>
    set((s) => ({
      tabFilters: s.tabFilters.includes(t)
        ? s.tabFilters.filter((x) => x !== t)
        : [...s.tabFilters, t],
    })),
  clearFilters: () => set({ gameFilters: [], tabFilters: [] }),
  setSortBy: (s) => set({ sortBy: s }),

  getFilteredRooms: () => {
    const { rooms, searchQuery, gameFilters, tabFilters, sortBy } = get();
    let filtered = [...rooms];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.title.toLowerCase().includes(q));
    }

    // 게임 필터 (다중, OR) — 방 종류 필터와는 AND 결합
    if (gameFilters.length > 0) {
      filtered = filtered.filter((r) =>
        gameFilters.some((f) =>
          f.startsWith('gcat:')
            ? getGameRule(r.gameId)?.category === f.slice(5)
            : r.gameId === f,
        ),
      );
    }

    // 방 종류 필터 (다중, OR)
    if (tabFilters.length > 0) {
      filtered = filtered.filter((r) =>
        tabFilters.some((t) => {
          switch (t) {
            case 'rank': return r.isRanked === true;
            case 'public': return r.roomType === 'public';
            case 'private': return r.roomType === 'private';
            case 'waiting': return r.status === 'waiting';
            case 'playing': return r.status === 'playing';
            default: return true;
          }
        }),
      );
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
