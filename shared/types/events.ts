import type { Player, Room, RoomSummary, RoomType, PlayMode } from './room';

export interface CreateRoomData {
  gameId: string;
  title: string;
  playMode: PlayMode;
  roomType: RoomType;
  password?: string;
  maxPlayers: number;
  timeLimitSeconds?: number | null;
}

export interface JoinRoomData {
  roomId: string;
  password?: string;
  inviteToken?: string;
}

export interface UpdateRoomSettings {
  title?: string;
  maxPlayers?: number;
}

export type ChatScope = 'lobby' | 'room' | 'game';

export interface ChatMessage {
  id: string;
  sender: string;
  senderNickname: string;
  message: string;
  scope: ChatScope;
  isSystem: boolean;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  message: string;
  currentTurn: string | null;
  turnNumber: number;
  startedAt: number;
  turnStartedAt: number | null;
  gameData?: unknown;
}

export interface GameResult {
  roomId: string;
  rankings: Array<{
    playerId: string;
    nickname: string;
    rank: number;
    score: number;
  }>;
  playTime: number;
  totalTurns: number;
  gameResultData?: unknown;
}

export interface NicknameResult {
  success: boolean;
  nickname?: string;
  error?: string;
}

export interface CreateRoomResult {
  success: boolean;
  roomId?: string;
  error?: string;
}

export type JoinRoomErrorCode =
  | 'GAME_IN_PROGRESS'
  | 'ROOM_FULL'
  | 'KICKED'
  | 'WRONG_PASSWORD'
  | 'NOT_FOUND'
  | 'ALREADY_IN_ROOM'
  | 'NO_NICKNAME'
  | 'INVALID_INVITE';

export interface JoinRoomResult {
  success: boolean;
  room?: Room;
  /** Present on successful `room:quickjoin` */
  roomId?: string;
  error?: string;
  errorCode?: JoinRoomErrorCode;
  /** 방이 가득 찼거나 게임 진행 중일 때 비번방 여부 */
  isPrivate?: boolean;
}

export interface ClientToServerEvents {
  'nickname:set': (
    data: { nickname: string },
    callback: (res: NicknameResult) => void,
  ) => void;

  'lobby:join': () => void;
  'lobby:leave': () => void;

  'room:create': (
    data: CreateRoomData,
    callback: (res: CreateRoomResult) => void,
  ) => void;
  'room:join': (
    data: JoinRoomData,
    callback: (res: JoinRoomResult) => void,
  ) => void;
  'room:quickjoin': (callback: (res: JoinRoomResult) => void) => void;
  'room:leave': () => void;
  'room:ready': () => void;
  'room:unready': () => void;
  'room:kick': (data: { targetId: string }) => void;
  'room:delegate': (data: { targetId: string }) => void;
  'room:start': () => void;
  'room:settings:update': (data: UpdateRoomSettings) => void;
  'room:swap:colors': () => void;
  'room:invite:create': (
    callback: (res: { success: boolean; token?: string }) => void,
  ) => void;

  'chat:send': (data: { message: string; scope: ChatScope }) => void;

  'game:action': (data: Record<string, unknown>) => void;
  'game:sync': () => void;
  'game:leave': () => void;
  'game:rematch': () => void;
  'game:end': () => void;

  'spectate:join': (
    data: { roomId: string; password?: string },
    callback: (res: JoinRoomResult) => void,
  ) => void;
  'spectate:leave': () => void;
  'room:to:spectate': (
    callback: (res: { success: boolean; error?: string }) => void,
  ) => void;
  'spectate:to:player': (
    callback: (res: { success: boolean; error?: string }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'lobby:rooms': (rooms: RoomSummary[]) => void;
  'lobby:room:created': (room: RoomSummary) => void;
  'lobby:room:updated': (room: RoomSummary) => void;
  'lobby:room:removed': (roomId: string) => void;

  'room:state': (room: Room) => void;
  'room:player:joined': (player: Player) => void;
  'room:player:left': (data: {
    playerId: string;
    nickname: string;
    newHostId?: string;
  }) => void;
  'room:player:ready': (data: { playerId: string }) => void;
  'room:player:unready': (data: { playerId: string }) => void;
  'room:player:kicked': (data: { playerId: string }) => void;
  'room:host:changed': (data: { newHostId: string }) => void;
  'room:countdown': (data: { count: number }) => void;
  'room:game:started': () => void;
  'room:settings:updated': (data: UpdateRoomSettings) => void;
  'room:disbanded': (data: { reason: string }) => void;

  'chat:message': (msg: ChatMessage) => void;

  'game:state': (state: GameState) => void;
  'game:ended': (result: GameResult) => void;

  error: (data: { message: string }) => void;
  kicked: (data: { reason: string }) => void;
  'connection:duplicate': () => void;
}
