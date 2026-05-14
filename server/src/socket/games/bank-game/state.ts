import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  BankBet,
  BankGameData,
  BankPlayerInfo,
  BankResolveStep,
  BankRoundResult,
  BankSide,
  BankWinType,
} from '@shared/types/bank-game.js';
import {
  BANK_TOTAL_ROUNDS,
  BANK_DENOMINATIONS,
  initialInventory,
  subtractInventory,
  sumBetAmount,
  sumBetCount,
  sumInventoryAmount,
  sumInventoryCount,
  validateBet,
  zeroBet,
} from '@shared/types/bank-game.js';
import type {
  BankGameArchiveRecord,
  BankMatchArchiveStats,
  BankPlayerArchiveStats,
  BankRoundArchiveRecord,
} from '@shared/types/archive.js';
import {
  FINAL_RESULT_HOLD_MS,
  FIRST_REVEAL_BANNER_MS,
  RESOLVE_CROWN_DELAY_MS,
  RESOLVE_FINISH_HOLD_MS,
  RESOLVE_FLIP_DELAY_MS,
  RESOLVE_START_DELAY_MS,
  RESOLVE_SUMMARY_DELAY_MS,
  ROUND_END_AUTO_DELAY_MS,
} from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  BankInternalState,
  BankPlayerInternal,
  BankPlayerSnapshot,
  BankRoundFullRecord,
  BankUndoSnapshot,
} from './types.js';
import { resolveRound } from './resolve.js';
import { socketRoom } from '../../utils.js';
import { isPurinInsightViewer } from '../../purin-insight.js';

export const gameStates = new Map<string, BankInternalState>();

/* ────────── helpers ────────── */

export function makePlayer(
  id: string, nickname: string, side: BankSide, isAi: boolean,
): BankPlayerInternal {
  return {
    id,
    nickname,
    side,
    score: 0,
    inventory: initialInventory(),
    pendingBet: null,
    betConfirmedAt: null,
    autoThisRound: false,
    autoZeroForcedThisRound: false,
    isAi,
  };
}

function playerByToken(s: BankInternalState, token: string): BankPlayerInternal | null {
  if (s.player1.id === token) return s.player1;
  if (s.player2.id === token) return s.player2;
  return null;
}

function otherSide(side: BankSide): BankSide {
  return side === 'p1' ? 'p2' : 'p1';
}

function getBySide(s: BankInternalState, side: BankSide): BankPlayerInternal {
  return side === 'p1' ? s.player1 : s.player2;
}

function getFirst(s: BankInternalState): BankPlayerInternal {
  return getBySide(s, s.firstSide);
}

function getSecond(s: BankInternalState): BankPlayerInternal {
  return getBySide(s, otherSide(s.firstSide));
}

function cloneBet(b: BankBet): BankBet {
  return { ...b };
}

/* ────────── broadcasting ────────── */

function phaseMessage(s: BankInternalState): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  const firstNick = getFirst(s).nickname;
  const secondNick = getSecond(s).nickname;
  switch (s.phase) {
    case 'firstSubmit': return `R${s.round}/${s.maxRound} — ${firstNick} (선) 베팅 중...`;
    case 'firstReveal': return `R${s.round} — 선의 장수 공개`;
    case 'secondSubmit': return `R${s.round}/${s.maxRound} — ${secondNick} (후) 베팅 중...`;
    case 'reveal': return `R${s.round} — 정산 중...`;
    case 'roundEnd': return `R${s.round} — 결과`;
    case 'finished': return '게임 종료';
    default: return '';
  }
}

/**
 * 베팅 장수 공개 시점:
 *  - 선 베팅 장수: firstReveal 진입 후 모든 시점
 *  - 후 베팅 장수: 후 베팅 확정 직후
 *  - 라운드 정산 후 (roundEnd, finished)에는 양측 모두 공개
 */
function shouldExposeFirstCount(s: BankInternalState): boolean {
  return (
    s.phase === 'firstReveal' ||
    s.phase === 'secondSubmit' ||
    s.phase === 'reveal' ||
    s.phase === 'roundEnd' ||
    s.phase === 'finished'
  );
}

function shouldExposeSecondCount(s: BankInternalState): boolean {
  return (
    s.phase === 'reveal' ||
    s.phase === 'roundEnd' ||
    s.phase === 'finished'
  );
}

function buildPlayerInfo(
  s: BankInternalState,
  p: BankPlayerInternal,
  viewerSide: BankSide | 'spectator',
): BankPlayerInfo {
  const isMe = viewerSide === p.side;
  const exposeCount = p.side === s.firstSide
    ? shouldExposeFirstCount(s)
    : shouldExposeSecondCount(s);
  const publicBetCount = exposeCount && p.pendingBet
    ? sumBetCount(p.pendingBet)
    : null;

  return {
    id: p.id,
    nickname: p.nickname,
    side: p.side,
    score: p.score,
    inventoryCount: sumInventoryCount(p.inventory),
    inventory: isMe ? cloneBet(p.inventory) : null,
    inventoryAmount: isMe ? sumInventoryAmount(p.inventory) : null,
    betConfirmed: !!p.pendingBet,
    publicBetCount,
    selfBet: isMe && p.pendingBet ? cloneBet(p.pendingBet) : null,
  };
}

