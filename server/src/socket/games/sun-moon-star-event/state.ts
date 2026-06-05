/**
 * 해달별 (이벤트) — 판 상태 머신 (순수 로직 + 내부 상태).
 */

import { randomUUID } from 'node:crypto';
import type {
  SmsGameData,
  SmsLitResult,
  SmsMarkId,
  SmsPhase,
  SmsRoundResultPayload,
  SmsSeatPublic,
} from '@shared/types/sun-moon-star-event.js';
import {
  SMSE_MARK_IDS,
  SMSE_MAX_SEATS,
  SMSE_MIN_PLAYERS,
  SMSE_PICK_TIMEOUT_SECONDS,
  decideLitMarkSmsEvent,
  randomMark,
  scoreSeatRound,
  tallyMarks,
  type SmsRoundScore,
} from '@shared/types/sun-moon-star-event.js';
import { sessions } from '../../../store/sessions.js';

export const PICK_TIMEOUT_MS = SMSE_PICK_TIMEOUT_SECONDS * 1000;

export interface InternalSeat {
  playerId: string;
  memberId: string;
  nickname: string;
  firstPick: SmsMarkId | null;
  secondPick: SmsMarkId | null;
  autoPickFirst: boolean;
  autoPickSecond: boolean;
}

/** 판 진행 중 퇴장한 플레이어 — 선택은 판 끝까지 유지 */
export interface RoundGhost {
  seatIdx: number;
  memberId: string;
  nickname: string;
  firstPick: SmsMarkId | null;
  secondPick: SmsMarkId | null;
}

export interface InternalState {
  seats: Array<InternalSeat | null>;
  roundGhosts: RoundGhost[];
  phase: SmsPhase;
  roundNumber: number;
  roundId: string | null;
  revealOrder: number[];
  revealIndex: number;
  litResult: SmsLitResult | null;
  roundScores: Map<number, SmsRoundScore>;
  roundResult: SmsRoundResultPayload | null;
  closedReason: 'operating-hours' | 'season-ended' | null;
  pickDeadlineAt: number | null;
  nextRoundStartsAt: number | null;
  firstCounts: { sun: number; moon: number; star: number } | null;
  secondCounts: { sun: number; moon: number; star: number } | null;
}

export function createInitialState(): InternalState {
  return {
    seats: new Array<InternalSeat | null>(SMSE_MAX_SEATS).fill(null),
    roundGhosts: [],
    phase: 'waiting',
    roundNumber: 0,
    roundId: null,
    revealOrder: [],
    revealIndex: 0,
    litResult: null,
    roundScores: new Map(),
    roundResult: null,
    closedReason: null,
    pickDeadlineAt: null,
    nextRoundStartsAt: null,
    firstCounts: null,
    secondCounts: null,
  };
}

export function findEmptySeatIdx(s: InternalState): number {
  return s.seats.findIndex((x) => x === null);
}

export function findSeatIdxByPlayer(s: InternalState, playerId: string): number {
  return s.seats.findIndex((x) => x?.playerId === playerId);
}

export function activeSeatIndices(s: InternalState): number[] {
  const out: number[] = [];
  for (let i = 0; i < SMSE_MAX_SEATS; i++) {
    if (s.seats[i]) out.push(i);
  }
  return out;
}

function ghostAt(s: InternalState, seatIdx: number): RoundGhost | undefined {
  return s.roundGhosts.find((g) => g.seatIdx === seatIdx);
}

/** 판 정산·공개에 참여하는 좌석 인덱스 (좌석 + 중도 이탈 고스트) */
function roundParticipantIndices(s: InternalState): number[] {
  const set = new Set<number>();
  for (const i of activeSeatIndices(s)) set.add(i);
  for (const g of s.roundGhosts) set.add(g.seatIdx);
  return [...set].sort((a, b) => a - b);
}

