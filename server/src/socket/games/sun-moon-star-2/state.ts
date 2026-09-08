import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  SMS2ChipBet,
  SMS2GameData,
  SMS2MarkId,
  SMS2PlayerPublic,
  SMS2PowderSubmission,
  SMS2RoundRecord,
  SMS2SelfPrivate,
  SMS2Side,
  SMS2WinType,
} from '@shared/types/sun-moon-star-2.js';
import {
  MARK_IDS,
  SMS2_INITIAL_CHIPS,
  SMS2_INITIAL_POWDER,
  firstMaxBet,
  powderStageOf,
  secondMinBet,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
} from '@shared/types/sun-moon-star-2.js';
import type {
  SunMoonStar2ArchiveRecord,
  SunMoonStar2MarkStats,
  SunMoonStar2PlayerStats,
} from '@shared/types/archive.js';
import {
  FINAL_RESULT_HOLD_MS,
  NEXT_ROUND_AUTO_DELAY_MS,
  RESOLVE_FINISH_HOLD_MS,
  RESOLVE_START_DELAY_MS,
  RESOLVE_STEP_DELAY_MS,
  ROUND_END_HOLD_MS,
  SUDDEN_DEATH_INTRO_MS,
} from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  SMS2InternalState,
  SMS2MarkPool,
  SMS2PlayerInternal,
  SMS2PlayerSnapshot,
  SMS2UndoSnapshot,
} from './types.js';
import { resolveRound } from './resolve.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';

export const gameStates = new Map<string, SMS2InternalState>();

/* ────────── helpers ────────── */

export function makePlayer(
  id: string, nickname: string, side: SMS2Side, isAi: boolean,
): SMS2PlayerInternal {
  return {
    id,
    nickname,
    side,
    chips: SMS2_INITIAL_CHIPS,
    powderRemain: SMS2_INITIAL_POWDER,
    markContribution: { sun: 0, moon: 0, star: 0 },
    pendingPowder: null,
    powderSubmittedAt: null,
    pendingBet: null,
    betConfirmedAt: null,
    autoThisRound: false,
    isAi,
  };
}

export function makeMarkPool(): Record<SMS2MarkId, SMS2MarkPool> {
  return {
    sun: { p1: 0, p2: 0, total: 0 },
    moon: { p1: 0, p2: 0, total: 0 },
    star: { p1: 0, p2: 0, total: 0 },
  };
}

function playerByToken(s: SMS2InternalState, token: string): SMS2PlayerInternal | null {
  if (s.player1.id === token) return s.player1;
  if (s.player2.id === token) return s.player2;
  return null;
}

function otherSide(side: SMS2Side): SMS2Side {
  return side === 'p1' ? 'p2' : 'p1';
}

function getPlayerBySide(s: SMS2InternalState, side: SMS2Side): SMS2PlayerInternal {
  return side === 'p1' ? s.player1 : s.player2;
}

function getFirstPlayer(s: SMS2InternalState): SMS2PlayerInternal {
  return getPlayerBySide(s, s.firstPlayerSide);
}

function getSecondPlayer(s: SMS2InternalState): SMS2PlayerInternal {
  return getPlayerBySide(s, otherSide(s.firstPlayerSide));
}

/* ────────── broadcasting ────────── */

function phaseMessage(s: SMS2InternalState, viewerToken: string): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  const ext = s.suddenDeath ? '서든데스 ' : '';
  const first = getFirstPlayer(s);
  const firstNick = isTokenAnonymized(s.roomId, first.id) && first.id !== viewerToken
    ? ANONYMOUS_NICKNAME
    : first.nickname;
  switch (s.phase) {
    case 'powder': {
      const p1 = !!s.player1.pendingPowder;
      const p2 = !!s.player2.pendingPowder;
      if (p1 && p2) return `${ext}R${s.round} — 양측 제출 완료`;
      if (p1 || p2) return `${ext}R${s.round} — 상대 제출 대기 중...`;
      return `${ext}R${s.round} / ${s.maxRound} — 빛가루를 해·달·별에 배분하세요`;
    }
    case 'betFirst': return `${ext}R${s.round} — ${firstNick} (선) 베팅 중...`;
    case 'betSecond': return `${ext}R${s.round} — 후 플레이어 베팅 중...`;
    case 'resolve': return `${ext}R${s.round} — 표식 점등...`;
    case 'roundEnd': return `${ext}R${s.round} — 결과`;
    case 'finished': return '게임 종료';
    default: return '';
  }
}

function playerToPublic(p: SMS2PlayerInternal): SMS2PlayerPublic {
  return {
    id: p.id,
    nickname: p.nickname,
    side: p.side,
    chips: p.chips,
    powderStage: powderStageOf(p.powderRemain),
    submittedPowder: !!p.pendingPowder,
    betConfirmed: !!p.pendingBet,
    publicBet: shouldExposeBet(p) ? p.pendingBet : null,
  };
}

