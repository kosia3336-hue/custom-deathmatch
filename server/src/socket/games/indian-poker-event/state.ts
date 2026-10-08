/**
 * 인디언홀덤 (이벤트) — N인용 게임 상태 머신.
 *
 * 책임:
 * - 핸드 (1판) 생애주기: dealing → betting → showdown/dieResult
 * - 베팅 라운드: 텍사스 홀덤식 (raise 발생 시 다른 활성 플레이어 모두 재행동)
 * - 다이 / 콜 / 체크 / 레이즈 처리
 * - 핸드 종료 시 칩 정산 (winner-takes-all / 무승부 분할 / 이월)
 *
 * eventRoom.ts 가 본 엔진을 보유하고, 외부에는 broadcastState/handleAction 만 노출.
 */

import { randomUUID } from 'node:crypto';
import type { IPHand, IPActionType } from '@shared/types/indian-poker.js';
import type {
  IPEGameData,
  IPEPhase,
  IPEPlayerInfo,
  IPEHandResult,
  IPEHandResultEntry,
  IPEBettingActionRecord,
} from '@shared/types/indian-poker-event.js';
import {
  IPE_MAX_SEATS,
  IPE_MIN_PLAYERS,
  IPE_ANTE,
} from '@shared/types/indian-poker-event.js';
import { createShuffledDeck } from './deck.js';
import { evaluateHand, getDiePenalty, judgeShowdownMany } from './judge.js';
import type { JudgeCandidate } from './judge.js';

export const HAND_RESULT_DISPLAY_MS = 4500;
export const DEALING_DELAY_MS = 600;

export interface InternalSeat {
  /** session token = Player.id */
  playerId: string;
  memberId: string;
  nickname: string;
  /** DB 영구 잔액 (canonical). 핸드 중에는 인-메모리 계산. */
  chips: number;
  /** 이번 핸드의 베팅 라운드 누적 (콜·레이즈 시 차감). */
  roundBet: number;
  card: number | null;
  isAlive: boolean;
  hasDied: boolean;
  hasActedThisRound: boolean;
  /** 핸드 시작 시점의 chips (정산 metadata용). */
  chipsAtHandStart: number;
}

export interface InternalState {
  /** 5인 좌석. null 이면 빈자리. */
  seats: Array<InternalSeat | null>;
  phase: IPEPhase;
  handNumber: number;
  handId: string | null;
  deck: number[];
  communityCards: [number, number] | null;
  pot: number;
  carryover: number;
  currentTurnSeatIdx: number | null;
  firstActorSeatIdx: number | null;
  currentBet: number;
  bettingStarted: boolean;
  /** 직전 핸드 승자의 seat token (다음 firstActor 결정용). null 이면 첫 핸드 또는 winner 좌석 비어있음. */
  lastWinnerPlayerId: string | null;
  handResult: IPEHandResult | null;
  bettingActions: IPEBettingActionRecord[];
  closedReason: 'operating-hours' | null;
  /** 현재 턴 시작 타임스탬프(ms). armTurnTimer 에서 세팅, 턴 종료 시 null. */
  turnStartedAt: number | null;
}

export function createInitialState(): InternalState {
  return {
    seats: new Array<InternalSeat | null>(IPE_MAX_SEATS).fill(null),
    phase: 'waiting',
    handNumber: 0,
    handId: null,
    deck: [],
    communityCards: null,
    pot: 0,
    carryover: 0,
    currentTurnSeatIdx: null,
    firstActorSeatIdx: null,
    currentBet: 0,
    bettingStarted: false,
    lastWinnerPlayerId: null,
    handResult: null,
    bettingActions: [],
    closedReason: null,
    turnStartedAt: null,
  };
}

/* ───────────────────────── helpers ─────────────────────────── */

export function findEmptySeatIdx(s: InternalState): number {
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    if (s.seats[i] === null) return i;
  }
  return -1;
}

export function findSeatIdxByPlayer(s: InternalState, playerId: string): number {
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    if (s.seats[i]?.playerId === playerId) return i;
  }
  return -1;
}

export function activeSeatIndices(s: InternalState): number[] {
  const arr: number[] = [];
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    if (s.seats[i]) arr.push(i);
  }
  return arr;
}

