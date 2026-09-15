import { v4 as uuid } from 'uuid';
import { AI_PLAYER_ID, isSoloLikePlayMode } from '@shared/types/room.js';
import { isDummyPlayerId } from '@shared/dummy.js';
import type {
  Room,
  RoomSummary,
  Player,
  PlayMode,
  RoomType,
  RoomStatus,
  TurnOrderMode,
} from '@shared/types/room.js';
import { isTokenAnonymized } from '../shop/roomShopState.js';

function isNonHumanSeat(p: Player): boolean {
  return p.id === AI_PLAYER_ID || isDummyPlayerId(p.id);
}

function makeAiPlayer(): Player {
  return {
    id: AI_PLAYER_ID,
    nickname: AI_PLAYER_ID,
    isHost: false,
    isReady: true,
    joinedAt: Date.now(),
  };
}

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
    hostNickname: room.isRanked
      ? ''
      : host
        ? (isTokenAnonymized(room.id, host.id) ? '???' : host.nickname)
        : '',
    timeLimitSeconds: room.timeLimitSeconds,
    gameOptions: room.gameOptions,
    createdAt: room.createdAt,
    ...(room.isRanked ? { isRanked: true } : {}),
    ...(room.hiddenMatch ? { hiddenMatch: true } : {}),
    // 로비 제목 '???[티어] VS ???[티어]' — 이름은 싣지 않고, 익명 물약을 쓴 자리의 티어는 가린다
    ...(room.isRanked
      ? {
          rankTiers: room.players.map((p) =>
            isTokenAnonymized(room.id, p.id) ? null : (p.rankTier ?? null),
          ),
        }
      : {}),
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
    hiddenMatch?: boolean;
  }): Room {
    let id: string;
    do {
      id = uuid().slice(0, 8);
    } while (rooms.has(id));
    const room: RoomInternal = {
      id,
      title: opts.title,
      gameId: opts.gameId,
      gameName: opts.gameName,
      playMode: opts.playMode,
      roomType: opts.roomType,
      maxPlayers: opts.playMode === 'multi' ? opts.maxPlayers : opts.playMode === 'com' ? 2 : 1,
      players: opts.playMode === 'com' ? [opts.host, makeAiPlayer()] : [opts.host],
      spectators: [],
      status: isSoloLikePlayMode(opts.playMode) ? 'playing' : 'waiting',
      hostId: opts.host.id,
      inviteToken: null,
      timeLimitSeconds: opts.timeLimitSeconds ?? null,
      gameOptions: opts.gameOptions ?? {},
      turnOrderMode: opts.turnOrderMode ?? 'random',
      createdAt: Date.now(),
      /*
        솔로·튜토리얼은 혼자 하는 모드다. 게임 정의상 최소 인원(대개 2)을 그대로
        들고 있으면 canStart 가 '최소 2명이 필요합니다' 로 막는다.
        changePlayMode 는 이미 이 규칙을 쓰는데 생성 경로에만 빠져 있었다.
      */
      _minPlayers: isSoloLikePlayMode(opts.playMode) ? 1 : opts.minPlayers,
      ...(opts.isRanked === true ? { isRanked: true as const } : {}),
      ...(opts.rankSeasonId != null ? { rankSeasonId: opts.rankSeasonId } : {}),
      ...(opts.spectatorAllowed === true ? { spectatorAllowed: true as const } : {}),
      ...(opts.hiddenMatch === true ? { hiddenMatch: true as const } : {}),
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

  /**
   * 이 회원이 '선수로' 들어가 있는 방. 없으면 undefined.
   *
   * 소켓이 아니라 회원 기준이다 — 재접속 직후엔 새 소켓에 방이 아직 연결되지
   * 않아 소켓으로 보면 비어 있는 것처럼 보이고, 다른 기기로 접속하면 토큰이
   * 달라 소켓도 별개다. 관전자(room.spectators)는 선수가 아니므로 제외한다.
   */
  findByMemberId(memberId: string): Room | undefined {
    for (const r of rooms.values()) {
      if (r.players.some((p) => p.memberId === memberId)) return r;
    }
    return undefined;
  },

  getAllSummaries(): RoomSummary[] {
    // 시스템 룸(hostId === '')은 로비에 노출하지 않는다.
    return Array.from(rooms.values())
      .filter((r) => r.hostId !== '')
      .filter((r) => !r.players.some((p) => isDummyPlayerId(p.id)))
      .map(toSummary);
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

  removePlayer(
    roomId: string,
    playerId: string,
  ): { removed: boolean; newHostId?: string; destroyed: boolean } {
    const room = rooms.get(roomId);
    if (!room) return { removed: false, destroyed: false };

    room.players = room.players.filter((p) => p.id !== playerId);
    room.spectators = room.spectators.filter((p) => p.id !== playerId);

    if (room.players.length === 0 || room.players.every(isNonHumanSeat)) {
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
      return {
        ok: false,
        reason: `최소 ${minPlayers}명이 필요합니다 (현재 ${room.players.length}명)`,
      };
    }

    const nonHostNotReady = room.players.filter(
      (p) => p.id !== room.hostId && p.id !== AI_PLAYER_ID && !p.isReady,
    );
    if (nonHostNotReady.length > 0) {
      return {
        ok: false,
        reason: `모든 참여자가 준비해야 합니다 (${nonHostNotReady.length}명 대기 중)`,
      };
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
      if (settings.minPlayers !== undefined) {
        // 솔로 방에서 게임만 바꾼 경우, 새 게임의 최소 인원(2)이 덮어써서는 안 된다.
        room._minPlayers = isSoloLikePlayMode(room.playMode) ? 1 : settings.minPlayers;
      }
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

  changePlayMode(
    roomId: string,
    playMode: PlayMode,
    opts: { minPlayers: number; maxPlayers: number },
  ): { movedPlayers: Player[]; aiJoined: boolean; aiLeft: boolean } | null {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'waiting') return null;

    const previousHadAi = room.players.some((p) => p.id === AI_PLAYER_ID);
    const humanPlayers = room.players.filter((p) => p.id !== AI_PLAYER_ID);
    const host = humanPlayers.find((p) => p.id === room.hostId);
    if (!host) return null;

    const targetMaxPlayers = playMode === 'multi' ? opts.maxPlayers : playMode === 'com' ? 2 : 1;
    const allowedHumans = playMode === 'multi' ? targetMaxPlayers : 1;
    const orderedHumans = [host, ...humanPlayers.filter((p) => p.id !== room.hostId)];
    const keptHumans = orderedHumans.slice(0, allowedHumans);
    const movedPlayers = orderedHumans.slice(allowedHumans);

    for (const player of movedPlayers) {
      player.isHost = false;
      player.isReady = false;
      if (!room.spectators.some((spectator) => spectator.id === player.id)) {
        room.spectators.push(player);
      }
    }

    for (const player of keptHumans) {
      player.isReady = false;
    }

    room.players = playMode === 'com' ? [...keptHumans, makeAiPlayer()] : keptHumans;
    room.playMode = playMode;
    room.maxPlayers = targetMaxPlayers;
    room._minPlayers = isSoloLikePlayMode(playMode) ? 1 : opts.minPlayers;
    room.turnOrderMode = 'random';
    if (playMode !== 'multi') room.timeLimitSeconds = null;

    return {
      movedPlayers,
      aiJoined: playMode === 'com' && !previousHadAi,
      aiLeft: playMode !== 'com' && previousHadAi,
    };
  },

  /** 설정 변경 후 기존 동의가 유효하지 않으므로 모든 사람 참가자의 준비를 해제한다. */
  resetHumanReadiness(roomId: string): string[] {
    const room = rooms.get(roomId);
    if (!room) return [];
    const resetPlayerIds: string[] = [];
    for (const player of room.players) {
      if (isNonHumanSeat(player) || !player.isReady) continue;
      player.isReady = false;
      resetPlayerIds.push(player.id);
    }
    return resetPlayerIds;
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
    return candidates.sort(
      (a, b) => b.players.length - a.players.length || a.createdAt - b.createdAt,
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

  /* ──────────────────────────────────────────────────────────────────
   * 시스템 영구 룸 헬퍼 (인디언홀덤 이벤트 전용)
   *
   * 일반 방과 달리:
   * - 호스트가 없다 (hostId = ''). 호스트 위임/방장 강퇴 흐름은 타지 않는다.
   * - 항상 status='playing' 으로 유지된다. (대기실 진입 X, 곧장 /play 로 이동)
   * - addPlayer/removePlayer 의 'waiting' 가드와 빈 방 자동 삭제 로직을 우회한다.
   * ──────────────────────────────────────────────────────────────── */

  /** 시스템 룸 생성. 이미 존재하면 그대로 반환. */
  createSystemRoom(opts: {
    id: string;
    title: string;
    gameId: string;
    gameName: string;
    maxPlayers: number;
    spectatorAllowed?: boolean;
  }): Room {
    const existing = rooms.get(opts.id);
    if (existing) return existing;

    const room: RoomInternal = {
      id: opts.id,
      title: opts.title,
      gameId: opts.gameId,
      gameName: opts.gameName,
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: opts.maxPlayers,
      players: [],
      spectators: [],
      status: 'playing',
      hostId: '',
      inviteToken: null,
      timeLimitSeconds: null,
      gameOptions: {},
      turnOrderMode: 'random',
      createdAt: Date.now(),
      _minPlayers: 0,
      ...(opts.spectatorAllowed === true ? { spectatorAllowed: true as const } : {}),
    };
    rooms.set(opts.id, room);
    return room;
  },

  /** 시스템 룸에 좌석 추가 (status/min 가드 우회). 이미 있으면 false. */
  systemRoomAddPlayer(roomId: string, player: Player): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    if (room.players.some((p) => p.id === player.id)) return false;
    if (room.players.length >= room.maxPlayers) return false;
    room.players.push(player);
    return true;
  },

  /** 시스템 룸에서 좌석 제거. 빈 방이어도 절대 삭제하지 않음. */
  systemRoomRemovePlayer(roomId: string, playerId: string): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    const before = room.players.length;
    room.players = room.players.filter((p) => p.id !== playerId);
    return room.players.length !== before;
  },

  /** 시스템 룸에 관전자 추가. 이미 있으면 false. */
  systemRoomAddSpectator(roomId: string, spectator: Player): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    if (room.spectators.some((p) => p.id === spectator.id)) return false;
    room.spectators.push(spectator);
    return true;
  },

  /** 시스템 룸에서 관전자 제거. */
  systemRoomRemoveSpectator(roomId: string, spectatorId: string): boolean {
    const room = rooms.get(roomId);
    if (!room) return false;
    const before = room.spectators.length;
    room.spectators = room.spectators.filter((p) => p.id !== spectatorId);
    return room.spectators.length !== before;
  },

  /** 시스템 룸 여부 (hostId 가 빈 문자열이면 시스템 룸). */
  isSystemRoom(roomId: string): boolean {
    const room = rooms.get(roomId);
    return !!room && room.hostId === '';
  },

  toSummary,
};
