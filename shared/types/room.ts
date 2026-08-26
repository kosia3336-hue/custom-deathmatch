import type { EquippedSkin } from './skin';

export const AI_PLAYER_ID = 'AI' as const;

export const PLAY_MODES = ['multi', 'com', 'solo', 'tutorial'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  multi: '멀티',
  com: 'COM',
  solo: '1:1 솔로',
  tutorial: '튜토리얼',
};

/** 1인·즉시 시작. 대기실·비밀번호·시간제한 없음. */
export function isSoloLikePlayMode(mode: PlayMode): boolean {
  return mode === 'solo' || mode === 'tutorial';
}

export function isPlayMode(value: unknown): value is PlayMode {
  return typeof value === 'string' && (PLAY_MODES as readonly string[]).includes(value);
}

export function gameSupportsPlayMode(
  game: {
    supportsMulti: boolean;
    supportsCom: boolean;
    supportsSolo: boolean;
    supportsTutorial: boolean;
  },
  playMode: PlayMode,
): boolean {
  switch (playMode) {
    case 'multi':
      return game.supportsMulti;
    case 'com':
      return game.supportsCom;
    case 'solo':
      return game.supportsSolo;
    case 'tutorial':
      return game.supportsTutorial;
  }
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoomType = 'public' | 'private' | 'rank';

/** v2 — 회원의 표시 칭호 스냅샷 */
export interface DisplayedTitle {
  id: string;
  name: string;
  color: string; // title_color enum 값. 클라이언트 TitleColor 타입과 동일
  effect?: string | null;
}

/** 길드 마크 스냅샷 — 닉네임 옆에 칭호처럼 표시 */
export interface GuildMark {
  url: string;
  name: string;
}

/** v2 — 선공/후공 (모든 2인 게임 통일) */
export type TurnPosition = 'first' | 'second';

/** 게임 시작 시 선후공 결정 방식 */
export type TurnOrderMode = 'fixed' | 'random';

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
  /** v2 — 표시 칭호 (보유자만) */
  displayedTitle?: DisplayedTitle | null;
  /** v2 — 회원 ID (Supabase auth.users.id). AI 는 null */
  memberId?: string | null;
  /**
   * v2 — 대기실 슬롯의 선/후공 자리.
   * 게임 모듈 정책 + 방장 토글로 결정. 게임 시작 후 확정.
   */
  turnPosition?: TurnPosition | null;
  /** v3 — 이 플레이어가 착용 중인 게임 스킨 목록 (보유·착용자만) */
  equippedSkins?: EquippedSkin[];
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
  /** 선후공 결정 방식. fixed = 슬롯 순서 고정, random = 게임 시작 시 코인플립 */
  turnOrderMode: TurnOrderMode;
  createdAt: number;
  /** 랭크 매치 여부 (RP·히스토리 반영) */
  isRanked?: boolean;
  rankSeasonId?: number;
  /** 랭크 방은 항상 관전 허용 */
  spectatorAllowed?: boolean;
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
  isRanked?: boolean;
}