/**
 * 공개 베팅 노출 시점:
 * - 선 플레이어의 베팅은 선 베팅 확정 직후부터 공개
 * - 후 플레이어의 베팅은 후 베팅 확정 직후부터 공개
 * - 실제 현재 pending이 존재한다는 것은 확정됐다는 의미(취소로 null이 됨)
 */
function shouldExposeBet(p: SMS2PlayerInternal): boolean {
  return p.betConfirmedAt !== null && !!p.pendingBet;
}

function buildSelfPrivate(p: SMS2PlayerInternal): SMS2SelfPrivate {
  return {
    side: p.side,
    powderRemain: p.powderRemain,
    pendingPowder: p.pendingPowder,
    pendingBet: p.pendingBet,
    myMarkContribution: { ...p.markContribution },
  };
}

/**
 * 라운드 기록을 관전자/상대용으로 마스킹.
 * 게임 진행 중에는 빛가루 분배를 감추고, 게임 종료 후(finished)는 전체 공개.
 */
function sanitizeRoundForView(
  r: SMS2RoundRecord,
  viewerSide: SMS2Side | 'spectator',
  gameOver: boolean,
): SMS2RoundRecord {
  if (gameOver) return r;
  const powderSubmission = { p1: { ...r.powderSubmission.p1 }, p2: { ...r.powderSubmission.p2 } };
  if (viewerSide !== 'p1') powderSubmission.p1 = zeroPowder();
  if (viewerSide !== 'p2') powderSubmission.p2 = zeroPowder();
  return {
    ...r,
    powderSubmission,
    markTotalsBefore: { ...r.markTotalsBefore },
    markTotalsAfter: { ...r.markTotalsAfter },
    bets: { p1: { ...r.bets.p1 }, p2: { ...r.bets.p2 } },
    chipDelta: { ...r.chipDelta },
    chipAfter: { ...r.chipAfter },
    stageBefore: { ...r.stageBefore },
    stageAfter: { ...r.stageAfter },
    auto: { ...r.auto },
  };
}

function buildGameDataForViewer(
  s: SMS2InternalState,
  viewerSide: SMS2Side | 'spectator',
  viewerToken: string,
): SMS2GameData {
  const maskNick = (p: SMS2PlayerInternal) => {
    const isMe = (viewerSide === 'p1' && p.side === 'p1') || (viewerSide === 'p2' && p.side === 'p2');
    return isTokenAnonymized(s.roomId, p.id) && !isMe ? ANONYMOUS_NICKNAME : p.nickname;
  };
  const players = {
    p1: { ...playerToPublic(s.player1), nickname: maskNick(s.player1) },
    p2: { ...playerToPublic(s.player2), nickname: maskNick(s.player2) },
  };

  const data: SMS2GameData = {
    phase: s.phase,
    round: s.round,
    maxRound: s.maxRound,
    suddenDeath: s.suddenDeath,
    firstPlayerSide: s.firstPlayerSide,
    players,
    selfPrivate: null,
    history: s.history.map((r) => sanitizeRoundForView(r, viewerSide, s.gameOver)),
    finalWinner: s.finalWinner,
    winType: s.winType,
    isFinalRound: s.round >= s.maxRound,
  };

  if (viewerSide === 'p1' || viewerSide === 'p2') {
    data.selfPrivate = buildSelfPrivate(getPlayerBySide(s, viewerSide));
  }

  if (s.phase === 'resolve' && s.resolveSteps.length > 0) {
    data.resolveSteps = [...s.resolveSteps];
  }

  if ((s.phase === 'resolve' || s.phase === 'roundEnd') && s.lastRoundRecord) {
    data.roundResult = sanitizeRoundForView(s.lastRoundRecord, viewerSide, s.gameOver);
  }

  return data;
}

function _applyDbgView(
  s: SMS2InternalState,
  token: string,
  viewerSide: SMS2Side | 'spectator',
  data: SMS2GameData,
): SMS2GameData {
  if (viewerSide !== 'p1' && viewerSide !== 'p2') return data;
  if (!isDbgViewer(s.playMode, sessions.getMemberId(token))) return data;
  const oppSide = viewerSide === 'p1' ? 'p2' : 'p1';
  const out: SMS2GameData & { _x?: { opponentPrivate: SMS2SelfPrivate } } = {
    ...data,
    history: s.history.map((r) => sanitizeRoundForView(r, viewerSide, true)),
    _x: {
      opponentPrivate: buildSelfPrivate(getPlayerBySide(s, oppSide)),
    },
  };
  if ((s.phase === 'resolve' || s.phase === 'roundEnd') && s.lastRoundRecord) {
    out.roundResult = sanitizeRoundForView(s.lastRoundRecord, viewerSide, true);
  }
  return out;
}

