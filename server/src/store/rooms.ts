import { v4 as uuid } from 'uuid';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { Room, RoomSummary, Player, PlayMode, RoomType, RoomStatus, TurnOrderMode } from '@shared/types/room.js';

type RoomInternal = Room & { _password?: string; _minPlayers: number; _fromBanPick?: boolean };

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
    gameOptions: room.gameOptions,
    createdAt: room.createdAt,
    ...(room.isRanked ? { isRanked: true } : {}),
  };
}

function toClientRoom(room: RoomInternal): Room {
  const copy = { ...room } as Room & {
    _password?: string;
    _minPlayers?: number;
    _fromBanPick?: boolean;
  };
  delete copy._password;
  delete copy._minPlayers;
  delete copy._fromBanPick;
  // v2: 2인 게임의 자리 순서 = 선/후공 (players[0] = 선공)
  if (copy.players.length === 2) {
    copy.players = copy.players.map((p, i) => ({
      ...p,
      turnPosition: i === 0 ? 'first' : 'second',
    }));
  } else {
    copy.players = copy.players.map((p) => ({ ...p, turnPosition: null }));
  }
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
    gameOptions?: Record<string, unknown>;
    turnOrderMode?: TurnOrderMode;
    host: Player;
    isRanked?: boolean;
    rankSeasonId?: number;
    spectatorAllowed?: boolean;
  }): Room {
    let id: string;
    do {
      id = uuid().slice(0, 8);
    } while (rooms.has(id));
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
      gameOptions: opts.gameOptions ?? {},
      turnOrderMode: opts.turnOrderMode ?? 'random',
      createdAt: Date.now(),
      _minPlayers: opts.minPlayers,
      ...(opts.isRanked === true ? { isRanked: true as const } : {}),
      ...(opts.rankSeasonId != null ? { rankSeasonId: opts.rankSeasonId } : {}),
      ...(opts.spectatorAllowed === true ? { spectatorAllowed: true as const } : {}),
    };
    if (opts.roomType === 'private' && opts.password) {
      room._password = opts.password;
    }
    rooms.set(id, room);
    return room;
  },

  /**
   * 서버 내부 로직용. 반환값을 절대 클라이언트에 직접 전송하지 말 것.
   * 클라이언트 전송에는 getClientRoom() 을 사용할 것.
   */
  get(roomId: string): RoomInternal | undefined {
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

  updateSettings(
    roomId: string,
    settings: {
      title?: string;
      gameId?: string;
      gameName?: string;
      minPlayers?: number;
      maxPlayers?: number;
      roomType?: RoomType;
      password?: string;
      clearPassword?: boolean;
      timeLimitSeconds?: number | null;
      gameOptions?: Record<string, unknown>;
      turnOrderMode?: TurnOrderMode;
    },
  ) {
    const room = rooms.get(roomId);
    if (!room) return;

    if (settings.title !== undefined) room.title = settings.title;

    if (settings.gameId !== undefined) {
      room.gameId = settings.gameId;
      room.gameName = settings.gameName ?? room.gameName;
      if (settings.minPlayers !== undefined) room._minPlayers = settings.minPlayers;
      room.gameOptions = settings.gameOptions ?? {};
      // 게임 변경 시 방장 제외 전원 준비 해제
      room.players.forEach((p) => {
        if (p.id !== room.hostId && p.id !== AI_PLAYER_ID) {
          p.isReady = false;
        }
      });
    } else if (settings.gameOptions !== undefined) {
      room.gameOptions = settings.gameOptions;
    }

    if (settings.maxPlayers !== undefined) {
      room.maxPlayers = settings.maxPlayers;
    }

    if (settings.roomType !== undefined) {
      room.roomType = settings.roomType;
    }

    if (settings.clearPassword) {
      delete room._password;
      if (room.inviteToken) {
        inviteTokens.delete(room.inviteToken);
        room.inviteToken = null;
      }
    } else if (settings.password !== undefined) {
      room._password = settings.password;
    }

    if (settings.timeLimitSeconds !== undefined) {
      room.timeLimitSeconds = settings.timeLimitSeconds;
    }

    if (settings.turnOrderMode !== undefined) {
      room.turnOrderMode = settings.turnOrderMode;
    }
  },

  setTurnOrderMode(roomId: string, mode: TurnOrderMode): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    room.turnOrderMode = mode;
    return true;
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

  findQuickJoinRoom(gameId?: string, isKicked?: (roomId: string) => boolean): Room | undefined {
    const candidates = Array.from(rooms.values()).filter(
      (r) =>
        r.status === 'waiting' &&
        r.roomType === 'public' &&
        r.playMode === 'multi' &&
        r.players.length < r.maxPlayers &&
        (!gameId || r.gameId === gameId) &&
        (!isKicked || !isKicked(r.id)),
    );
    // 인원이 가장 많은 방 우선 (빠른 매칭), 동점이면 먼저 만들어진 방
    return candidates.sort((a, b) =>
      b.players.length - a.players.length || a.createdAt - b.createdAt,
    )[0];
  },

  setGameId(roomId: string, gameId: string, gameName: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.gameId = gameId;
    room.gameName = gameName;
  },

  /** 밴픽 추첨 후 실게임으로 전환됐음을 표시 (히든 전략가 집계용). */
  markFromBanPick(roomId: string) {
    const room = rooms.get(roomId);
    if (room) room._fromBanPick = true;
  },

  /** 소비형 플래그: 첫 번째 조회 시 true 면 제거하고 true 반환 */
  consumeFromBanPick(roomId: string): boolean {
    const room = rooms.get(roomId);
    if (!room || !room._fromBanPick) return false;
    delete room._fromBanPick;
    return true;
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