function picksAt(s: InternalState, idx: number): {
  firstPick: SmsMarkId | null;
  secondPick: SmsMarkId | null;
  nickname: string;
  memberId: string;
} | null {
  const seat = s.seats[idx];
  if (seat) {
    return {
      firstPick: seat.firstPick,
      secondPick: seat.secondPick,
      nickname: seat.nickname,
      memberId: seat.memberId,
    };
  }
  const ghost = ghostAt(s, idx);
  if (!ghost) return null;
  return {
    firstPick: ghost.firstPick,
    secondPick: ghost.secondPick,
    nickname: ghost.nickname,
    memberId: ghost.memberId,
  };
}

export function addSeat(
  s: InternalState,
  seatIdx: number,
  playerId: string,
  memberId: string,
  nickname: string,
): void {
  s.seats[seatIdx] = {
    playerId,
    memberId,
    nickname,
    firstPick: null,
    secondPick: null,
    autoPickFirst: false,
    autoPickSecond: false,
  };
}

export function removeSeat(s: InternalState, seatIdx: number): void {
  s.seats[seatIdx] = null;
}

/** 판 진행 중 퇴장 — 선택 스냅샷을 고스트로 보존 후 좌석 해제 */
export function detachPlayerMidRound(s: InternalState, seatIdx: number): void {
  const seat = s.seats[seatIdx];
  if (!seat) return;
  s.roundGhosts.push({
    seatIdx,
    memberId: seat.memberId,
    nickname: seat.nickname,
    firstPick: seat.firstPick,
    secondPick: seat.secondPick,
  });
  removeSeat(s, seatIdx);
}