function buildGameState(s: SMS2InternalState, gameData: SMS2GameData, viewerToken: string): GameState {
  const isInputPhase = s.phase === 'powder' || s.phase === 'betFirst' || s.phase === 'betSecond';
  return {
    roomId: s.roomId,
    message: phaseMessage(s, viewerToken),
    currentTurn: resolveCurrentTurn(s),
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds && isInputPhase ? s.turnStartedAt : null,
    gameData,
  };
}

function resolveCurrentTurn(s: SMS2InternalState): string | null {
  if (s.phase === 'betFirst') return getFirstPlayer(s).id;
  if (s.phase === 'betSecond') return getSecondPlayer(s).id;
  return null;
}

function viewerSideOf(s: SMS2InternalState, token: string): SMS2Side | 'spectator' {
  if (s.player1.id === token) return 'p1';
  if (s.player2.id === token) return 'p2';
  return 'spectator';
}

export async function broadcastState(io: IO, s: SMS2InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const token = sessions.getToken(sock.id) ?? sock.id;
    const viewerSide = viewerSideOf(s, token);
    let data = buildGameDataForViewer(s, viewerSide, token);
    data = _applyDbgView(s, token, viewerSide, data);
    const raw = data as Record<string, unknown>;
    const ext = raw['_x'];
    if (ext !== undefined) { delete raw['_x']; sock.emit('ext:data', ext); }
    sock.emit('game:state', buildGameState(s, data, token));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: SMS2InternalState) {
  const token = sessions.getToken(socket.id) ?? socket.id;
  const viewerSide = viewerSideOf(s, token);
  let data = buildGameDataForViewer(s, viewerSide, token);
  data = _applyDbgView(s, token, viewerSide, data);
  const raw = data as Record<string, unknown>;
  const ext = raw['_x'];
  if (ext !== undefined) { delete raw['_x']; socket.emit('ext:data', ext); }
  socket.emit('game:state', buildGameState(s, data, token));
}

/* ────────── timers ────────── */

export function clearAllTimers(s: SMS2InternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  if (s.resolveTimer) { clearTimeout(s.resolveTimer); s.resolveTimer = null; }
  if (s.nextRoundTimer) { clearTimeout(s.nextRoundTimer); s.nextRoundTimer = null; }
}

function armInputTimer(io: IO, s: SMS2InternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  if (!s.timeLimitSeconds) {
    s.roundDeadline = null;
    return;
  }
  s.turnStartedAt = Date.now();
  s.roundDeadline = s.turnStartedAt + s.timeLimitSeconds * 1000;
  s.roundTimer = scheduleTurnExpiry(io, s, 'roundTimer', () => resolveCurrentTurn(s), () => handleTimeout(io, s), s.timeLimitSeconds * 1000);
}

/* ────────── round lifecycle ────────── */

export function startRound(io: IO, s: SMS2InternalState) {
  if (s.gameOver) return;

  s.player1.pendingPowder = null;
  s.player1.powderSubmittedAt = null;
  s.player1.pendingBet = null;
  s.player1.betConfirmedAt = null;
  s.player1.autoThisRound = false;

  s.player2.pendingPowder = null;
  s.player2.powderSubmittedAt = null;
  s.player2.pendingBet = null;
  s.player2.betConfirmedAt = null;
  s.player2.autoThisRound = false;

  s.phase = 'powder';
  s.resolveSteps = [];
  s.lastRoundRecord = null;

  pushUndoSnapshot(s);
  armInputTimer(io, s);
  void broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── submit powder ────────── */

export function trySubmitPowder(
  io: IO, s: SMS2InternalState, playerId: string,
  powder: SMS2PowderSubmission,
): string | null {
  if (s.phase !== 'powder') return '지금은 빛가루를 제출할 수 있는 단계가 아닙니다.';
  if (s.gameOver) return '게임이 종료되었습니다.';

  const player = playerByToken(s, playerId);
  if (!player) return null;
  if (player.pendingPowder) return '이미 제출했습니다.';

  const parsed = parsePowder(powder);
  if (!parsed) return '빛가루 값이 올바르지 않습니다.';
  const total = sumPowder(parsed);
  if (total > player.powderRemain) {
    return `빛가루가 부족합니다. (보유 ${player.powderRemain}g / 제출 ${total}g)`;
  }

  player.pendingPowder = parsed;
  player.powderSubmittedAt = Date.now();
  resetTimeout(s, player.id);

  const opp = player === s.player1 ? s.player2 : s.player1;
  if (opp.pendingPowder) {
    proceedFromPowder(io, s);
  } else {
    void broadcastState(io, s);
  }
  return null;
}

function parsePowder(p: unknown): SMS2PowderSubmission | null {
  if (!p || typeof p !== 'object') return null;
  const { sun, moon, star } = p as Partial<SMS2PowderSubmission>;
  for (const v of [sun, moon, star]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) return null;
  }
  return { sun: sun as number, moon: moon as number, star: star as number };
}