function maskRoundResultForViewer(
  full: BankRoundFullRecord,
  viewerSide: BankSide | 'spectator',
  loserAmountThisRound: number | null,
): BankRoundResult {
  const winnerSide = full.outcome === 'draw' ? null
    : full.outcome === 'first_win' ? full.firstSide
    : full.firstSide === 'p1' ? 'p2' : 'p1';
  const loserSide = full.outcome === 'draw' ? null
    : winnerSide === 'p1' ? 'p2' : 'p1';

  const exposeFirst =
    full.outcome === 'draw' ||
    winnerSide !== full.firstSide ||
    viewerSide === full.firstSide;
  const exposeSecond =
    full.outcome === 'draw' ||
    winnerSide !== (full.firstSide === 'p1' ? 'p2' : 'p1') ||
    viewerSide === (full.firstSide === 'p1' ? 'p2' : 'p1');

  return {
    round: full.round,
    firstSide: full.firstSide,
    outcome: full.outcome,
    winnerSide,
    loserSide,
    firstCount: full.counts[full.firstSide],
    secondCount: full.counts[full.firstSide === 'p1' ? 'p2' : 'p1'],
    firstAmount: exposeFirst ? full.amounts[full.firstSide] : null,
    secondAmount: exposeSecond ? full.amounts[full.firstSide === 'p1' ? 'p2' : 'p1'] : null,
    firstAuto: full.auto[full.firstSide],
    secondAuto: full.auto[full.firstSide === 'p1' ? 'p2' : 'p1'],
    scoreAfter: { ...full.scoreAfter },
    scoreDelta: { ...full.scoreDelta },
    loserAmountThisRound,
    inventoryCountAfter: {
      p1: sumInventoryCount(full.inventoryAfter.p1),
      p2: sumInventoryCount(full.inventoryAfter.p2),
    },
  };
}

function maskResolveStepsForViewer(
  steps: BankResolveStep[],
  viewerSide: BankSide | 'spectator',
): BankResolveStep[] {
  return steps.map((step) => {
    if (step.type === 'crownWinner') {
      const isMe = viewerSide === step.side;
      return {
        type: 'crownWinner',
        side: step.side,
        count: step.count,
        ...(isMe && step.privateAmount !== undefined ? { privateAmount: step.privateAmount } : {}),
      };
    }
    return step;
  });
}

function maskRoundResultPurin(full: BankRoundFullRecord): BankRoundResult {
  const winnerSide = full.outcome === 'draw' ? null
    : full.outcome === 'first_win' ? full.firstSide
    : full.firstSide === 'p1' ? 'p2' : 'p1';
  const loserSide = full.outcome === 'draw' ? null
    : winnerSide === 'p1' ? 'p2' : 'p1';
  const secondSide = full.firstSide === 'p1' ? 'p2' : 'p1';
  return {
    round: full.round,
    firstSide: full.firstSide,
    outcome: full.outcome,
    winnerSide,
    loserSide,
    firstCount: full.counts[full.firstSide],
    secondCount: full.counts[secondSide],
    firstAmount: full.amounts[full.firstSide],
    secondAmount: full.amounts[secondSide],
    firstAuto: full.auto[full.firstSide],
    secondAuto: full.auto[secondSide],
    scoreAfter: { ...full.scoreAfter },
    scoreDelta: { ...full.scoreDelta },
    loserAmountThisRound: full.outcome === 'draw'
      ? null
      : full.amounts[full.outcome === 'first_win' ? secondSide : full.firstSide],
    inventoryCountAfter: {
      p1: sumInventoryCount(full.inventoryAfter.p1),
      p2: sumInventoryCount(full.inventoryAfter.p2),
    },
  };
}

function maskResolveStepsPurin(steps: BankResolveStep[]): BankResolveStep[] {
  return steps.map((step) => {
    if (step.type === 'crownWinner') {
      return {
        type: 'crownWinner',
        side: step.side,
        count: step.count,
        ...(step.privateAmount !== undefined ? { privateAmount: step.privateAmount } : {}),
      };
    }
    return step;
  });
}

function applyPurinBank(
  s: BankInternalState,
  token: string,
  viewerSide: BankSide | 'spectator',
  data: BankGameData,
): BankGameData {
  if (viewerSide === 'spectator') return data;
  if (!isPurinInsightViewer(s.playMode, token, s.player1, s.player2)) return data;
  const opp = viewerSide === 'p1' ? s.player2 : s.player1;
  const next: BankGameData = {
    ...data,
    players: {
      ...data.players,
      [opp.id]: buildPlayerInfo(s, opp, opp.side),
    },
    history: s.history.map((full) => maskRoundResultPurin(full)),
  };
  if ((s.phase === 'reveal' || s.phase === 'roundEnd') && s.lastRoundFull) {
    next.roundResult = maskRoundResultPurin(s.lastRoundFull);
  }
  if (s.phase === 'reveal' && s.resolveSteps.length > 0) {
    next.resolveSteps = maskResolveStepsPurin(s.resolveSteps);
  }
  return next;
}

