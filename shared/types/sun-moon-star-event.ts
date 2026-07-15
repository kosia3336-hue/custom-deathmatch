/**
 * 해달별 (이벤트) — 4~8인 공유 타입.
 * 해달별2(2인 랭크)와 분리. 불빛 = 2차 표 **최소**(동률 규칙).
 */

import type { DisplayedTitle } from './room';

export const SMSE_MAX_SEATS = 8;
export const SMSE_MIN_PLAYERS = 4;
export const SMSE_PICK_TIMEOUT_SECONDS = 60;
export const SMSE_REVEAL_STEP_MS = 800;
/** 판 종료 후 다음 판 시작 전 대기 (ms) */
export const SMSE_INTER_ROUND_WAIT_MS = 10_000;
/** 불빛 점등 연출 유지 (ms) */
export const SMSE_LIT_REVEAL_MS = 2_500;
/** 라운드 결과 오버레이 표시 (ms) */
export const SMSE_ROUND_RESULT_DISPLAY_MS = 2_800;

export const SMSE_MARK_IDS = ['sun', 'moon', 'star'] as const;
export type SmsMarkId = (typeof SMSE_MARK_IDS)[number];

export const SMSE_MARK_LABELS: Record<SmsMarkId, string> = {
  sun: '해',
  moon: '달',
  star: '별',
};

export const SMSE_MARK_ICONS: Record<SmsMarkId, string> = {
  sun: '',
  moon: '',
  star: '',
};

export type SmsPhase =
  | 'waiting'
  | 'pickFirst'
  | 'revealFirst'
  | 'resolveFirst'
  | 'pickSecond'
  | 'revealSecond'
  | 'resolve'
  | 'closed';

export type SmsLitReason = 'unique_min' | 'anti_tie' | 'triple_tie' | null;

export type SmsParticipantRole = 'player' | 'spectator' | 'queued';

export interface SmsLitDecision {
  kind: 'lit';
  mark: SmsMarkId;
  reason: 'unique_min' | 'anti_tie';
}

export interface SmsVoidDecision {
  kind: 'void';
  reason: 'triple_tie';
}

export type SmsLitResult = SmsLitDecision | SmsVoidDecision;

/** 판 점수: 바꿔서 적중 시 3, 유지 적중 1, 바꿨는데 불 미일치 시 -1 */
export type SmsRoundScore = -1 | 0 | 1 | 3;

export interface SmsSeatPublic {
  seatIdx: number;
  playerId: string;
  nickname: string;
  displayedTitle?: DisplayedTitle | null;
  firstPick: SmsMarkId | null;
  secondPick: SmsMarkId | null;
  hasSubmittedFirst: boolean;
  hasSubmittedSecond: boolean;
  roundScore: SmsRoundScore | null;
  /** 판 진행 중 퇴장 — 선택은 판 끝까지 유지 */
  departed?: boolean;
}

export interface SmsGameData {
  phase: SmsPhase;
  roundNumber: number;
  seats: Array<SmsSeatPublic | null>;
  revealIndex: number;
  /** 순차 공개 중 현재 공개 좌석 (없으면 null) */
  revealSeatIdx: number | null;
  revealPhase: 'first' | 'second' | null;
  /** 1차 집계 (resolveFirst — 표 수만, 불빛·점수 없음) */
  firstCounts: { sun: number; moon: number; star: number } | null;
  /** @deprecated 항상 null — 1차에는 불빛 판정 없음 */
  firstLitMark: SmsMarkId | null;
  /** @deprecated 항상 false */
  firstVoidRound: boolean;
  /** @deprecated 항상 null */
  firstLitReason: SmsLitReason;
  litMark: SmsMarkId | null;
  litReason: SmsLitReason;
  voidRound: boolean;
  pickDeadlineAt: number | null;
  /** waiting 페이즈·4인 이상일 때 다음 판 시작 시각 (ms) */
  nextRoundStartsAt: number | null;
  closedReason: 'operating-hours' | 'season-ended' | null;
  message: string | null;
  secondCounts: { sun: number; moon: number; star: number } | null;
}

export interface SmsStatePayload {
  role: SmsParticipantRole | null;
  mySeatIdx: number | null;
  myQueuePosition: number | null;
  queueLength: number;
  spectatorCount: number;
  isOpen: boolean;
  gameData: SmsGameData;
}

export interface SmsMetaPayload {
  activePlayers: number;
  spectatorCount: number;
  isOpen: boolean;
  status: 'waiting' | 'playing' | 'closed';
}

export interface SmsRoundScorer {
  seatIdx: number;
  nickname: string;
  roundScore: SmsRoundScore;
  firstPick: SmsMarkId;
  secondPick: SmsMarkId;
}

export interface SmsRoundResultPayload {
  roundNumber: number;
  litMark: SmsMarkId | null;
  void: boolean;
  counts: { sun: number; moon: number; star: number };
  scorers: SmsRoundScorer[];
}

export interface SmsPromotedPayload {
  seatIdx: number;
  message: string;
}

export interface SmsKickedPayload {
  reason: 'timeout';
  message: string;
}

export interface SmsPickAction {
  type: 'pick';
  mark: SmsMarkId;
}

export function tallyMarks(picks: Array<SmsMarkId | null>): Record<SmsMarkId, number> {
  const counts: Record<SmsMarkId, number> = { sun: 0, moon: 0, star: 0 };
  for (const p of picks) {
    if (p) counts[p] += 1;
  }
  return counts;
}

export function decideLitMarkSmsEvent(counts: Record<SmsMarkId, number>): SmsLitResult {
  const min = Math.min(counts.sun, counts.moon, counts.star);
  const tied = SMSE_MARK_IDS.filter((m) => counts[m] === min);
  if (tied.length === 3) return { kind: 'void', reason: 'triple_tie' };
  if (tied.length === 1) return { kind: 'lit', mark: tied[0], reason: 'unique_min' };
  const notTied = SMSE_MARK_IDS.find((m) => !tied.includes(m))!;
  return { kind: 'lit', mark: notTied, reason: 'anti_tie' };
}

export function scoreSeatRound(
  firstPick: SmsMarkId | null,
  secondPick: SmsMarkId | null,
  lit: SmsLitResult,
): SmsRoundScore {
  if (lit.kind === 'void' || !firstPick || !secondPick) return 0;
  if (secondPick === lit.mark) {
    return firstPick !== secondPick ? 3 : 1;
  }
  if (firstPick !== secondPick) return -1;
  return 0;
}

export function randomMark(): SmsMarkId {
  const i = Math.floor(Math.random() * 3);
  return SMSE_MARK_IDS[i]!;
}