export function tryCancelPowder(
  io: IO, s: SMS2InternalState, playerId: string,
): string | null {
  if (s.phase !== 'powder') return '지금은 취소할 수 없습니다.';
  const player = playerByToken(s, playerId);
  if (!player || !player.pendingPowder) return '제출하지 않은 상태입니다.';
  const opp = player === s.player1 ? s.player2 : s.player1;
  if (opp.pendingPowder) return '상대도 이미 제출하여 취소할 수 없습니다.';
  player.pendingPowder = null;
  player.powderSubmittedAt = null;
  void broadcastState(io, s);
  return null;
}

/* ────────── powder reflect → betFirst ────────── */

function proceedFromPowder(io: IO, s: SMS2InternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  s.roundDeadline = null;

  // 양측 빛가루 제출 반영
  const p1Sub = s.player1.pendingPowder ?? zeroPowder();
  const p2Sub = s.player2.pendingPowder ?? zeroPowder();

  // 잔여 빛가루 차감
  s.player1.powderRemain = Math.max(0, s.player1.powderRemain - sumPowder(p1Sub));
  s.player2.powderRemain = Math.max(0, s.player2.powderRemain - sumPowder(p2Sub));

  // 표식별 누적 반영
  for (const mark of MARK_IDS) {
    s.markPool[mark].p1 += p1Sub[mark];
    s.markPool[mark].p2 += p2Sub[mark];
    s.markPool[mark].total = s.markPool[mark].p1 + s.markPool[mark].p2;
    s.player1.markContribution[mark] += p1Sub[mark];
    s.player2.markContribution[mark] += p2Sub[mark];
  }

  // 다음 페이즈: 선 베팅
  s.phase = 'betFirst';
  armInputTimer(io, s);
  void broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── submit bet ────────── */

export function trySubmitBet(
  io: IO, s: SMS2InternalState, playerId: string,
  bet: SMS2ChipBet,
): string | null {
  if (s.phase !== 'betFirst' && s.phase !== 'betSecond') {
    return '지금은 베팅할 수 있는 단계가 아닙니다.';
  }
  if (s.gameOver) return '게임이 종료되었습니다.';

  const player = playerByToken(s, playerId);
  if (!player) return null;

  const expected = s.phase === 'betFirst' ? getFirstPlayer(s) : getSecondPlayer(s);
  if (player !== expected) return '본인 턴이 아닙니다.';

  if (player.pendingBet) return '이미 베팅했습니다.';

  const parsed = parseBet(bet);
  if (!parsed) return '베팅 값이 올바르지 않습니다.';

  const total = sumBet(parsed);
  if (total > player.chips) {
    return `보유 칩을 초과했습니다. (보유 ${player.chips}개)`;
  }

  if (s.phase === 'betFirst') {
    const maxAllowed = firstMaxBet(getSecondPlayer(s).chips);
    if (total > maxAllowed) {
      return `선 베팅 한도 초과입니다. (최대 ${maxAllowed}개)`;
    }
  } else {
    const firstTotal = sumBet(getFirstPlayer(s).pendingBet ?? zeroBet());
    const minRequired = secondMinBet(firstTotal);
    if (total < minRequired) {
      return `후 베팅은 최소 ${minRequired}개입니다. (선 ${firstTotal}개의 2배)`;
    }
  }

  player.pendingBet = parsed;
  player.betConfirmedAt = Date.now();
  resetTimeout(s, player.id);

  if (s.phase === 'betFirst') {
    s.phase = 'betSecond';
    armInputTimer(io, s);
    void broadcastState(io, s);
    if (s.playMode === 'com') s.onAITurn?.(io, s);
  } else {
    proceedFromBetSecond(io, s);
  }
  return null;
}

function parseBet(b: unknown): SMS2ChipBet | null {
  if (!b || typeof b !== 'object') return null;
  const { sun, moon, star } = b as Partial<SMS2ChipBet>;
  for (const v of [sun, moon, star]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) return null;
  }
  return { sun: sun as number, moon: moon as number, star: star as number };
}

export function tryCancelBet(
  io: IO, s: SMS2InternalState, playerId: string,
): string | null {
  if (s.phase !== 'betFirst' && s.phase !== 'betSecond') return '지금은 취소할 수 없습니다.';
  const player = playerByToken(s, playerId);
  if (!player || !player.pendingBet) return '확정한 베팅이 없습니다.';
  // 선 베팅 확정 후 후 베팅 단계 중에는 선이 취소 불가
  if (s.phase === 'betSecond' && player === getFirstPlayer(s)) {
    return '이미 확정된 선의 베팅은 취소할 수 없습니다.';
  }
  // betFirst 단계에서 선 베팅 취소는 제출 후 즉시 불가능 (이미 betSecond로 넘어갔으므로)
  // 실제로는 phase 전환이 이미 일어나서 이 분기에 도달하지 않음. 그래도 가드.
  player.pendingBet = null;
  player.betConfirmedAt = null;
  void broadcastState(io, s);
  return null;
}