function buildHistoryForViewer(
  s: BankInternalState,
  viewerSide: BankSide | 'spectator',
): BankRoundResult[] {
  return s.history.map((full) => {
    const loserAmount = full.outcome === 'draw'
      ? null
      : full.amounts[full.outcome === 'first_win' ? (full.firstSide === 'p1' ? 'p2' : 'p1') : full.firstSide];
    return maskRoundResultForViewer(full, viewerSide, loserAmount);
  });
}

function buildGameDataForViewer(
  s: BankInternalState,
  viewerSide: BankSide | 'spectator',
): BankGameData {
  const players = {
    p1: buildPlayerInfo(s, s.player1, viewerSide),
    p2: buildPlayerInfo(s, s.player2, viewerSide),
  };

  const data: BankGameData = {
    phase: s.phase,
    round: s.round,
    maxRound: s.maxRound,
    firstSide: s.firstSide,
    players,
    roundResult: null,
    history: buildHistoryForViewer(s, viewerSide),
    loserAmountTotal: s.loserAmountTotal,
    finalWinner: s.finalWinner,
    winType: s.winType,
    isFinalRound: s.round >= s.maxRound,
  };

  if ((s.phase === 'reveal' || s.phase === 'roundEnd') && s.lastRoundFull) {
    const full = s.lastRoundFull;
    const loserAmount = full.outcome === 'draw'
      ? null
      : full.amounts[full.outcome === 'first_win' ? (full.firstSide === 'p1' ? 'p2' : 'p1') : full.firstSide];
    data.roundResult = maskRoundResultForViewer(full, viewerSide, loserAmount);
  }

  if (s.phase === 'reveal' && s.resolveSteps.length > 0) {
    data.resolveSteps = maskResolveStepsForViewer(s.resolveSteps, viewerSide);
  }

  return data;
}

function buildGameState(s: BankInternalState, gameData: BankGameData): GameState {
  const isInputPhase = s.phase === 'firstSubmit' || s.phase === 'secondSubmit';
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: resolveCurrentTurn(s),
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds && isInputPhase ? s.turnStartedAt : null,
    gameData,
  };
}

function resolveCurrentTurn(s: BankInternalState): string | null {
  if (s.phase === 'firstSubmit') return getFirst(s).id;
  if (s.phase === 'secondSubmit') return getSecond(s).id;
  return null;
}

function viewerSideOf(s: BankInternalState, token: string): BankSide | 'spectator' {
  if (s.player1.id === token) return 'p1';
  if (s.player2.id === token) return 'p2';
  return 'spectator';
}

export async function broadcastState(io: IO, s: BankInternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const token = sessions.getToken(sock.id) ?? sock.id;
    const viewerSide = viewerSideOf(s, token);
    let data = buildGameDataForViewer(s, viewerSide);
    data = applyPurinBank(s, token, viewerSide, data);
    if (viewerSide !== 'spectator' && isPurinInsightViewer(s.playMode, token, s.player1, s.player2)) {
      if ((s.phase === 'reveal' || s.phase === 'roundEnd') && s.lastRoundFull) {
        sock.emit('ext:data', { game: 'bank-game', round: s.round, roundResult: maskRoundResultPurin(s.lastRoundFull) });
      } else if (s.phase === 'firstReveal' || s.phase === 'secondSubmit') {
        const first = getFirst(s);
        if (first.id !== token && first.pendingBet) {
          sock.emit('ext:data', { game: 'bank-game', round: s.round, phase: s.phase, opponent: first.nickname, bet: first.pendingBet, amount: sumBetAmount(first.pendingBet), count: sumBetCount(first.pendingBet) });
        }
      }
    }
    sock.emit('game:state', buildGameState(s, data));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: BankInternalState) {
  const token = sessions.getToken(socket.id) ?? socket.id;
  const viewerSide = viewerSideOf(s, token);
  let data = buildGameDataForViewer(s, viewerSide);
  data = applyPurinBank(s, token, viewerSide, data);
  if (viewerSide !== 'spectator' && isPurinInsightViewer(s.playMode, token, s.player1, s.player2)) {
    if ((s.phase === 'reveal' || s.phase === 'roundEnd') && s.lastRoundFull) {
      socket.emit('ext:data', { game: 'bank-game', round: s.round, roundResult: maskRoundResultPurin(s.lastRoundFull) });
    } else if (s.phase === 'firstReveal' || s.phase === 'secondSubmit') {
      const first = getFirst(s);
      if (first.id !== token && first.pendingBet) {
        socket.emit('ext:data', { game: 'bank-game', round: s.round, phase: s.phase, opponent: first.nickname, bet: first.pendingBet, amount: sumBetAmount(first.pendingBet), count: sumBetCount(first.pendingBet) });
      }
    }
  }
  socket.emit('game:state', buildGameState(s, data));
}