export function aliveSeatIndices(s: InternalState): number[] {
  const arr: number[] = [];
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    const seat = s.seats[i];
    if (seat && seat.isAlive) arr.push(i);
  }
  return arr;
}

/** 활성 좌석 중 아직 이번 라운드에 행동하지 않은 또는 베팅 차이가 있는 좌석을 다음 턴으로. */
function nextTurnSeatIdx(s: InternalState, fromIdx: number): number | null {
  for (let off = 1; off <= IPE_MAX_SEATS; off++) {
    const idx = (fromIdx + off) % IPE_MAX_SEATS;
    const seat = s.seats[idx];
    if (!seat || !seat.isAlive) continue;
    // 아직 행동 안 했거나, 베팅을 맞춰야 하면 (raise에 응답)
    if (!seat.hasActedThisRound) return idx;
    if (seat.roundBet < s.currentBet) return idx;
  }
  return null;
}

function isBettingRoundComplete(s: InternalState): boolean {
  const alive = aliveSeatIndices(s);
  if (alive.length <= 1) return true;
  for (const idx of alive) {
    const seat = s.seats[idx]!;
    if (!seat.hasActedThisRound) return false;
    if (seat.roundBet < s.currentBet) return false;
  }
  return true;
}

/** 다음 핸드의 첫 행동자(직전 승자). 승자가 없거나 좌석을 떠났으면 가장 작은 활성 좌석. */
function resolveFirstActorSeatIdx(s: InternalState): number | null {
  if (s.lastWinnerPlayerId) {
    const idx = findSeatIdxByPlayer(s, s.lastWinnerPlayerId);
    if (idx >= 0) return idx;
  }
  const active = activeSeatIndices(s);
  return active.length > 0 ? active[0] : null;
}

/* ───────────────────────── seat add/remove ───────────────── */

export function addSeat(
  s: InternalState,
  seatIdx: number,
  playerId: string,
  memberId: string,
  nickname: string,
  chips: number,
): boolean {
  if (seatIdx < 0 || seatIdx >= IPE_MAX_SEATS) return false;
  if (s.seats[seatIdx] !== null) return false;
  s.seats[seatIdx] = {
    playerId,
    memberId,
    nickname,
    chips,
    roundBet: 0,
    card: null,
    isAlive: true,
    hasDied: false,
    hasActedThisRound: false,
    chipsAtHandStart: chips,
  };
  return true;
}

export function removeSeat(s: InternalState, seatIdx: number): InternalSeat | null {
  const seat = s.seats[seatIdx];
  if (!seat) return null;
  s.seats[seatIdx] = null;
  return seat;
}

/* ───────────────────────── hand lifecycle ───────────────── */

export interface StartHandResult {
  started: boolean;
  reason?: 'insufficient_players' | 'closed';
}

/**
 * 새 핸드 시작.
 * - 좌석 칩 >= 1 인 인원이 2명 이상이어야 함.
 * - 앤티 1칩씩 차감.
 * - 카드 분배.
 */
export function startNewHand(s: InternalState): StartHandResult {
  if (s.phase === 'closed') return { started: false, reason: 'closed' };

  const eligible: number[] = [];
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    const seat = s.seats[i];
    if (seat && seat.chips >= IPE_ANTE) eligible.push(i);
  }

  if (eligible.length < IPE_MIN_PLAYERS) {
    s.phase = 'waiting';
    s.currentTurnSeatIdx = null;
    s.firstActorSeatIdx = null;
    return { started: false, reason: 'insufficient_players' };
  }

  s.handNumber += 1;
  s.handId = randomUUID();
  s.phase = 'dealing';
  s.deck = createShuffledDeck();
  s.communityCards = null;
  s.pot = s.carryover; // 이월 합산
  s.carryover = 0;
  s.currentBet = 0;
  s.bettingStarted = false;
  s.handResult = null;
  s.bettingActions = [];

  // 좌석 초기화 + 앤티 차감 (eligible만 참여, 나머지는 그대로 sit-out)
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    const seat = s.seats[i];
    if (!seat) continue;
    seat.roundBet = 0;
    seat.card = null;
    seat.hasDied = false;
    seat.hasActedThisRound = false;
    seat.chipsAtHandStart = seat.chips;

    if (eligible.includes(i)) {
      seat.chips -= IPE_ANTE;
      s.pot += IPE_ANTE;
      seat.isAlive = true;
    } else {
      seat.isAlive = false;
    }
  }

  // 카드 분배 (커뮤니티 2장 + 각자 1장)
  const c1 = s.deck.pop()!;
  const c2 = s.deck.pop()!;
  s.communityCards = [c1, c2];
  for (const i of eligible) {
    const seat = s.seats[i]!;
    seat.card = s.deck.pop()!;
  }

  // 첫 행동자
  s.firstActorSeatIdx = (() => {
    const wanted = resolveFirstActorSeatIdx(s);
    if (wanted !== null && eligible.includes(wanted)) return wanted;
    // 폴백: eligible 중 첫 번째
    return eligible[0];
  })();
  s.currentTurnSeatIdx = s.firstActorSeatIdx;
  s.phase = 'betting';
  return { started: true };
}

