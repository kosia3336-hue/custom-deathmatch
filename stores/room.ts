import { create } from 'zustand';
import type { Room, Player, GameState, GameResult, ChatMessage } from '@/shared/types';

interface ReconnectingPlayer {
  playerId: string;
  nickname: string;
  secondsLeft: number;
}

interface RoomState {
  room: Room | null;
  gameState: GameState | null;
  gameResult: GameResult | null;
  messages: ChatMessage[];
  lastSeenMsgCount: number;
  countdown: number | null;
  isSpectator: boolean;
  /** 인게임 중 재연결 대기 중인 플레이어 목록 (최대 2명) */
  reconnectingPlayers: ReconnectingPlayer[];

  setRoom: (room: Room | null) => void;
  setGameState: (state: GameState | null) => void;
  setGameResult: (result: GameResult | null) => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  clearChatUnread: () => void;
  setCountdown: (n: number | null) => void;
  setSpectator: (v: boolean) => void;
  addReconnectingPlayer: (player: ReconnectingPlayer) => void;
  removeReconnectingPlayer: (playerId: string) => void;

  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, ready: boolean) => void;
  setHost: (newHostId: string) => void;
  updateSettings: (room: Room) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  gameState: null,
  gameResult: null,
  messages: [],
  lastSeenMsgCount: 0,
  countdown: null,
  isSpectator: false,
  reconnectingPlayers: [],

  setRoom: (room) => set({ room }),
  setGameState: (state) => set({ gameState: state }),
  setGameResult: (result) => set({ gameResult: result }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages.slice(-199), msg] })),
  clearMessages: () => set({ messages: [], lastSeenMsgCount: 0 }),
  clearChatUnread: () => set((s) => ({ lastSeenMsgCount: s.messages.length })),
  setCountdown: (n) => set({ countdown: n }),
  setSpectator: (v) => set({ isSpectator: v }),
  addReconnectingPlayer: (player) =>
    set((s) => ({
      reconnectingPlayers: [
        ...s.reconnectingPlayers.filter((p) => p.playerId !== player.playerId),
        player,
      ],
    })),
  removeReconnectingPlayer: (playerId) =>
    set((s) => ({
      reconnectingPlayers: s.reconnectingPlayers.filter((p) => p.playerId !== playerId),
    })),

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

  updateSettings: (room) => set({ room }),

  reset: () =>
    set({
      room: null,
      gameState: null,
      gameResult: null,
      messages: [],
      lastSeenMsgCount: 0,
      countdown: null,
      isSpectator: false,
      reconnectingPlayers: [],
    }),
}));