/* ────────── timers ────────── */

export function clearAllTimers(s: BankInternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  if (s.firstRevealTimer) { clearTimeout(s.firstRevealTimer); s.firstRevealTimer = null; }
  if (s.resolveTimer) { clearTimeout(s.resolveTimer); s.resolveTimer = null; }
  if (s.nextRoundTimer) { clearTimeout(s.nextRoundTimer); s.nextRoundTimer = null; }
}

function armInputTimer(io: IO, s: BankInternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  if (!s.timeLimitSeconds) {
    s.roundDeadline = null;
    return;
  }
  s.turnStartedAt = Date.now();
  s.roundDeadline = s.turnStartedAt + s.timeLimitSeconds * 1000;
  s.roundTimer = setTimeout(() => handleTimeout(io, s), s.timeLimitSeconds * 1000);
}

/* ────────── round lifecycle ────────── */

export function startRound(io: IO, s: BankInternalState) {
  if (s.gameOver) return;

  s.player1.pendingBet = null;
  s.player1.betConfirmedAt = null;
  s.player1.autoThisRound = false;
  s.player1.autoZeroForcedThisRound = false;
  s.player2.pendingBet = null;
  s.player2.betConfirmedAt = null;
  s.player2.autoThisRound = false;
  s.player2.autoZeroForcedThisRound = false;

  s.phase = 'firstSubmit';
  s.resolveSteps = [];
  s.lastRoundResult = null;
  s.lastRoundFull = null;

  pushUndoSnapshot(s);

  // 선 잔여가 0장이면 자동 0장 제출 → firstReveal 즉시 전환
  const first = getFirst(s);
  if (sumInventoryCount(first.inventory) === 0) {
    first.pendingBet = zeroBet();
    first.betConfirmedAt = Date.now();
    first.autoZeroForcedThisRound = true;
    proceedFromFirstSubmit(io, s);
    return;
  }

  armInputTimer(io, s);
  void broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── 베팅 제출 ────────── */

export function trySubmitBet(
  io: IO, s: BankInternalState, playerId: string,
  bet: BankBet,
): string | null {
  if (s.gameOver) return '게임이 종료되었습니다.';
  if (s.phase !== 'firstSubmit' && s.phase !== 'secondSubmit') {
    return '지금은 베팅할 수 있는 단계가 아닙니다.';
  }

  const player = playerByToken(s, playerId);
  if (!player) return null;

  const expected = s.phase === 'firstSubmit' ? getFirst(s) : getSecond(s);
  if (player !== expected) return '본인 턴이 아닙니다.';
  if (player.pendingBet) return '이미 베팅했습니다.';

  const parsed = parseBet(bet);
  if (!parsed) return '베팅 값이 올바르지 않습니다.';

  const v = validateBet(parsed, player.inventory);
  if (!v.ok) return v.reason;

  player.pendingBet = parsed;
  player.betConfirmedAt = Date.now();
  resetTimeout(s, player.id);

  if (s.phase === 'firstSubmit') {
    proceedFromFirstSubmit(io, s);
  } else {
    proceedFromSecondSubmit(io, s);
  }
  return null;
}

function parseBet(b: unknown): BankBet | null {
  if (!b || typeof b !== 'object') return null;
  const result: BankBet = zeroBet();
  for (const d of BANK_DENOMINATIONS) {
    const v = (b as Record<string, unknown>)[String(d)];
    if (v == null) {
      result[d] = 0;
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
      return null;
    }
    result[d] = v;
  }
  return result;
}

export function tryCancelBet(
  io: IO, s: BankInternalState, playerId: string,
): string | null {
  if (s.gameOver) return '게임이 종료되었습니다.';
  if (s.phase !== 'firstSubmit' && s.phase !== 'secondSubmit') {
    return '지금은 취소할 수 없습니다.';
  }
  const player = playerByToken(s, playerId);
  if (!player || !player.pendingBet) return '확정한 베팅이 없습니다.';

  // firstSubmit/secondSubmit 단계에서, 본인이 막 확정해 phase 전환되기 전에만 취소 가능.
  // 실제로는 trySubmitBet 직후 즉시 다음 페이즈로 넘어가므로 이 가드는 거의 호출되지 않는다.
  player.pendingBet = null;
  player.betConfirmedAt = null;
  void broadcastState(io, s);
  return null;
}

/* ────────── firstSubmit → firstReveal ────────── */

function proceedFromFirstSubmit(io: IO, s: BankInternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  s.roundDeadline = null;

  s.phase = 'firstReveal';
  void broadcastState(io, s);

  const gen = s.aiGeneration;
  s.firstRevealTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    enterSecondSubmit(io, s);
  }, FIRST_REVEAL_BANNER_MS);
}