/* ───────────────────────── action ─────────────────────────── */

export type ActionType = IPActionType;

export interface ActionResult {
  ok: boolean;
  error?: string;
  handResolved?: boolean;
}

/** 본인 차례인지, 칩 조건이 맞는지 등을 검증한 뒤 액션 처리. */
export function handleAction(
  s: InternalState,
  playerId: string,
  action: { type: ActionType; amount?: number },
): ActionResult {
  if (s.phase !== 'betting' || s.currentTurnSeatIdx === null) {
    return { ok: false, error: 'NOT_BETTING_PHASE' };
  }
  const seatIdx = s.currentTurnSeatIdx;
  const seat = s.seats[seatIdx];
  if (!seat || seat.playerId !== playerId) {
    return { ok: false, error: 'NOT_YOUR_TURN' };
  }
  if (!seat.isAlive) {
    return { ok: false, error: 'NOT_ALIVE' };
  }

  switch (action.type) {
    case 'check': {
      // 베팅이 시작되지 않았을 때만, 아직 raise가 없으면 가능
      if (s.bettingStarted) return { ok: false, error: 'CANNOT_CHECK' };
      if (seat.roundBet < s.currentBet) return { ok: false, error: 'CANNOT_CHECK' };
      seat.hasActedThisRound = true;
      s.bettingActions.push({ seatIdx, playerId: seat.playerId, action: 'check' });
      break;
    }

    case 'call': {
      const cost = s.currentBet - seat.roundBet;
      if (cost < 0) return { ok: false, error: 'INVALID_CALL' };
      if (cost > seat.chips) return { ok: false, error: 'INSUFFICIENT_CHIPS' };
      seat.chips -= cost;
      seat.roundBet += cost;
      s.pot += cost;
      seat.hasActedThisRound = true;
      s.bettingActions.push({
        seatIdx,
        playerId: seat.playerId,
        action: 'call',
        amount: cost,
      });
      break;
    }

    case 'raise': {
      const target = action.amount;
      if (typeof target !== 'number' || !Number.isInteger(target)) {
        return { ok: false, error: 'INVALID_RAISE_AMOUNT' };
      }
      const min = s.currentBet + 1;
      const max = seat.roundBet + seat.chips;
      if (target < min) return { ok: false, error: 'RAISE_BELOW_MIN' };
      if (target > max) return { ok: false, error: 'RAISE_ABOVE_MAX' };

      const cost = target - seat.roundBet;
      seat.chips -= cost;
      seat.roundBet = target;
      s.pot += cost;
      s.currentBet = target;
      s.bettingStarted = true;

      // 모든 다른 활성 좌석의 hasActedThisRound 를 false 로 — 다시 응답해야 함
      for (let i = 0; i < IPE_MAX_SEATS; i++) {
        const other = s.seats[i];
        if (!other || i === seatIdx) continue;
        if (other.isAlive) other.hasActedThisRound = false;
      }
      seat.hasActedThisRound = true;
      s.bettingActions.push({
        seatIdx,
        playerId: seat.playerId,
        action: 'raise',
        amount: target,
      });
      break;
    }

    case 'die': {
      // 다이 패널티: hand 평가 후 페널티 적용 (팟으로 들어감)
      const hand: IPHand = evaluateHand(seat.card!, s.communityCards!);
      let penalty = getDiePenalty(hand);
      penalty = Math.min(penalty, seat.chips);
      seat.chips -= penalty;
      s.pot += penalty;
      seat.isAlive = false;
      seat.hasDied = true;
      seat.hasActedThisRound = true;
      s.bettingActions.push({
        seatIdx,
        playerId: seat.playerId,
        action: 'die',
        amount: penalty,
      });
      break;
    }

    default:
      return { ok: false, error: 'UNKNOWN_ACTION' };
  }

  // 종료 조건 1: 살아있는 사람이 1명 이하 → 라스트 스탠딩
  const alive = aliveSeatIndices(s);
  if (alive.length <= 1) {
    resolveHandLastStanding(s);
    return { ok: true, handResolved: true };
  }

  // 종료 조건 2: 베팅 라운드 완료 → 쇼다운
  if (isBettingRoundComplete(s)) {
    resolveHandShowdown(s);
    return { ok: true, handResolved: true };
  }

  // 다음 턴
  const next = nextTurnSeatIdx(s, seatIdx);
  s.currentTurnSeatIdx = next;
  return { ok: true };
}