/* ────────── resolve ────────── */

function proceedFromBetSecond(io: IO, s: SMS2InternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  s.roundDeadline = null;

  const first = getFirstPlayer(s);
  const second = getSecondPlayer(s);
  const firstBet = first.pendingBet ?? zeroBet();
  const secondBet = second.pendingBet ?? zeroBet();

  const totals = {
    sun: s.markPool.sun.total,
    moon: s.markPool.moon.total,
    star: s.markPool.star.total,
  };
  const markTotalsBefore = { ...totals };

  // 빛가루 제출 이전 단계 (powderRemain은 proceedFromPowder에서 이미 차감됐으므로 역산)
  const p1Sub = s.player1.pendingPowder ?? zeroPowder();
  const p2Sub = s.player2.pendingPowder ?? zeroPowder();
  const stageBefore = {
    p1: powderStageOf(s.player1.powderRemain + sumPowder(p1Sub)),
    p2: powderStageOf(s.player2.powderRemain + sumPowder(p2Sub)),
  };

  const result = resolveRound({
    firstSide: s.firstPlayerSide,
    firstBet,
    secondSide: otherSide(s.firstPlayerSide),
    secondBet,
    totals,
    chipsBefore: { p1: s.player1.chips, p2: s.player2.chips },
    stageBefore,
    stageAfter: {
      p1: powderStageOf(s.player1.powderRemain),
      p2: powderStageOf(s.player2.powderRemain),
    },
  });

  // 정산 적용: 점등 표식 베팅만 2배 환급
  s.player1.chips = result.chipAfter.p1;
  s.player2.chips = result.chipAfter.p2;

  // 점등 표식 빛가루 소멸
  const lit = result.litMark;
  s.markPool[lit].p1 = 0;
  s.markPool[lit].p2 = 0;
  s.markPool[lit].total = 0;
  s.player1.markContribution[lit] = 0;
  s.player2.markContribution[lit] = 0;

  // 표식별 합산 (정산 후)
  const markTotalsAfter = {
    sun: s.markPool.sun.total,
    moon: s.markPool.moon.total,
    star: s.markPool.star.total,
  };

  const bets = {
    p1: s.firstPlayerSide === 'p1' ? firstBet : secondBet,
    p2: s.firstPlayerSide === 'p2' ? firstBet : secondBet,
  };

  const record: SMS2RoundRecord = {
    round: s.round,
    firstPlayerSide: s.firstPlayerSide,
    powderSubmission: {
      p1: s.player1.pendingPowder ?? zeroPowder(),
      p2: s.player2.pendingPowder ?? zeroPowder(),
    },
    markTotalsBefore,
    markTotalsAfter,
    bets,
    firstBetTotal: sumBet(firstBet),
    secondBetTotal: sumBet(secondBet),
    litMark: result.litMark,
    tieBreak: result.tieBreak,
    chipDelta: result.chipDelta,
    chipAfter: result.chipAfter,
    stageBefore,
    stageAfter: {
      p1: powderStageOf(s.player1.powderRemain),
      p2: powderStageOf(s.player2.powderRemain),
    },
    auto: { p1: s.player1.autoThisRound, p2: s.player2.autoThisRound },
  };

  s.history.push(record);
  s.lastRoundRecord = record;
  s.resolveSteps = result.steps;
  s.phase = 'resolve';

  void broadcastState(io, s);

  const animMs =
    RESOLVE_START_DELAY_MS +
    result.steps.length * RESOLVE_STEP_DELAY_MS +
    RESOLVE_FINISH_HOLD_MS;
  const gen = s.aiGeneration;
  s.resolveTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    enterRoundEnd(io, s);
  }, animMs);
}

function enterRoundEnd(io: IO, s: SMS2InternalState) {
  s.phase = 'roundEnd';
  void broadcastState(io, s);

  // 중간 0칩 감지 → 즉시 종료
  if (s.player1.chips <= 0 || s.player2.chips <= 0) {
    const gen = s.aiGeneration;
    s.nextRoundTimer = setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      concludeByElimination(io, s);
    }, ROUND_END_HOLD_MS);
    return;
  }

  const isLastRound = s.round >= s.maxRound;
  if (isLastRound) {
    const gen = s.aiGeneration;
    s.nextRoundTimer = setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      concludeAfterFinalRound(io, s);
    }, ROUND_END_HOLD_MS);
    return;
  }

  const gen = s.aiGeneration;
  s.nextRoundTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceToNextRound(io, s);
  }, NEXT_ROUND_AUTO_DELAY_MS);
}

