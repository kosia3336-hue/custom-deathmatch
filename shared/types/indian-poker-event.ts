/**
 * 인디언홀덤 (이벤트) — N인용 (2~5인) 공유 타입.
 * 기존 `indian-poker.ts` (2인 전용) 와 분리.
 */

import type { IPHand, IPActionType } from './indian-poker';

export const IPE_MAX_SEATS = 5;
export const IPE_MIN_PLAYERS = 2;
export const IPE_ANTE = 1;
export const IPE_TURN_TIME_LIMIT_SECONDS = 30;

/** 다이 패널티 (원본 룰 그대로) */
export const IPE_DIE_PENALTY: Record<IPHand, number> = {
  noPair: 0,
  double: 5,
  straight: 10,
  triple: 10,
};

export type IPEPhase = 'waiting' | 'dealing' | 'betting' | 'showdown' | 'dieResult' | 'closed';

export type IPEParticipantRole = 'player' | 'spectator' | 'queued';

export interface IPEPlayerInfo {
  seatIdx: number; // 0~4
  playerId: string; // = session token
  memberId: string;
  nickname: string;
  chips: number;
  roundBet: number;
  card: number | null;
  isAlive: boolean; // 핸드 진행 중 살아있는가
  hasDied: boolean; // 이번 핸드에서 다이했는가
  hasActedThisRound: boolean; // 텍사스 홀덤식 베팅 라운드 완료 판정용
}

export interface IPEHandResultEntry {
  seatIdx: number;
  playerId: string;
  nickname: string;
  card: number | null; // 다이한 사람은 null (블러프 보호)
  hand: IPHand | null;
  chipDelta: number; // 핸드 시작 대비 변동 (음수=손실)
  isWinner: boolean;
  isDie: boolean;
}

export interface IPEHandResult {
  handId: string;
  kind: 'showdown' | 'die-all' | 'last-standing';
  potBefore: number;
  potDistributed: number;
  carryover: number; // 다음 핸드로 이월
  communityCards: [number, number] | null;
  winnerIds: string[]; // 단일 또는 분할
  entries: IPEHandResultEntry[];
}

export interface IPEBettingActionRecord {
  seatIdx: number;
  playerId: string;
  action: IPActionType;
  amount?: number;
}

export interface IPEGameData {
  phase: IPEPhase;
  handNumber: number;
  /** 좌석 슬롯 (null 이면 빈자리) */
  seats: Array<IPEPlayerInfo | null>;
  pot: number;
  carryover: number;
  communityCards: [number, number] | null;
  currentTurnSeatIdx: number | null;
  firstActorSeatIdx: number | null;
  currentBet: number;
  bettingStarted: boolean;
  deckRemaining: number;
  /** 최근 핸드 결과 (showdown/die 단계에서 채워짐) */
  handResult: IPEHandResult | null;
  /** 이번 핸드 베팅 내역 (UI 표기용) */
  bettingActions: IPEBettingActionRecord[];
  /** 운영 시간 종료 시 true (UI 안내) */
  closedReason: 'operating-hours' | null;
  /** 현재 턴 시작 타임스탬프(ms). betting 단계에서만 세팅. UI 카운트다운 용. */
  turnStartedAt: number | null;
}

export interface IPEActionPayload {
  type: IPActionType;
  amount?: number;
}

export interface IPEMetaPayload {
  /** 활성 좌석 수 */
  activePlayers: number;
  /** 관전자 + 대기열 인원 */
  spectatorCount: number;
  /** 운영 시간 내 여부 */
  isOpen: boolean;
  /** waiting | playing | closed */
  status: 'waiting' | 'playing' | 'closed';
}

export interface IPEStatePayload {
  /** 본인의 역할 */
  role: IPEParticipantRole | null;
  /** 본인의 좌석 (player 일 때만) */
  mySeatIdx: number | null;
  /** 대기열에서의 본인 순번 (queued 일 때만, 1-base) */
  myQueuePosition: number | null;
  /** 게임 데이터 (없을 수도 — 단순 메타만 필요할 때) */
  gameData: IPEGameData;
  /** 본인 보유 칩 (UI 갱신용) */
  myChipBalance: number;
  /** 대기열 인원 수 */
  queueLength: number;
  /** 관전자 인원 수 */
  spectatorCount: number;
  /** 운영 시간 내 여부 */
  isOpen: boolean;
}

export interface IPEChipChangedPayload {
  newBalance: number;
  delta: number;
  reason: 'shop_purchase' | 'event_hand' | 'admin_adjust' | 'exchange_to_cdp';
}

export interface IPEPromotedPayload {
  seatIdx: number;
  message: string;
}

export interface IPEKickedPayload {
  reason: 'no_chips' | 'kicked_by_admin';
  message: string;
}

export interface IPEHandResultPayload {
  result: IPEHandResult;
}