function enterSecondSubmit(io: IO, s: BankInternalState) {
  s.firstRevealTimer = null;
  s.phase = 'secondSubmit';

  // 후 잔여가 0장이면 자동 0장 제출 → reveal 즉시 진입
  const second = getSecond(s);
  if (sumInventoryCount(second.inventory) === 0) {
    second.pendingBet = zeroBet();
    second.betConfirmedAt = Date.now();
    second.autoZeroForcedThisRound = true;
    proceedFromSecondSubmit(io, s);
    return;
  }

  armInputTimer(io, s);
  void broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── secondSubmit → reveal ────────── */

function proceedFromSecondSubmit(io: IO, s: BankInternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  s.roundDeadline = null;

  const first = getFirst(s);
  const second = getSecond(s);
  const firstBet = first.pendingBet ?? zeroBet();
  const secondBet = second.pendingBet ?? zeroBet();

  const inventoryBefore = {
    p1: cloneBet(s.player1.inventory),
    p2: cloneBet(s.player2.inventory),
  };

  // 인벤토리 차감 (제출 즉시 영구 회수)
  s.player1.inventory = subtractInventory(
    s.player1.inventory,
    s.firstSide === 'p1' ? firstBet : secondBet,
  );
  s.player2.inventory = subtractInventory(
    s.player2.inventory,
    s.firstSide === 'p2' ? firstBet : secondBet,
  );

  const inventoryAfter = {
    p1: cloneBet(s.player1.inventory),
    p2: cloneBet(s.player2.inventory),
  };

  const result = resolveRound({
    firstSide: s.firstSide,
    firstBet,
    secondBet,
    scoreBefore: { p1: s.player1.score, p2: s.player2.score },
    inventoryTotalAfter: {
      p1: sumInventoryCount(s.player1.inventory),
      p2: sumInventoryCount(s.player2.inventory),
    },
  });

  s.player1.score = result.scoreAfter.p1;
  s.player2.score = result.scoreAfter.p2;

  if (result.loserAmount !== null) {
    s.loserAmountTotal += result.loserAmount;
  }

  const counts = {
    p1: sumBetCount(s.firstSide === 'p1' ? firstBet : secondBet),
    p2: sumBetCount(s.firstSide === 'p2' ? firstBet : secondBet),
  };
  const amounts = {
    p1: sumBetAmount(s.firstSide === 'p1' ? firstBet : secondBet),
    p2: sumBetAmount(s.firstSide === 'p2' ? firstBet : secondBet),
  };

  const fullRecord: BankRoundFullRecord = {
    round: s.round,
    firstSide: s.firstSide,
    outcome: result.outcome,
    bets: {
      p1: cloneBet(s.firstSide === 'p1' ? firstBet : secondBet),
      p2: cloneBet(s.firstSide === 'p2' ? firstBet : secondBet),
    },
    amounts,
    counts,
    scoreDelta: result.scoreDelta,
    scoreAfter: result.scoreAfter,
    inventoryBefore,
    inventoryAfter,
    auto: {
      p1: s.player1.autoThisRound || s.player1.autoZeroForcedThisRound,
      p2: s.player2.autoThisRound || s.player2.autoZeroForcedThisRound,
    },
  };

  s.history.push(fullRecord);
  s.lastRoundFull = fullRecord;
  s.resolveSteps = result.steps;
  s.phase = 'reveal';

  void broadcastState(io, s);

  // 정산 애니메이션 → roundEnd
  const animMs =
    RESOLVE_START_DELAY_MS +
    RESOLVE_FLIP_DELAY_MS +
    RESOLVE_CROWN_DELAY_MS +
    RESOLVE_SUMMARY_DELAY_MS +
    RESOLVE_FINISH_HOLD_MS;
  const gen = s.aiGeneration;
  s.resolveTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    enterRoundEnd(io, s);
  }, animMs);
}

function checkEarlyWin(s: BankInternalState): BankSide | null {
  const remainingRounds = s.maxRound - s.round;
  const p1 = s.player1;
  const p2 = s.player2;
  if (p1.score > p2.score + remainingRounds) return 'p1';
  if (p2.score > p1.score + remainingRounds) return 'p2';
  return null;
}

function enterRoundEnd(io: IO, s: BankInternalState) {
  s.phase = 'roundEnd';
  void broadcastState(io, s);

  const earlyWinner = checkEarlyWin(s);
  if (earlyWinner) {
    const gen = s.aiGeneration;
    s.nextRoundTimer = setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      finalizeGame(io, s, earlyWinner, 'score');
    }, ROUND_END_AUTO_DELAY_MS);
    return;
  }

  const isLastRound = s.round >= s.maxRound;
  if (isLastRound) {
    const gen = s.aiGeneration;
    s.nextRoundTimer = setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      concludeAfterFinalRound(io, s);
    }, ROUND_END_AUTO_DELAY_MS);
    return;
  }

  const gen = s.aiGeneration;
  s.nextRoundTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceToNextRound(io, s);
  }, ROUND_END_AUTO_DELAY_MS);
}