function advanceToNextRound(io: IO, s: SMS2InternalState) {
  s.round += 1;
  // 선 교대 (R1 무작위, 이후 매 라운드 교대)
  s.firstPlayerSide = otherSide(s.firstPlayerSide);
  startRound(io, s);
}

/* ────────── 종료 처리 ────────── */

function concludeByElimination(io: IO, s: SMS2InternalState) {
  let winner: SMS2Side | 'draw';
  if (s.player1.chips <= 0 && s.player2.chips <= 0) winner = 'draw';
  else if (s.player1.chips <= 0) winner = 'p2';
  else winner = 'p1';
  finalizeGame(io, s, winner, 'elimination');
}

function concludeAfterFinalRound(io: IO, s: SMS2InternalState) {
  if (s.player1.chips === s.player2.chips) {
    if (s.options.enableSuddenDeath && !s.suddenDeathConsumed) {
      enterSuddenDeath(io, s);
      return;
    }
    finalizeGame(io, s, 'draw', 'draw');
    return;
  }
  const winner: SMS2Side = s.player1.chips > s.player2.chips ? 'p1' : 'p2';
  finalizeGame(io, s, winner, s.suddenDeath ? 'suddenDeath' : 'chips');
}

function enterSuddenDeath(io: IO, s: SMS2InternalState) {
  s.suddenDeath = true;
  s.suddenDeathConsumed = true;
  s.maxRound = s.round + 1;
  s.round += 1;
  // 서든데스 선은 원래 교대 규칙대로 전환
  s.firstPlayerSide = otherSide(s.firstPlayerSide);

  // 짧은 인트로 페이즈 후 바로 라운드 시작
  void broadcastState(io, s);
  const gen = s.aiGeneration;
  s.nextRoundTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    startRound(io, s);
  }, SUDDEN_DEATH_INTRO_MS);
}

function finalizeGame(
  io: IO, s: SMS2InternalState,
  winner: SMS2Side | 'draw',
  winType: SMS2WinType,
) {
  s.gameOver = true;
  s.phase = 'finished';
  s.finalWinner = winner;
  s.winType = winType;

  void broadcastState(io, s);

  const winnerPlayer =
    winner === 'draw' ? null : (winner === 'p1' ? s.player1 : s.player2);
  const loserPlayer =
    winner === 'draw' ? null : (winner === 'p1' ? s.player2 : s.player1);

  let rankings;
  if (winnerPlayer && loserPlayer) {
    rankings = [
      { playerId: winnerPlayer.id, nickname: winnerPlayer.nickname, rank: 1, score: winnerPlayer.chips },
      { playerId: loserPlayer.id, nickname: loserPlayer.nickname, rank: 2, score: loserPlayer.chips },
    ];
  } else {
    rankings = [
      { playerId: s.player1.id, nickname: s.player1.nickname, rank: 1, score: s.player1.chips },
      { playerId: s.player2.id, nickname: s.player2.nickname, rank: 1, score: s.player2.chips },
    ];
  }

  const gameResultData = buildArchiveRecord(s);

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, {
      rankings,
      totalTurns: s.history.length,
      gameResultData,
    });
  }, FINAL_RESULT_HOLD_MS);
}

/* ────────── archive ────────── */