/** 본인 차례인데 타이머가 다 됐을 때 강제 다이. */
export function handleTimeout(s: InternalState): ActionResult {
  if (s.phase !== 'betting' || s.currentTurnSeatIdx === null) {
    return { ok: false };
  }
  const seat = s.seats[s.currentTurnSeatIdx];
  if (!seat) return { ok: false };
  return handleAction(s, seat.playerId, { type: 'die' });
}

/* ───────────────────────── resolve ───────────────────────── */

function buildResultEntry(
  s: InternalState,
  seat: InternalSeat,
  seatIdx: number,
  winnerIds: Set<string>,
  exposeCard: boolean,
): IPEHandResultEntry {
  const card = seat.card;
  const hand = card !== null && s.communityCards ? evaluateHand(card, s.communityCards) : null;
  return {
    seatIdx,
    playerId: seat.playerId,
    nickname: seat.nickname,
    card: exposeCard ? card : null,
    hand: exposeCard ? hand : null,
    chipDelta: seat.chips - seat.chipsAtHandStart,
    isWinner: winnerIds.has(seat.playerId),
    isDie: seat.hasDied,
  };
}

function resolveHandLastStanding(s: InternalState): void {
  const alive = aliveSeatIndices(s);
  const potBefore = s.pot;
  if (alive.length === 0) {
    // 모두 다이 — 팟 소멸
    s.pot = 0;
    const entries: IPEHandResultEntry[] = [];
    for (let i = 0; i < IPE_MAX_SEATS; i++) {
      const seat = s.seats[i];
      if (!seat) continue;
      entries.push(buildResultEntry(s, seat, i, new Set(), true));
    }
    s.handResult = {
      handId: s.handId!,
      kind: 'die-all',
      potBefore,
      potDistributed: 0,
      carryover: 0,
      communityCards: s.communityCards,
      winnerIds: [],
      entries,
    };
    s.phase = 'dieResult';
    s.currentTurnSeatIdx = null;
    return;
  }

  const winnerIdx = alive[0];
  const winner = s.seats[winnerIdx]!;
  s.lastWinnerPlayerId = winner.playerId;
  winner.chips += s.pot;
  const distributed = s.pot;
  s.pot = 0;

  const winnerSet = new Set([winner.playerId]);
  const entries: IPEHandResultEntry[] = [];
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    const seat = s.seats[i];
    if (!seat) continue;
    entries.push(buildResultEntry(s, seat, i, winnerSet, true));
  }

  s.handResult = {
    handId: s.handId!,
    kind: 'last-standing',
    potBefore,
    potDistributed: distributed,
    carryover: 0,
    communityCards: s.communityCards,
    winnerIds: [winner.playerId],
    entries,
  };
  s.phase = 'dieResult';
  s.currentTurnSeatIdx = null;
}