function shuffleOrder(indices: number[], seed: number): number[] {
  const arr = [...indices];
  let x = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const j = x % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function startNewRound(s: InternalState): { started: boolean } {
  const active = activeSeatIndices(s);
  if (active.length < SMSE_MIN_PLAYERS) return { started: false };

  s.roundGhosts = [];
  s.roundNumber += 1;
  s.roundId = randomUUID();
  s.litResult = null;
  s.roundScores = new Map();
  s.roundResult = null;
  s.firstCounts = null;
  s.secondCounts = null;
  s.revealIndex = 0;
  s.revealOrder = shuffleOrder(active, s.roundNumber);

  for (const idx of active) {
    const seat = s.seats[idx]!;
    seat.firstPick = null;
    seat.secondPick = null;
    seat.autoPickFirst = false;
    seat.autoPickSecond = false;
  }

  s.phase = 'pickFirst';
  s.pickDeadlineAt = Date.now() + PICK_TIMEOUT_MS;
  s.nextRoundStartsAt = null;
  return { started: true };
}

export function pickPhase(s: InternalState): 'first' | 'second' | null {
  if (s.phase === 'pickFirst') return 'first';
  if (s.phase === 'pickSecond') return 'second';
  return null;
}

export function allPicksSubmitted(s: InternalState, which: 'first' | 'second'): boolean {
  for (const idx of activeSeatIndices(s)) {
    const seat = s.seats[idx]!;
    if (which === 'first' ? seat.firstPick === null : seat.secondPick === null) return false;
  }
  return activeSeatIndices(s).length > 0;
}

export function submitPick(
  s: InternalState,
  playerId: string,
  mark: SmsMarkId,
): { ok: boolean; error?: string; advanced?: boolean } {
  const which = pickPhase(s);
  if (!which) return { ok: false, error: '지금은 선택할 수 없습니다.' };

  const seatIdx = findSeatIdxByPlayer(s, playerId);
  if (seatIdx < 0) return { ok: false, error: '좌석에 없습니다.' };

  const seat = s.seats[seatIdx]!;
  if (which === 'first') {
    if (seat.firstPick !== null) return { ok: false, error: '이미 선택했습니다.' };
    seat.firstPick = mark;
  } else {
    if (seat.secondPick !== null) return { ok: false, error: '이미 선택했습니다.' };
    seat.secondPick = mark;
  }

  const advanced = allPicksSubmitted(s, which);
  return { ok: true, advanced };
}

/** 타임아웃 — 좌석에 남아 있는 플레이어만 랜덤. 이탈 고스트는 무선택 유지 */
export function autoPickMissing(s: InternalState, which: 'first' | 'second'): void {
  for (const idx of activeSeatIndices(s)) {
    const seat = s.seats[idx]!;
    if (which === 'first' && seat.firstPick === null) {
      seat.firstPick = randomMark();
      seat.autoPickFirst = true;
    }
    if (which === 'second' && seat.secondPick === null) {
      seat.secondPick = randomMark();
      seat.autoPickSecond = true;
    }
  }
}

export function beginReveal(s: InternalState, which: 'first' | 'second'): void {
  s.revealIndex = 0;
  s.pickDeadlineAt = null;
  s.phase = which === 'first' ? 'revealFirst' : 'revealSecond';
}

export function advanceReveal(s: InternalState): { done: boolean } {
  if (s.revealOrder.length === 0) return { done: true };

  if (s.revealIndex < s.revealOrder.length - 1) {
    s.revealIndex += 1;
    return { done: false };
  }
  return { done: true };
}

export function afterRevealDone(s: InternalState): void {
  if (s.phase === 'revealFirst') {
    computeFirstResolve(s);
    s.phase = 'resolveFirst';
    s.pickDeadlineAt = null;
    return;
  }
  if (s.phase === 'revealSecond') {
    computeResolve(s);
    s.phase = 'resolve';
    s.pickDeadlineAt = null;
  }
}

/** 1차 집계 — 표 수만 (불빛·점수 없음, 2차와 동일 규칙의 lit 판정 금지) */
function computeFirstResolve(s: InternalState): void {
  const participants = roundParticipantIndices(s);
  const firstPicks = participants.map((idx) => picksAt(s, idx)?.firstPick ?? null);
  s.firstCounts = tallyMarks(firstPicks);
}

function computeResolve(s: InternalState): void {
  const participants = roundParticipantIndices(s);
  const secondPicks = participants.map((idx) => picksAt(s, idx)?.secondPick ?? null);
  const counts = tallyMarks(secondPicks);
  s.secondCounts = counts;
  const lit = decideLitMarkSmsEvent(counts);
  s.litResult = lit;

  const scorers: SmsRoundResultPayload['scorers'] = [];
  for (const idx of participants) {
    const p = picksAt(s, idx);
    if (!p) continue;
    const score = scoreSeatRound(p.firstPick, p.secondPick, lit);
    s.roundScores.set(idx, score);
    scorers.push({
      seatIdx: idx,
      nickname: p.nickname,
      roundScore: score,
      firstPick: p.firstPick ?? 'sun',
      secondPick: p.secondPick ?? 'sun',
    });
  }

  s.roundResult = {
    roundNumber: s.roundNumber,
    litMark: lit.kind === 'lit' ? lit.mark : null,
    void: lit.kind === 'void',
    counts,
    scorers,
  };
}

export function isInActiveRound(s: InternalState): boolean {
  return s.phase !== 'waiting' && s.phase !== 'closed';
}

function seatPublic(
  s: InternalState,
  idx: number,
  revealWhich: 'first' | 'second' | null,
): SmsSeatPublic | null {
  const seat = s.seats[idx];
  const ghost = ghostAt(s, idx);
  if (!seat && !ghost) return null;

  const firstPick = seat?.firstPick ?? ghost?.firstPick ?? null;
  const secondPick = seat?.secondPick ?? ghost?.secondPick ?? null;
  const nickname = seat?.nickname ?? ghost!.nickname;
  const playerId = seat?.playerId ?? '';
  const departed = !seat && !!ghost;

  const revealFirst =
    s.phase === 'revealFirst' ||
    s.phase === 'resolveFirst' ||
    s.phase === 'pickSecond' ||
    s.phase === 'revealSecond' ||
    s.phase === 'resolve';
  const revealSecond = s.phase === 'revealSecond' || s.phase === 'resolve';

  let showFirst = revealFirst;
  let showSecond = revealSecond;

  if (s.phase === 'revealFirst' && revealWhich === 'first') {
    const orderPos = s.revealOrder.indexOf(idx);
    showFirst = orderPos >= 0 && orderPos <= s.revealIndex;
  }
  if (s.phase === 'revealSecond' && revealWhich === 'second') {
    const orderPos = s.revealOrder.indexOf(idx);
    showSecond = orderPos >= 0 && orderPos <= s.revealIndex;
  }

  return {
    seatIdx: idx,
    playerId,
    nickname,
    displayedTitle: seat ? sessions.getDisplayedTitle(seat.playerId) : null,
    firstPick: showFirst ? firstPick : null,
    secondPick: showSecond ? secondPick : null,
    hasSubmittedFirst: firstPick !== null,
    hasSubmittedSecond: secondPick !== null,
    roundScore: s.phase === 'resolve' ? (s.roundScores.get(idx) ?? 0) : null,
    departed,
  };
}

export function buildGameData(s: InternalState): SmsGameData {
  const revealPhase =
    s.phase === 'revealFirst' ? 'first' : s.phase === 'revealSecond' ? 'second' : null;
  const revealSeatIdx =
    revealPhase && s.revealOrder[s.revealIndex] != null ? s.revealOrder[s.revealIndex]! : null;

  const seated = activeSeatIndices(s).length;
  const lit = s.litResult;
  let message: string | null = null;
  switch (s.phase) {
    case 'waiting':
      if (seated < SMSE_MIN_PLAYERS) {
        message = '최소 4명이 필요합니다';
      } else if (s.nextRoundStartsAt != null) {
        message = null;
      } else {
        message = '다음 판을 준비하고 있습니다';
      }
      break;
    case 'pickFirst':
      message = '1차 선택 — 해·달·별 중 하나 (점수 없음)';
      break;
    case 'revealFirst':
      message = '1차 선택 공개 중';
      break;
    case 'resolveFirst':
      message = '1차 선택 집계 — 표 수 확인 (불빛·점수 없음)';
      break;
    case 'pickSecond':
      message = '2차 선택 — 불빛에 맞춰 점수 획득';
      break;
    case 'revealSecond':
      message = '2차 선택 공개 중';
      break;
    case 'resolve':
      if (lit?.kind === 'void') {
        message = '세 곳 동률 — 이번 판 무효';
      } else if (lit?.kind === 'lit') {
        message = '✨ 불빛이 켜집니다…';
      } else {
        message = '✨ 불빛 판정 중';
      }
      break;
    case 'closed':
      message = '이벤트가 종료되었습니다';
      break;
  }

  const seatSlots: Array<SmsSeatPublic | null> = new Array(SMSE_MAX_SEATS).fill(null);
  for (const idx of roundParticipantIndices(s)) {
    seatSlots[idx] = seatPublic(s, idx, revealPhase);
  }
  for (const idx of activeSeatIndices(s)) {
    if (!seatSlots[idx]) seatSlots[idx] = seatPublic(s, idx, revealPhase);
  }

  return {
    phase: s.phase,
    roundNumber: s.roundNumber,
    seats: seatSlots,
    revealIndex: s.revealIndex,
    revealSeatIdx,
    revealPhase,
    firstCounts: s.phase === 'resolveFirst' ? s.firstCounts : null,
    firstLitMark: null,
    firstVoidRound: false,
    firstLitReason: null,
    litMark: lit?.kind === 'lit' ? lit.mark : null,
    litReason: lit?.kind === 'lit' ? lit.reason : lit?.kind === 'void' ? 'triple_tie' : null,
    voidRound: lit?.kind === 'void',
    pickDeadlineAt: s.pickDeadlineAt,
    nextRoundStartsAt:
      s.phase === 'waiting' && seated >= SMSE_MIN_PLAYERS ? s.nextRoundStartsAt : null,
    closedReason: s.closedReason,
    message,
    secondCounts: s.secondCounts,
  };
}