function buildArchiveRecord(s: SMS2InternalState): SunMoonStar2ArchiveRecord {
  const markStats: Record<SMS2MarkId, SunMoonStar2MarkStats> = {
    sun: { litCount: 0, powderConsumed: 0 },
    moon: { litCount: 0, powderConsumed: 0 },
    star: { litCount: 0, powderConsumed: 0 },
  };
  const playerStats: { p1: SunMoonStar2PlayerStats; p2: SunMoonStar2PlayerStats } = {
    p1: emptyPlayerStats(),
    p2: emptyPlayerStats(),
  };
  const sides: SMS2Side[] = ['p1', 'p2'];

  for (const r of s.history) {
    markStats[r.litMark].litCount += 1;
    markStats[r.litMark].powderConsumed += r.markTotalsAfter[r.litMark]; // 정산 후에는 0이지만, before 참조는 아래

    // 실제 소멸은 markTotalsBefore[litMark]
    markStats[r.litMark].powderConsumed += r.markTotalsBefore[r.litMark] - r.markTotalsAfter[r.litMark];

    playerStats[r.firstPlayerSide].firstRounds += 1;

    for (const side of sides) {
      for (const mark of MARK_IDS) {
        playerStats[side].powderByMark[mark] += r.powderSubmission[side][mark];
        playerStats[side].betByMark[mark] += r.bets[side][mark];

        const staked = r.bets[side][mark];
        if (staked > 0) {
          if (mark === r.litMark) {
            playerStats[side].totalReturned += staked * 2;
          } else {
            playerStats[side].totalForfeited += staked;
          }
        }
      }
      if (r.auto[side]) playerStats[side].autoRounds += 1;
    }
  }

  // markStats.powderConsumed 재계산: 중복 누적 제거
  for (const mark of MARK_IDS) markStats[mark].powderConsumed = 0;
  for (const r of s.history) {
    markStats[r.litMark].powderConsumed += r.markTotalsBefore[r.litMark];
  }

  const finalChips: Record<string, number> = {
    [s.player1.id]: s.player1.chips,
    [s.player2.id]: s.player2.chips,
  };
  const finalPowder: Record<string, number> = {
    [s.player1.id]: s.player1.powderRemain,
    [s.player2.id]: s.player2.powderRemain,
  };
  const players: Record<string, { nickname: string }> = {
    [s.player1.id]: { nickname: s.player1.nickname },
    [s.player2.id]: { nickname: s.player2.nickname },
  };

  const winnerId =
    s.finalWinner === 'p1' ? s.player1.id :
    s.finalWinner === 'p2' ? s.player2.id : null;

  return {
    winType: s.winType,
    winnerId,
    finalChips,
    finalPowder,
    totalRounds: s.history.length,
    suddenDeath: s.suddenDeath,
    sides: { p1: s.player1.id, p2: s.player2.id },
    rounds: s.history.map((r) => ({
      ...r,
      powderSubmission: { p1: { ...r.powderSubmission.p1 }, p2: { ...r.powderSubmission.p2 } },
      markTotalsBefore: { ...r.markTotalsBefore },
      markTotalsAfter: { ...r.markTotalsAfter },
      bets: { p1: { ...r.bets.p1 }, p2: { ...r.bets.p2 } },
      chipDelta: { ...r.chipDelta },
      chipAfter: { ...r.chipAfter },
      stageBefore: { ...r.stageBefore },
      stageAfter: { ...r.stageAfter },
      auto: { ...r.auto },
    })),
    markStats,
    playerStats,
    players,
    finishReason: s.finishReason,
  };
}

function emptyPlayerStats(): SunMoonStar2PlayerStats {
  return {
    powderByMark: { sun: 0, moon: 0, star: 0 },
    betByMark: { sun: 0, moon: 0, star: 0 },
    totalReturned: 0,
    totalForfeited: 0,
    firstRounds: 0,
    autoRounds: 0,
  };
}

/* ────────── timeout / 자동 제출 ────────── */

function handleTimeout(io: IO, s: SMS2InternalState) {
  if (s.gameOver) return;
  s.roundTimer = null;

  if (s.phase === 'powder') {
    // 미제출자는 자동 0g 제출
    for (const p of [s.player1, s.player2]) {
      if (p.pendingPowder) continue;
      trackTimeout(s, p.id);
      if (shouldForceEnd(s, p.id)) {
        const opp = p === s.player1 ? s.player2 : s.player1;
        s.finishReason = `${p.nickname} 연속 시간 초과`;
        finalizeGame(io, s, opp.side, 'timeout');
        return;
      }
      p.pendingPowder = zeroPowder();
      p.powderSubmittedAt = Date.now();
      p.autoThisRound = true;
    }
    proceedFromPowder(io, s);
    return;
  }

  if (s.phase === 'betFirst') {
    const first = getFirstPlayer(s);
    if (first.pendingBet) return;
    trackTimeout(s, first.id);
    if (shouldForceEnd(s, first.id)) {
      const opp = first === s.player1 ? s.player2 : s.player1;
      s.finishReason = `${first.nickname} 연속 시간 초과`;
      finalizeGame(io, s, opp.side, 'timeout');
      return;
    }
    // 선은 자동 0 베팅
    first.pendingBet = zeroBet();
    first.betConfirmedAt = Date.now();
    first.autoThisRound = true;
    s.phase = 'betSecond';
    armInputTimer(io, s);
    void broadcastState(io, s);
    if (s.playMode === 'com') s.onAITurn?.(io, s);
    return;
  }

  if (s.phase === 'betSecond') {
    const second = getSecondPlayer(s);
    if (second.pendingBet) return;
    trackTimeout(s, second.id);
    if (shouldForceEnd(s, second.id)) {
      const opp = second === s.player1 ? s.player2 : s.player1;
      s.finishReason = `${second.nickname} 연속 시간 초과`;
      finalizeGame(io, s, opp.side, 'timeout');
      return;
    }
    // 후는 자동 최소 베팅 (해에 할당)
    const firstTotal = sumBet(getFirstPlayer(s).pendingBet ?? zeroBet());
    const minRequired = Math.min(second.chips, secondMinBet(firstTotal));
    second.pendingBet = { sun: minRequired, moon: 0, star: 0 };
    second.betConfirmedAt = Date.now();
    second.autoThisRound = true;
    proceedFromBetSecond(io, s);
    return;
  }
}