function resolveHandShowdown(s: InternalState): void {
  const aliveIdxs = aliveSeatIndices(s);
  const potBefore = s.pot;

  const candidates: JudgeCandidate[] = aliveIdxs.map((i) => {
    const seat = s.seats[i]!;
    return {
      id: seat.playerId,
      card: seat.card!,
      hand: evaluateHand(seat.card!, s.communityCards!),
    };
  });

  const { winnerIds, isDraw } = judgeShowdownMany(candidates);
  const winnerSet = new Set(winnerIds);

  let distributed = 0;
  let carryover = 0;
  if (winnerIds.length === 0) {
    carryover = s.pot;
    s.carryover += carryover;
  } else if (!isDraw) {
    const winId = winnerIds[0]!;
    const winnerSeat = aliveIdxs
      .map((i) => s.seats[i]!)
      .find((seat) => seat.playerId === winId)!;
    winnerSeat.chips += s.pot;
    distributed = s.pot;
    s.lastWinnerPlayerId = winId;
  } else {
    // 무승부 — 균등 분할, 나머지는 소멸
    const share = Math.floor(s.pot / winnerIds.length);
    for (const wid of winnerIds) {
      const seat = aliveIdxs.map((i) => s.seats[i]!).find((s2) => s2.playerId === wid)!;
      seat.chips += share;
    }
    distributed = share * winnerIds.length;
    // 나머지 칩은 소멸 (carryover 없음)
  }
  s.pot = 0;

  const entries: IPEHandResultEntry[] = [];
  for (let i = 0; i < IPE_MAX_SEATS; i++) {
    const seat = s.seats[i];
    if (!seat) continue;
    const exposeCard = true;
    entries.push(buildResultEntry(s, seat, i, winnerSet, exposeCard));
  }

  s.handResult = {
    handId: s.handId!,
    kind: 'showdown',
    potBefore,
    potDistributed: distributed,
    carryover,
    communityCards: s.communityCards,
    winnerIds,
    entries,
  };
  s.phase = 'showdown';
  s.currentTurnSeatIdx = null;
}

/* ───────────────────────── snapshot for client ────────────── */

function maskSeatForViewer(
  seat: InternalSeat,
  exposeCard: boolean,
): IPEPlayerInfo {
  return {
    seatIdx: -1, // 채워질 예정
    playerId: seat.playerId,
    memberId: seat.memberId,
    nickname: seat.nickname,
    chips: seat.chips,
    roundBet: seat.roundBet,
    card: exposeCard ? seat.card : null,
    isAlive: seat.isAlive,
    hasDied: seat.hasDied,
    hasActedThisRound: seat.hasActedThisRound,
  };
}

/**
 * 본인 카드는 가리고, 다른 사람 카드는 베팅 단계에서도 노출 (인디언홀덤 룰).
 * 쇼다운/다이/완료 단계엔 본인 카드도 노출.
 */
export function buildGameDataFor(
  s: InternalState,
  viewerPlayerId: string | null,
): IPEGameData {
  const reveal = s.phase === 'showdown' || s.phase === 'dieResult';

  const seatsView: Array<IPEPlayerInfo | null> = s.seats.map((seat, idx) => {
    if (!seat) return null;
    let exposeCard: boolean;
    if (reveal) {
      exposeCard = true;
    } else {
      // betting 단계 — 인디언 룰: 본인 카드 가림, 타인은 보임
      exposeCard = viewerPlayerId === null ? true : seat.playerId !== viewerPlayerId;
    }
    const info = maskSeatForViewer(seat, exposeCard);
    info.seatIdx = idx;
    return info;
  });

  return {
    phase: s.phase,
    handNumber: s.handNumber,
    seats: seatsView,
    pot: s.pot,
    carryover: s.carryover,
    communityCards: s.communityCards,
    currentTurnSeatIdx: s.currentTurnSeatIdx,
    firstActorSeatIdx: s.firstActorSeatIdx,
    currentBet: s.currentBet,
    bettingStarted: s.bettingStarted,
    deckRemaining: s.deck.length,
    handResult: s.handResult,
    bettingActions: s.bettingActions,
    closedReason: s.closedReason,
    turnStartedAt: s.turnStartedAt,
  };
}
