import { v4 as uuid } from 'uuid';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { Room, RoomSummary, Player, PlayMode, RoomType, RoomStatus } from '@shared/types/room.js';

type RoomInternal = Room & { _password?: string; _minPlayers: number };

const rooms = new Map<string, RoomInternal>();
const inviteTokens = new Map<string, string>();

function toSummary(room: RoomInternal): RoomSummary {
  const host = room.players.find((p) => p.id === room.hostId);
  return {
    id: room.id,
    title: room.title,
    gameId: room.gameId,
    gameName: room.gameName,
    playMode: room.playMode,
    roomType: room.roomType,
    maxPlayers: room.maxPlayers,
    currentPlayers: room.players.length,
    spectatorCount: room.spectators.length,
    status: room.status,
    hostNickname: host?.nickname ?? '',
    timeLimitSeconds: room.timeLimitSeconds,
    createdAt: room.createdAt,
  };
}

function toClientRoom(room: RoomInternal): Room {
  const copy = { ...room } as Room & { _password?: string; _minPlayers?: number };
  delete copy._password;
  delete copy._minPlayers;
  return copy;
}

export const roomStore = {
  create(opts: {
    title: string;
    gameId: string;
    gameName: string;
    playMode: PlayMode;
    roomType: RoomType;
    password?: string;
    maxPlayers: number;
    minPlayers: number;
    timeLimitSeconds?: number | null;
    host: Player;
  }): Room {
    const id = uuid().slice(0, 8);
    const aiBot: Player = {
      id: AI_PLAYER_ID,
      nickname: AI_PLAYER_ID,
      isHost: false,
      isReady: true,
      joinedAt: Date.now(),
    };

    const room: RoomInternal = {
      id,
      title: opts.title,
      gameId: opts.gameId,
      gameName: opts.gameName,
      playMode: opts.playMode,
      roomType: opts.roomType,
      maxPlayers: opts.playMode === 'multi' ? opts.maxPlayers : opts.playMode === 'com' ? 2 : 1,
      players: opts.playMode === 'com' ? [opts.host, aiBot] : [opts.host],
      spectators: [],
      status: opts.playMode === 'solo' ? 'playing' : 'waiting',
      hostId: opts.host.id,
      inviteToken: null,
      timeLimitSeconds: opts.timeLimitSeconds ?? null,
      createdAt: Date.now(),
      _minPlayers: opts.minPlayers,
    };
    if (opts.roomType === 'private' && opts.password) {
      room._password = opts.password;
    }
    rooms.set(id, room);
    return room;
  },

  get(roomId: string): Room | undefined {
    return rooms.get(roomId);
  },

  getAll(): Room[] {
    return Array.from(rooms.values());
  },

  getAllSummaries(): RoomSummary[] {
    return Array.from(rooms.values()).map(toSummary);
  },

  getSummary(roomId: string): RoomSummary | undefined {
    const room = rooms.get(roomId);
    return room ? toSummary(room) : undefined;
  },

  getClientRoom(roomId: string): Room | undefined {
    const room = rooms.get(roomId);
    return room ? toClientRoom(room) : undefined;
  },

  getPassword(roomId: string): string | undefined {
    return rooms.get(roomId)?._password;
  },

  addPlayer(roomId: string, player: Player): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    if (room.players.length >= room.maxPlayers) return false;
    if (room.status !== 'waiting') return false;
    room.players.push(player);
    return true;
  },

  removePlayer(roomId: string, playerId: string): { removed: boolean; newHostId?: string; destroyed: boolean } {
    const room = rooms.get(roomId);
    if (!room) return { removed: false, destroyed: false };

    room.players = room.players.filter((p) => p.id !== playerId);
    room.spectators = room.spectators.filter((p) => p.id !== playerId);

    if (room.players.length === 0 || room.players.every((p) => p.id === AI_PLAYER_ID)) {
      if (room.inviteToken) inviteTokens.delete(room.inviteToken);
      rooms.delete(roomId);
      return { removed: true, destroyed: true };
    }

    let newHostId: string | undefined;
    if (room.hostId === playerId) {
      const nextHost = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      room.hostId = nextHost.id;
      nextHost.isHost = true;
      nextHost.isReady = false;
      newHostId = nextHost.id;
    }

    return { removed: true, newHostId, destroyed: false };
  },

  setPlayerReady(roomId: string, playerId: string, ready: boolean) {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.isReady = ready;
  },

  canStart(roomId: string): { ok: boolean; reason?: string } {
    const room = rooms.get(roomId);
    if (!room) return { ok: false, reason: '방을 찾을 수 없습니다.' };
    if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 진행 중입니다.' };

    const minPlayers = room._minPlayers;
    if (room.players.length < minPlayers) {
      return { ok: false, reason: `최소 ${minPlayers}명이 필요합니다 (현재 ${room.players.length}명)` };
    }

    const nonHostNotReady = room.players.filter((p) => p.id !== room.hostId && p.id !== AI_PLAYER_ID && !p.isReady);
    if (nonHostNotReady.length > 0) {
      return { ok: false, reason: `모든 참여자가 준비해야 합니다 (${nonHostNotReady.length}명 대기 중)` };
    }

    return { ok: true };
  },

  setStatus(roomId: string, status: RoomStatus) {
    const room = rooms.get(roomId);
    if (room) room.status = status;
  },

  updateSettings(roomId: string, settings: { title?: string; maxPlayers?: number }) {
    const room = rooms.get(roomId);
    if (!room) return;
    if (settings.title) room.title = settings.title;
    if (settings.maxPlayers && settings.maxPlayers >= room.players.length) {
      room.maxPlayers = settings.maxPlayers;
    }
  },

  delegateHost(roomId: string, newHostId: string): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    const newHost = room.players.find((p) => p.id === newHostId);
    if (!newHost) return false;

    const oldHost = room.players.find((p) => p.id === room.hostId);
    if (oldHost) {
      oldHost.isHost = false;
      oldHost.isReady = false;
    }
    newHost.isHost = true;
    newHost.isReady = false;
    room.hostId = newHostId;
    return true;
  },

  addSpectator(roomId: string, spectator: Player): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    room.spectators.push(spectator);
    return true;
  },

  moveToSpectator(roomId: string, playerId: string): boolean {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'waiting') return false;
    if (room.hostId === playerId) return false;
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return false;
    const [player] = room.players.splice(idx, 1);
    player.isReady = false;
    player.isHost = false;
    room.spectators.push(player);
    return true;
  },

  moveToPlayer(roomId: string, spectatorId: string): boolean {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'waiting') return false;
    if (room.players.length >= room.maxPlayers) return false;
    const idx = room.spectators.findIndex((p) => p.id === spectatorId);
    if (idx === -1) return false;
    const [spectator] = room.spectators.splice(idx, 1);
    spectator.isReady = false;
    room.players.push(spectator);
    return true;
  },

  createInviteToken(roomId: string): string {
    const token = uuid().slice(0, 12);
    inviteTokens.set(token, roomId);
    const room = rooms.get(roomId);
    if (room) room.inviteToken = token;
    return token;
  },

  getRoomByInviteToken(token: string): string | undefined {
    return inviteTokens.get(token);
  },

  delete(roomId: string) {
    const room = rooms.get(roomId);
    if (room?.inviteToken) {
      inviteTokens.delete(room.inviteToken);
    }
    rooms.delete(roomId);
  },

  swapPlayers(roomId: string): boolean {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'waiting' || room.players.length !== 2) return false;
    [room.players[0], room.players[1]] = [room.players[1], room.players[0]];
    return true;
  },

  findQuickJoinRoom(gameId?: string): Room | undefined {
    const candidates = Array.from(rooms.values()).filter(
      (r) =>
        r.status === 'waiting' &&
        r.roomType === 'public' &&
        r.playMode === 'multi' &&
        r.players.length < r.maxPlayers &&
        (!gameId || r.gameId === gameId),
    );
    // 인원이 가장 많은 방 우선 (빠른 매칭), 동점이면 먼저 만들어진 방
    return candidates.sort((a, b) =>
      b.players.length - a.players.length || a.createdAt - b.createdAt,
    )[0];
  },

  resetForRematch(roomId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.status = 'waiting';
    room.players.forEach((p) => {
      p.isReady = false;
    });
  },

  toSummary,
};
