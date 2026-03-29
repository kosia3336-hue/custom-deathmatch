import { create } from 'zustand';
import type { Room, Player, GameState, GameResult, ChatMessage } from '@/shared/types';

interface RoomState {
  room: Room | null;
  gameState: GameState | null;
  gameResult: GameResult | null;
  messages: ChatMessage[];
  countdown: number | null;
  isSpectator: boolean;

  setRoom: (room: Room | null) => void;
  setGameState: (state: GameState | null) => void;
  setGameResult: (result: GameResult | null) => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  setCountdown: (n: number | null) => void;
  setSpectator: (v: boolean) => void;

  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, ready: boolean) => void;
  setHost: (newHostId: string) => void;
  updateSettings: (settings: { title?: string; maxPlayers?: number }) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  gameState: null,
  gameResult: null,
  messages: [],
  countdown: null,
  isSpectator: false,

  setRoom: (room) => set({ room }),
  setGameState: (state) => set({ gameState: state }),
  setGameResult: (result) => set({ gameResult: result }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages.slice(-200), msg] })),
  clearMessages: () => set({ messages: [] }),
  setCountdown: (n) => set({ countdown: n }),
  setSpectator: (v) => set({ isSpectator: v }),

  addPlayer: (player) =>
    set((s) => {
      if (!s.room) return s;
      return { room: { ...s.room, players: [...s.room.players, player] } };
    }),

  removePlayer: (playerId) =>
    set((s) => {
      if (!s.room) return s;
      return {
        room: {
          ...s.room,
          players: s.room.players.filter((p) => p.id !== playerId),
          spectators: s.room.spectators.filter((p) => p.id !== playerId),
        },
      };
    }),

  setPlayerReady: (playerId, ready) =>
    set((s) => {
      if (!s.room) return s;
      return {
        room: {
          ...s.room,
          players: s.room.players.map((p) =>
            p.id === playerId ? { ...p, isReady: ready } : p,
          ),
        },
      };
    }),

  setHost: (newHostId) =>
    set((s) => {
      if (!s.room) return s;
      return {
        room: {
          ...s.room,
          hostId: newHostId,
          players: s.room.players.map((p) => ({
            ...p,
            isHost: p.id === newHostId,
            isReady: p.id === newHostId ? false : p.isReady,
          })),
        },
      };
    }),

  updateSettings: (settings) =>
    set((s) => {
      if (!s.room) return s;
      return {
        room: {
          ...s.room,
          ...(settings.title !== undefined && { title: settings.title }),
          ...(settings.maxPlayers !== undefined && { maxPlayers: settings.maxPlayers }),
        },
      };
    }),

  reset: () =>
    set({
      room: null,
      gameState: null,
      gameResult: null,
      messages: [],
      countdown: null,
      isSpectator: false,
    }),
}));
