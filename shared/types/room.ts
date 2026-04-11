export const AI_PLAYER_ID = 'AI' as const;

export type PlayMode = 'multi' | 'com' | 'solo';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoomType = 'public' | 'private';

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  title: string;
  gameId: string;
  gameName: string;
  playMode: PlayMode;
  roomType: RoomType;
  maxPlayers: number;
  players: Player[];
  spectators: Player[];
  status: RoomStatus;
  hostId: string;
  inviteToken: string | null;
  timeLimitSeconds: number | null;
  /** 게임별 커스텀 옵션 (e.g. { initialChips: 25 }) */
  gameOptions: Record<string, unknown>;
  createdAt: number;
}

export interface RoomSummary {
  id: string;
  title: string;
  gameId: string;
  gameName: string;
  playMode: PlayMode;
  roomType: RoomType;
  maxPlayers: number;
  currentPlayers: number;
  spectatorCount: number;
  status: RoomStatus;
  hostNickname: string;
  timeLimitSeconds: number | null;
  /** 게임별 커스텀 옵션 (e.g. { initialChips: 25 }) */
  gameOptions: Record<string, unknown>;
  createdAt: number;
}