function advanceToNextRound(io: IO, s: BankInternalState) {
  s.round += 1;
  s.firstSide = otherSide(s.firstSide);
  startRound(io, s);
}

/* ────────── 종료 처리 ────────── */

function concludeAfterFinalRound(io: IO, s: BankInternalState) {
  if (s.player1.score === s.player2.score) {
    finalizeGame(io, s, 'draw', 'draw');
    return;
  }
  const winner: BankSide = s.player1.score > s.player2.score ? 'p1' : 'p2';
  finalizeGame(io, s, winner, 'score');
}

export function finalizeGame(
  io: IO, s: BankInternalState,
  winner: BankSide | 'draw',
  winType: BankWinType,
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
      { playerId: winnerPlayer.id, nickname: winnerPlayer.nickname, rank: 1, score: winnerPlayer.score },
      { playerId: loserPlayer.id, nickname: loserPlayer.nickname, rank: 2, score: loserPlayer.score },
    ];
  } else {
    rankings = [
      { playerId: s.player1.id, nickname: s.player1.nickname, rank: 1, score: s.player1.score },
      { playerId: s.player2.id, nickname: s.player2.nickname, rank: 1, score: s.player2.score },
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

function emptyPlayerStats(): BankPlayerArchiveStats {
  return {
    avgBetAmount: 0,
    avgBetCount: 0,
    avgUnitPrice: 0,
    usageByDenomination: { 1000: 0, 3000: 0, 5000: 0, 10000: 0 },
    zeroBetRounds: 0,
    autoRounds: 0,
    firstRounds: 0,
    winRounds: 0,
    loserAmountTotal: 0,
    avgWinningMargin: 0,
  };
}

function buildArchiveRecord(s: BankInternalState): BankGameArchiveRecord {
  const sides: BankSide[] = ['p1', 'p2'];
  const playerStats = {
    p1: emptyPlayerStats(),
    p2: emptyPlayerStats(),
  };
  let bothZeroRounds = 0;
  let drawRounds = 0;
  let largestMargin = 0;
  let smallestMargin = Number.POSITIVE_INFINITY;
  let totalMarginSum = 0;
  let marginCount = 0;
  const winningMarginByPlayer: Record<BankSide, number[]> = { p1: [], p2: [] };
  const loserAmountTrend: number[] = [];
  const inventoryCountTrend: { p1: number[]; p2: number[] } = { p1: [], p2: [] };
  const inventoryAmountTrend: { p1: number[]; p2: number[] } = { p1: [], p2: [] };
  const scoreTrend: { p1: number[]; p2: number[] } = { p1: [], p2: [] };
  let runningLoserTotal = 0;

  const rounds: BankRoundArchiveRecord[] = s.history.map((full) => {
    const firstSide = full.firstSide;
    const secondSide: BankSide = firstSide === 'p1' ? 'p2' : 'p1';
    playerStats[firstSide].firstRounds += 1;

    for (const side of sides) {
      const bet = full.bets[side];
      for (const d of BANK_DENOMINATIONS) {
        playerStats[side].usageByDenomination[d] += bet[d];
      }
      if (sumBetCount(bet) === 0) playerStats[side].zeroBetRounds += 1;
      if (full.auto[side]) playerStats[side].autoRounds += 1;
    }

    if (full.outcome === 'draw') {
      drawRounds += 1;
      if (sumBetCount(full.bets.p1) === 0 && sumBetCount(full.bets.p2) === 0) {
        bothZeroRounds += 1;
      }
    } else {
      const winner = full.outcome === 'first_win' ? firstSide : secondSide;
      const loser = winner === 'p1' ? 'p2' : 'p1';
      const margin = full.amounts[winner] - full.amounts[loser];
      if (margin > largestMargin) largestMargin = margin;
      if (margin > 0 && margin < smallestMargin) smallestMargin = margin;
      totalMarginSum += margin;
      marginCount += 1;
      winningMarginByPlayer[winner].push(margin);
      playerStats[winner].winRounds += 1;
      playerStats[loser].loserAmountTotal += full.amounts[loser];
      runningLoserTotal += full.amounts[loser];
    }

    loserAmountTrend.push(runningLoserTotal);
    inventoryCountTrend.p1.push(sumInventoryCount(full.inventoryAfter.p1));
    inventoryCountTrend.p2.push(sumInventoryCount(full.inventoryAfter.p2));
    inventoryAmountTrend.p1.push(sumInventoryAmount(full.inventoryAfter.p1));
    inventoryAmountTrend.p2.push(sumInventoryAmount(full.inventoryAfter.p2));
    scoreTrend.p1.push(full.scoreAfter.p1);
    scoreTrend.p2.push(full.scoreAfter.p2);

    return {
      round: full.round,
      firstSide,
      outcome: full.outcome,
      winnerSide: full.outcome === 'draw' ? null : (full.outcome === 'first_win' ? firstSide : secondSide),
      loserSide: full.outcome === 'draw' ? null : (full.outcome === 'first_win' ? secondSide : firstSide),
      bets: { p1: cloneBet(full.bets.p1), p2: cloneBet(full.bets.p2) },
      amounts: { ...full.amounts },
      counts: { ...full.counts },
      scoreDelta: { ...full.scoreDelta },
      scoreAfter: { ...full.scoreAfter },
      inventoryBefore: {
        p1: cloneBet(full.inventoryBefore.p1),
        p2: cloneBet(full.inventoryBefore.p2),
      },
      inventoryAfter: {
        p1: cloneBet(full.inventoryAfter.p1),
        p2: cloneBet(full.inventoryAfter.p2),
      },
      inventoryTotalCountBefore: {
        p1: sumInventoryCount(full.inventoryBefore.p1),
        p2: sumInventoryCount(full.inventoryBefore.p2),
      },
      inventoryTotalCountAfter: {
        p1: sumInventoryCount(full.inventoryAfter.p1),
        p2: sumInventoryCount(full.inventoryAfter.p2),
      },
      inventoryTotalAmountBefore: {
        p1: sumInventoryAmount(full.inventoryBefore.p1),
        p2: sumInventoryAmount(full.inventoryBefore.p2),
      },
      inventoryTotalAmountAfter: {
        p1: sumInventoryAmount(full.inventoryAfter.p1),
        p2: sumInventoryAmount(full.inventoryAfter.p2),
      },
      auto: { ...full.auto },
    };
  });

  // playerStats 평균값 계산
  for (const side of sides) {
    const totalAmount = rounds.reduce((sum, r) => sum + r.amounts[side], 0);
    const totalCount = rounds.reduce((sum, r) => sum + r.counts[side], 0);
    const n = rounds.length || 1;
    playerStats[side].avgBetAmount = Math.round(totalAmount / n);
    playerStats[side].avgBetCount = Math.round((totalCount / n) * 100) / 100;
    playerStats[side].avgUnitPrice = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;
    const wins = winningMarginByPlayer[side];
    playerStats[side].avgWinningMargin = wins.length > 0
      ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length)
      : 0;
  }

  const matchStats: BankMatchArchiveStats = {
    totalRounds: rounds.length,
    drawRounds,
    bothZeroRounds,
    largestMargin,
    smallestMargin: smallestMargin === Number.POSITIVE_INFINITY ? 0 : smallestMargin,
    avgMargin: marginCount > 0 ? Math.round(totalMarginSum / marginCount) : 0,
    loserAmountTrend,
    inventoryCountTrend,
    inventoryAmountTrend,
    scoreTrend,
  };

  const winnerId =
    s.finalWinner === 'p1' ? s.player1.id :
    s.finalWinner === 'p2' ? s.player2.id : null;

  return {
    winType: s.winType,
    winnerId,
    finalScore: { p1: s.player1.score, p2: s.player2.score },
    finalInventory: {
      p1: cloneBet(s.player1.inventory),
      p2: cloneBet(s.player2.inventory),
    },
    finalInventoryTotalCount: {
      p1: sumInventoryCount(s.player1.inventory),
      p2: sumInventoryCount(s.player2.inventory),
    },
    finalInventoryTotalAmount: {
      p1: sumInventoryAmount(s.player1.inventory),
      p2: sumInventoryAmount(s.player2.inventory),
    },
    totalRounds: s.history.length,
    sides: { p1: s.player1.id, p2: s.player2.id },
    rounds,
    playerStats,
    matchStats,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
    finishReason: s.finishReason,
  };
}

/* ────────── timeout / 자동 제출 ────────── */

function handleTimeout(io: IO, s: BankInternalState) {
  if (s.gameOver) return;
  s.roundTimer = null;

  if (s.phase === 'firstSubmit') {
    const first = getFirst(s);
    if (first.pendingBet) return;
    trackTimeout(s, first.id);
    if (shouldForceEnd(s, first.id)) {
      const opp = first === s.player1 ? s.player2 : s.player1;
      s.finishReason = `${first.nickname} 연속 시간 초과`;
      finalizeGame(io, s, opp.side, 'timeout');
      return;
    }
    first.pendingBet = zeroBet();
    first.betConfirmedAt = Date.now();
    first.autoThisRound = true;
    proceedFromFirstSubmit(io, s);
    return;
  }

  if (s.phase === 'secondSubmit') {
    const second = getSecond(s);
    if (second.pendingBet) return;
    trackTimeout(s, second.id);
    if (shouldForceEnd(s, second.id)) {
      const opp = second === s.player1 ? s.player2 : s.player1;
      s.finishReason = `${second.nickname} 연속 시간 초과`;
      finalizeGame(io, s, opp.side, 'timeout');
      return;
    }
    second.pendingBet = zeroBet();
    second.betConfirmedAt = Date.now();
    second.autoThisRound = true;
    proceedFromSecondSubmit(io, s);
    return;
  }
}

function trackTimeout(s: BankInternalState, pid: string) {
  s.consecutiveTimeouts[pid] = (s.consecutiveTimeouts[pid] ?? 0) + 1;
}

function shouldForceEnd(s: BankInternalState, pid: string): boolean {
  return (s.consecutiveTimeouts[pid] ?? 0) >= 3;
}

export function resetTimeout(s: BankInternalState, pid: string) {
  s.consecutiveTimeouts[pid] = 0;
}

/* ────────── undo snapshots ────────── */

function snapshotPlayer(p: BankPlayerInternal): BankPlayerSnapshot {
  return {
    score: p.score,
    inventory: cloneBet(p.inventory),
    pendingBet: p.pendingBet ? cloneBet(p.pendingBet) : null,
    betConfirmedAt: p.betConfirmedAt,
    autoThisRound: p.autoThisRound,
    autoZeroForcedThisRound: p.autoZeroForcedThisRound,
  };
}

function restorePlayer(p: BankPlayerInternal, snap: BankPlayerSnapshot) {
  p.score = snap.score;
  p.inventory = cloneBet(snap.inventory);
  p.pendingBet = snap.pendingBet ? cloneBet(snap.pendingBet) : null;
  p.betConfirmedAt = snap.betConfirmedAt;
  p.autoThisRound = snap.autoThisRound;
  p.autoZeroForcedThisRound = snap.autoZeroForcedThisRound;
}

function cloneHistory(h: BankRoundFullRecord[]): BankRoundFullRecord[] {
  return h.map((r) => ({
    ...r,
    bets: { p1: cloneBet(r.bets.p1), p2: cloneBet(r.bets.p2) },
    amounts: { ...r.amounts },
    counts: { ...r.counts },
    scoreDelta: { ...r.scoreDelta },
    scoreAfter: { ...r.scoreAfter },
    inventoryBefore: {
      p1: cloneBet(r.inventoryBefore.p1),
      p2: cloneBet(r.inventoryBefore.p2),
    },
    inventoryAfter: {
      p1: cloneBet(r.inventoryAfter.p1),
      p2: cloneBet(r.inventoryAfter.p2),
    },
    auto: { ...r.auto },
  }));
}

function pushUndoSnapshot(s: BankInternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    firstSide: s.firstSide,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    history: cloneHistory(s.history),
    loserAmountTotal: s.loserAmountTotal,
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
  });
  if (s.undoSnapshots.length > 12) s.undoSnapshots.shift();
}