function trackTimeout(s: SMS2InternalState, pid: string) {
  s.consecutiveTimeouts[pid] = (s.consecutiveTimeouts[pid] ?? 0) + 1;
}

function shouldForceEnd(s: SMS2InternalState, pid: string): boolean {
  return (s.consecutiveTimeouts[pid] ?? 0) >= 3;
}

export function resetTimeout(s: SMS2InternalState, pid: string) {
  s.consecutiveTimeouts[pid] = 0;
}

/* ────────── undo snapshots ────────── */

function snapshotPlayer(p: SMS2PlayerInternal): SMS2PlayerSnapshot {
  return {
    chips: p.chips,
    powderRemain: p.powderRemain,
    markContribution: { ...p.markContribution },
    pendingPowder: p.pendingPowder ? { ...p.pendingPowder } : null,
    pendingBet: p.pendingBet ? { ...p.pendingBet } : null,
    powderSubmittedAt: p.powderSubmittedAt,
    betConfirmedAt: p.betConfirmedAt,
    autoThisRound: p.autoThisRound,
  };
}

function restorePlayer(p: SMS2PlayerInternal, snap: SMS2PlayerSnapshot) {
  p.chips = snap.chips;
  p.powderRemain = snap.powderRemain;
  p.markContribution = { ...snap.markContribution };
  p.pendingPowder = snap.pendingPowder ? { ...snap.pendingPowder } : null;
  p.pendingBet = snap.pendingBet ? { ...snap.pendingBet } : null;
  p.powderSubmittedAt = snap.powderSubmittedAt;
  p.betConfirmedAt = snap.betConfirmedAt;
  p.autoThisRound = snap.autoThisRound;
}

function cloneMarkPool(mp: Record<SMS2MarkId, SMS2MarkPool>): Record<SMS2MarkId, SMS2MarkPool> {
  return {
    sun: { ...mp.sun },
    moon: { ...mp.moon },
    star: { ...mp.star },
  };
}

function cloneHistory(h: SMS2RoundRecord[]): SMS2RoundRecord[] {
  return h.map((r) => ({
    ...r,
    powderSubmission: { p1: { ...r.powderSubmission.p1 }, p2: { ...r.powderSubmission.p2 } },
    markTotalsBefore: { ...r.markTotalsBefore },
    markTotalsAfter: { ...r.markTotalsAfter },
    bets: { p1: { ...r.bets.p1 }, p2: { ...r.bets.p2 } },
    chipDelta: { ...r.chipDelta },
    chipAfter: { ...r.chipAfter },
    stageBefore: { ...r.stageBefore },
    stageAfter: { ...r.stageAfter },
    auto: { ...r.auto },
  }));
}

function pushUndoSnapshot(s: SMS2InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    firstPlayerSide: s.firstPlayerSide,
    suddenDeath: s.suddenDeath,
    suddenDeathConsumed: s.suddenDeathConsumed,
    markPool: cloneMarkPool(s.markPool),
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    history: cloneHistory(s.history),
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
  });
  if (s.undoSnapshots.length > 12) s.undoSnapshots.shift();
}

function applySnapshot(s: SMS2InternalState, snap: SMS2UndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.firstPlayerSide = snap.firstPlayerSide;
  s.suddenDeath = snap.suddenDeath;
  s.suddenDeathConsumed = snap.suddenDeathConsumed;
  s.markPool = cloneMarkPool(snap.markPool);
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.history = cloneHistory(snap.history);
  s.consecutiveTimeouts = { ...snap.consecutiveTimeouts };
  s.resolveSteps = [];
  s.lastRoundRecord = null;
}

export function performSMS2Undo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (!s.options.enableUndo) return false;
  if (s.undoSnapshots.length < 1) return false;

  s.aiGeneration += 1;
  clearAllTimers(s);

  const snap = s.undoSnapshots[s.undoSnapshots.length - 1];
  applySnapshot(s, snap);

  if (s.phase === 'powder' || s.phase === 'betFirst' || s.phase === 'betSecond') {
    armInputTimer(io, s);
  }
  void broadcastState(io, s);
  if (s.playMode === 'com' && (s.phase === 'powder' || s.phase === 'betFirst' || s.phase === 'betSecond')) {
    s.onAITurn?.(io, s);
  }
  return true;
}

export function getSunMoonStar2ResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return buildArchiveRecord(s);
}

/* ────────── next round ready (관전/확장용 noop) ────────── */

export function tryNextRoundReady(_io: IO, s: SMS2InternalState, _pid: string): string | null {
  if (s.phase !== 'roundEnd') return '지금은 다음 라운드 준비를 보낼 수 없습니다.';
  void s;
  return null;
}
