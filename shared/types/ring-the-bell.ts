/**
 * 기간 한정 길드전 「링 더 벨」 소켓 페이로드.
 * 룸 ID `guild-war`. 게임 ID `game-029`.
 */

import type { RtbAction, RtbState } from '../guild-war/types';

export const GUILD_WAR_ROOM_ID = 'guild-war';
export const GUILD_WAR_ROOM_TITLE = '길드전';
export const GUILD_WAR_GAME_NAME = '링 더 벨';

export type RtbRole = 'player' | 'spectator' | 'queued';

/** 착석이 막힌 이유. 입장 시에는 길드·칩만, 빈칸 클릭 실패 때도 쓴다. */
export type RtbSeatBlock =
  | 'no_guild'
  | 'no_chips'
  | 'guild_full'
  | 'room_full'
  | 'in_progress'
  | null;

export interface RtbStatePayload {
  /** 내 참가자 id (= 세션 토큰). 관전이어도 채워진다. */
  meId: string;
  role: RtbRole;
  seatBlock: RtbSeatBlock;
  /** 남의 손패·덱 내용이 지워진 상태. */
  state: RtbState;
  /** 호환. FIFO 없음. 항상 null. */
  queuePosition: number | null;
  /** 호환. FIFO 없음. 항상 0. */
  queueLength: number;
  spectatorCount: number;
  /**
   * 이번 세트에 내가 쓸 수 있는 길드 공유 칩.
   * 세트 시작 스냅샷에서 같은 길드원 지출을 실시간으로 뺀 값이다 (§6.1–6.2).
   */
  myGuildChips: number;
  myGuildName: string | null;
  /** 지금 입장·세트 시작이 되는 시간인가. */
  isOpen: boolean;
  /** 이번 세트를 친 뒤 다음 세트 시작 직전에 관전으로 내린다. */
  spectateReserved: boolean;
}

export interface RtbMetaPayload {
  seated: number;
  spectatorCount: number;
  isOpen: boolean;
  /** 기간이 살아 있는가. false 면 로비에서 방이 사라진다. */
  isPeriod: boolean;
}

/** 강퇴 사유. 모두 로비로 보낸다 (§13.4). */
export type RtbKickedReason =
  | 'no_chips'
  | 'ante'
  | 'turn_timeout'
  | 'combo_timeout'
  | 'closed'
  | 'period_over';

export interface RtbKickedPayload {
  reason: RtbKickedReason;
  message: string;
}

export type RtbActionPayload = RtbAction;