function applySnapshot(s: BankInternalState, snap: BankUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.firstSide = snap.firstSide;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.history = cloneHistory(snap.history);
  s.loserAmountTotal = snap.loserAmountTotal;
  s.consecutiveTimeouts = { ...snap.consecutiveTimeouts };
  s.resolveSteps = [];
  s.lastRoundFull = null;
  s.lastRoundResult = null;
}

export function performBankUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (!s.options.enableUndo) return false;
  if (s.undoSnapshots.length < 2) return false;

  s.aiGeneration += 1;
  clearAllTimers(s);

  s.undoSnapshots.pop();
  const snap = s.undoSnapshots[s.undoSnapshots.length - 1];
  applySnapshot(s, snap);

  if (s.phase === 'firstSubmit' || s.phase === 'secondSubmit') {
    armInputTimer(io, s);
  }
  void broadcastState(io, s);
  if (s.playMode === 'com' && (s.phase === 'firstSubmit' || s.phase === 'secondSubmit')) {
    s.onAITurn?.(io, s);
  }
  return true;
}

/* ────────── next round ready / skip reveal ────────── */

export function tryNextRoundReady(io: IO, s: BankInternalState, _pid: string): string | null {
  void _pid;
  if (s.gameOver) return '게임이 종료되었습니다.';
  if (s.phase !== 'roundEnd') return '지금은 다음 라운드 준비를 보낼 수 없습니다.';

  // 즉시 다음 라운드 진행
  if (s.nextRoundTimer) { clearTimeout(s.nextRoundTimer); s.nextRoundTimer = null; }
  const earlyWinner = checkEarlyWin(s);
  if (earlyWinner) {
    finalizeGame(io, s, earlyWinner, 'score');
  } else if (s.round >= s.maxRound) {
    concludeAfterFinalRound(io, s);
  } else {
    advanceToNextRound(io, s);
  }
  return null;
}

export function trySkipReveal(io: IO, s: BankInternalState, _pid: string): string | null {
  void _pid;
  if (s.gameOver) return '게임이 종료되었습니다.';
  if (s.phase === 'reveal') {
    if (s.resolveTimer) { clearTimeout(s.resolveTimer); s.resolveTimer = null; }
    enterRoundEnd(io, s);
    return null;
  }
  if (s.phase === 'firstReveal') {
    if (s.firstRevealTimer) { clearTimeout(s.firstRevealTimer); s.firstRevealTimer = null; }
    enterSecondSubmit(io, s);
    return null;
  }
  return '지금은 건너뛸 수 없습니다.';
}

export function getBankGameResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return buildArchiveRecord(s);
}
