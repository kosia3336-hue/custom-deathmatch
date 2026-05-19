import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  GS2GameData, GS2CardId, GS2RoundRecord, GS2Side,
  GS2PlayerPublic, GS2WinType, GS2PlayerAction,
} from '@shared/types/grape-sugar-2.js';
import {
  CARD_IDS, GS2_INITIAL_SUGAR, GS2_TOTAL_ROUNDS,
} from '@shared/types/grape-sugar-2.js';
import type { GrapeSugar2ArchiveRecord, GrapeSugar2Stage } from '@shared/types/archive.js';
import {
  FINAL_RESULT_HOLD_MS, NEXT_ROUND_AUTO_DELAY_MS,
  RESOLVE_STEP_DELAY_MS, REVEAL_BASE_DELAY_MS, ROUND_END_HOLD_MS,
} from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  GS2InternalState, GS2PlayerInternal, GS2PlayerSnapshot, GS2UndoSnapshot,
} from './types.js';
import { resolveRound } from './resolve.js';
import { socketRoom } from '../../utils.js';
import { isPurinInsightViewer } from '../../purin-insight.js';

export const gameStates = new Map<string, GS2InternalState>();

/* ────────── helpers ────────── */

export function makePlayer(
  id: string, nickname: string, side: GS2Side, isAi: boolean,
): GS2PlayerInternal {
  return {
    id,
    nickname,
    side,
    score: 0,
    sugarRemain: GS2_INITIAL_SUGAR,
    hand: [...CARD_IDS],
    pendingCard: null,
    pendingSugar: 0,
    submitted: false,
    hrPenaltyPending: 0,
    isAi,
    breathUsed: false,
  };
}

function playerToPublic(p: GS2PlayerInternal): GS2PlayerPublic {
  return {
    id: p.id,
    nickname: p.nickname,
    side: p.side,
    score: p.score,
    sugarRemain: p.sugarRemain,
    hand: [...p.hand],
    submitted: p.submitted,
    hrPenaltyPending: p.hrPenaltyPending,
  };
}

function playerByToken(s: GS2InternalState, token: string): GS2PlayerInternal | null {
  if (s.player1.id === token) return s.player1;
  if (s.player2.id === token) return s.player2;
  return null;
}

function actionOf(p: GS2PlayerInternal): GS2PlayerAction {
  return {
    card: (p.pendingCard ?? 'noAction') as GS2CardId,
    sugar: Math.max(0, Math.floor(p.pendingSugar)),
  };
}

/* ────────── broadcasting ────────── */

function phaseMessage(s: GS2InternalState): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  switch (s.phase) {
    case 'input': {
      const p1 = s.player1.submitted;
      const p2 = s.player2.submitted;
      const ext = s.extension > 0 ? `${s.extension}차 연장 ` : '';
      if (p1 && p2) return `${ext}R${s.round} — 양측 제출 완료`;
      if (p1 || p2) return `${ext}R${s.round} — 상대 제출 대기 중...`;
      return `${ext}R${s.round} / ${s.maxRound} — 카드와 설탕을 선택하세요`;
    }
    case 'reveal': return `R${s.round} — 정산 중...`;
    case 'roundEnd': return `R${s.round} — 결과`;
    case 'extensionIntro': return `${s.extension}차 연장전 시작!`;
    case 'finished': return '게임 종료';
    default: return '';
  }
}

function buildGameDataForPlayer(s: GS2InternalState, pid: string): GS2GameData {
  const players = {
    p1: playerToPublic(s.player1),
    p2: playerToPublic(s.player2),
  };

  const isPlayer1 = s.player1.id === pid;
  const isPlayer2 = s.player2.id === pid;
  const me = isPlayer1 ? s.player1 : isPlayer2 ? s.player2 : null;
  const purin = !!me && isPurinInsightViewer(s.playMode, pid, s.player1, s.player2);

  const data: GS2GameData = {
    phase: s.phase,
    round: s.round,
    maxRound: s.maxRound,
    extension: s.extension,
    players,
    history: s.history.map((r) => ({ ...r, steps: [...r.steps] })),
    finalWinner: s.finalWinner,
    winType: s.winType,
    isFinalRound: s.round >= s.maxRound,
  };

  if (me && !me.submitted && (s.phase === 'input')) {
    data.selfPending = {
      card: me.pendingCard,
      sugar: me.pendingSugar,
    };
  }

  if (purin && me && s.phase === 'input') {
    const opp = me.id === s.player1.id ? s.player2 : s.player1;
    (data as GS2GameData & { _purin?: { opponentPending: { card: typeof opp.pendingCard; sugar: number } } })._purin = {
      opponentPending: { card: opp.pendingCard, sugar: opp.pendingSugar },
    };
  }

  if (s.phase === 'reveal' && s.resolveSteps.length > 0) {
    data.resolveSteps = [...s.resolveSteps];
  }

  if (s.phase === 'roundEnd' && s.lastRoundRecord) {
    data.roundResult = { ...s.lastRoundRecord, steps: [...s.lastRoundRecord.steps] };
    // resolveSteps는 클라이언트가 reveal 페이즈에서 이미 수신했으므로 재전송하지 않음.
    // 클라이언트는 ref로 steps를 보존하여 roundEnd에서도 계속 표시함.
  }

  return data;
}

function buildGameState(s: GS2InternalState, gameData: GS2GameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: null,
    turnNumber: s.round + s.extension * 100,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds && s.phase === 'input' ? s.turnStartedAt : null,
    gameData,
  };
}

export async function broadcastState(io: IO, s: GS2InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const data = buildGameDataForPlayer(s, pid);
    const raw = data as Record<string, unknown>;
    const ext = raw['_purin'];
    if (ext !== undefined) { delete raw['_purin']; sock.emit('ext:data', ext); }
    sock.emit('game:state', buildGameState(s, data));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: GS2InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const data = buildGameDataForPlayer(s, pid);
  const raw = data as Record<string, unknown>;
  const ext = raw['_purin'];
  if (ext !== undefined) { delete raw['_purin']; socket.emit('ext:data', ext); }
  socket.emit('game:state', buildGameState(s, data));
}

/* ────────── timers ────────── */

export function clearAllTimers(s: GS2InternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  if (s.resolveTimer) { clearTimeout(s.resolveTimer); s.resolveTimer = null; }
  if (s.nextRoundTimer) { clearTimeout(s.nextRoundTimer); s.nextRoundTimer = null; }
}

function armRoundTimer(io: IO, s: GS2InternalState) {
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

export function startRound(io: IO, s: GS2InternalState) {
  if (s.gameOver) return;

  // 양측 hrPenaltyPending → 라운드 시작 시 sugar 이전
  applyHrPenaltyTransfer(s, 'p1');
  applyHrPenaltyTransfer(s, 'p2');

  s.player1.pendingCard = null;
  s.player1.pendingSugar = 0;
  s.player1.submitted = false;
  s.player2.pendingCard = null;
  s.player2.pendingSugar = 0;
  s.player2.submitted = false;

  s.phase = 'input';
  s.resolveSteps = [];
  s.lastRoundRecord = null;

  pushUndoSnapshot(s);
  armRoundTimer(io, s);
  void broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

function applyHrPenaltyTransfer(s: GS2InternalState, side: GS2Side) {
  const p = side === 'p1' ? s.player1 : s.player2;
  if (p.hrPenaltyPending <= 0) return;
  const opp = side === 'p1' ? s.player2 : s.player1;
  const transfer = Math.min(p.hrPenaltyPending, p.sugarRemain);
  p.sugarRemain -= transfer;
  opp.sugarRemain += transfer;
  p.hrPenaltyPending = 0;
}

/* ────────── submit ────────── */

export function trySubmit(
  io: IO, s: GS2InternalState, playerId: string,
  card: GS2CardId, sugar: number,
): string | null {
  if (s.phase !== 'input') return '지금은 제출할 수 있는 단계가 아닙니다.';
  if (s.gameOver) return '게임이 종료되었습니다.';

  const player = playerByToken(s, playerId);
  if (!player) return null;
  if (player.submitted) return '이미 제출했습니다.';

  if (!CARD_IDS.includes(card)) return '올바른 카드가 아닙니다.';
  if (!player.hand.includes(card)) return '해당 카드를 보유하고 있지 않습니다.';

  if (!Number.isFinite(sugar) || !Number.isInteger(sugar) || sugar < 0) {
    return '설탕은 0 이상 정수여야 합니다.';
  }
  if (sugar > player.sugarRemain) {
    return `설탕이 부족합니다. (보유 ${player.sugarRemain})`;
  }

  player.pendingCard = card;
  player.pendingSugar = sugar;
  player.submitted = true;
  resetTimeout(s, player.id);

  const opp = player === s.player1 ? s.player2 : s.player1;
  if (opp.submitted) {
    proceedToResolve(io, s);
  } else {
    void broadcastState(io, s);
  }
  return null;
}

export function tryCancelSubmit(
  io: IO, s: GS2InternalState, playerId: string,
): string | null {
  if (s.phase !== 'input') return '지금은 취소할 수 없습니다.';
  const player = playerByToken(s, playerId);
  if (!player || !player.submitted) return '제출하지 않은 상태입니다.';
  const opp = player === s.player1 ? s.player2 : s.player1;
  if (opp.submitted) return '상대도 이미 제출하여 취소할 수 없습니다.';
  player.pendingCard = null;
  player.pendingSugar = 0;
  player.submitted = false;
  void broadcastState(io, s);
  return null;
}

/* ────────── resolve ────────── */

function proceedToResolve(io: IO, s: GS2InternalState) {
  if (s.roundTimer) { clearTimeout(s.roundTimer); s.roundTimer = null; }
  s.roundDeadline = null;

  const actA = actionOf(s.player1);
  const actB = actionOf(s.player2);

  // 보유 자원에서 카드/설탕 소모 (카드는 hand에서 제거, 설탕도 차감)
  s.player1.hand = s.player1.hand.filter((c) => c !== actA.card);
  s.player2.hand = s.player2.hand.filter((c) => c !== actB.card);
  s.player1.sugarRemain = Math.max(0, s.player1.sugarRemain - actA.sugar);
  s.player2.sugarRemain = Math.max(0, s.player2.sugarRemain - actB.sugar);

  const breathAvailable = !(s.player1.breathUsed || s.player2.breathUsed);
  const isFinalRound = s.round >= s.maxRound;

  const result = resolveRound(actA, actB, { breathAvailable, isFinalRound });

  // breath 연장이 실제 적용됐을 때만 maxRound·breathUsed 갱신 (우주뿌셔! 무효 등은 소모 처리 안 함)
  if (result.breathExtended) {
    s.maxRound = 9;
    s.player1.breathUsed = true;
    s.player2.breathUsed = true;
  }

  // 점수 변동 적용
  s.player1.score += result.scoreDelta.p1;
  s.player2.score += result.scoreDelta.p2;

  // 하이리스크 패널티 예약
  s.player1.hrPenaltyPending = result.hrPenaltyScheduled.p1;
  s.player2.hrPenaltyPending = result.hrPenaltyScheduled.p2;

  const record: GS2RoundRecord = {
    round: s.round,
    extension: s.extension,
    actions: { p1: actA, p2: actB },
    steps: result.steps,
    finalRoundSugar: result.finalRoundSugar,
    winner: result.winner,
    scoreDelta: result.scoreDelta,
    scoreAfter: { p1: s.player1.score, p2: s.player2.score },
    sugarRemainAfter: { p1: s.player1.sugarRemain, p2: s.player2.sugarRemain },
    hrPenaltyAppliedNextRound: { p1: 0, p2: 0 }, // 적용은 다음 라운드 시작에서
  };

  s.history.push(record);
  pushRoundToCurrentStage(s, record);
  s.lastRoundRecord = record;
  s.resolveSteps = result.steps;
  s.phase = 'reveal';

  void broadcastState(io, s);

  // 즉시 게임 승리 처리 (무행동 vs 우주뿌셔!) — 일반 라운드와 동일하게 애니메이션 후 처리
  if (result.instantWin) {
    const totalAnimMs = REVEAL_BASE_DELAY_MS + result.steps.length * RESOLVE_STEP_DELAY_MS + 1800;
    const gen = s.aiGeneration;
    const winner = result.instantWin;
    s.resolveTimer = setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      finalizeInstantWin(io, s, winner);
    }, totalAnimMs);
    return;
  }

  // 정산 단계 애니메이션 시간 후 roundEnd 진입
  const totalAnimMs = REVEAL_BASE_DELAY_MS + result.steps.length * RESOLVE_STEP_DELAY_MS + 1800;
  const gen = s.aiGeneration;
  s.resolveTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    enterRoundEnd(io, s);
  }, totalAnimMs);
}

function enterRoundEnd(io: IO, s: GS2InternalState) {
  s.phase = 'roundEnd';
  void broadcastState(io, s);

  const isLastRound = s.round >= s.maxRound;

  if (isLastRound) {
    const gen = s.aiGeneration;
    s.nextRoundTimer = setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      finalizeStage(io, s);
    }, ROUND_END_HOLD_MS);
    return;
  }

  const gen = s.aiGeneration;
  s.nextRoundTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    s.round += 1;
    startRound(io, s);
  }, NEXT_ROUND_AUTO_DELAY_MS);
}

/* ────────── stage / extension / finalize ────────── */

function pushRoundToCurrentStage(s: GS2InternalState, record: GS2RoundRecord) {
  let stage = s.stages[s.stages.length - 1];
  if (!stage || stage.extension !== s.extension) {
    stage = {
      extension: s.extension,
      maxRound: s.maxRound,
      rounds: [],
      scoreAfter: { p1: 0, p2: 0 },
      result: 'tie',
    };
    s.stages.push(stage);
  }
  stage.maxRound = s.maxRound;
  stage.rounds.push({ ...record, steps: [...record.steps] });
}

function finalizeStage(io: IO, s: GS2InternalState) {
  const stage = s.stages[s.stages.length - 1];
  if (!stage) return;

  const stageDeltaP1 = s.player1.score - s.stageStartScores.p1;
  const stageDeltaP2 = s.player2.score - s.stageStartScores.p2;
  stage.scoreAfter = { p1: stageDeltaP1, p2: stageDeltaP2 };

  let stageWinner: GS2Side | 'tie';
  if (stageDeltaP1 > stageDeltaP2) stageWinner = 'p1';
  else if (stageDeltaP2 > stageDeltaP1) stageWinner = 'p2';
  else stageWinner = 'tie';
  stage.result = stageWinner;

  // 본 게임 + 연장전 모두 합한 누적 점수로 판정
  const totalP1 = s.player1.score;
  const totalP2 = s.player2.score;

  if (totalP1 !== totalP2) {
    finalizeGame(io, s, totalP1 > totalP2 ? 'p1' : 'p2', 'score');
    return;
  }

  // 동점 → 무승부 종료
  finalizeGame(io, s, 'tie', 'draw');
}

function finalizeGame(
  io: IO, s: GS2InternalState,
  winner: GS2Side | 'tie',
  winType: GS2WinType,
) {
  s.gameOver = true;
  s.phase = 'finished';
  s.finalWinner = winner;
  s.winType = winType;

  void broadcastState(io, s);

  const winnerPlayer = winner === 'tie' ? null : (winner === 'p1' ? s.player1 : s.player2);
  const loserPlayer = winner === 'tie' ? null : (winner === 'p1' ? s.player2 : s.player1);

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

function finalizeInstantWin(io: IO, s: GS2InternalState, winner: GS2Side) {
  s.phase = 'roundEnd';
  s.lastRoundRecord = s.history[s.history.length - 1] ?? null;
  void broadcastState(io, s);

  const stage = s.stages[s.stages.length - 1];
  if (stage) {
    stage.result = winner;
    stage.scoreAfter = {
      p1: s.player1.score - s.stageStartScores.p1,
      p2: s.player2.score - s.stageStartScores.p2,
    };
  }

  const gen = s.aiGeneration;
  s.nextRoundTimer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    finalizeGame(io, s, winner, 'instantWin');
  }, ROUND_END_HOLD_MS);
}

/* ────────── archive 빌드 ────────── */

function buildArchiveRecord(s: GS2InternalState): GrapeSugar2ArchiveRecord {
  // 카드 사용 통계
  const usageCount: Record<GS2Side, Map<GS2CardId, number>> = {
    p1: new Map(),
    p2: new Map(),
  };
  for (const r of s.history) {
    for (const side of ['p1', 'p2'] as const) {
      const card = r.actions[side].card;
      usageCount[side].set(card, (usageCount[side].get(card) ?? 0) + 1);
    }
  }

  const cardUsage = {
    p1: [...usageCount.p1.entries()].map(([card, count]) => ({ card, count })),
    p2: [...usageCount.p2.entries()].map(([card, count]) => ({ card, count })),
  };

  const finalScores: Record<string, number> = {
    [s.player1.id]: s.player1.score,
    [s.player2.id]: s.player2.score,
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
    finalScores,
    totalRounds: s.history.length,
    extensions: s.extension,
    stages: s.stages.map((stage) => ({
      ...stage,
      rounds: stage.rounds.map((r) => ({ ...r, steps: [...r.steps] })),
    })),
    sides: { p1: s.player1.id, p2: s.player2.id },
    cardUsage,
    players,
    finishReason: s.finishReason,
  };
}

/* ────────── timeout / forfeit ────────── */

function handleTimeout(io: IO, s: GS2InternalState) {
  if (s.gameOver) return;
  s.roundTimer = null;
  if (s.phase !== 'input') return;

  for (const p of [s.player1, s.player2]) {
    if (p.submitted) continue;
    trackTimeout(s, p.id);
    if (shouldForceEnd(s, p.id)) {
      const opp = p === s.player1 ? s.player2 : s.player1;
      s.finishReason = `${p.nickname} 연속 시간 초과`;
      finalizeGame(io, s, opp.side, 'timeout');
      return;
    }
    autoSubmit(p);
  }

  proceedToResolve(io, s);
}

function autoSubmit(p: GS2PlayerInternal) {
  // 무행동 카드를 가지고 있다면 무행동, 없으면 첫 카드
  const fallback = p.hand.includes('noAction')
    ? 'noAction'
    : p.hand[0] ?? 'noAction';
  p.pendingCard = fallback as GS2CardId;
  p.pendingSugar = 0;
  p.submitted = true;
}

function trackTimeout(s: GS2InternalState, pid: string) {
  s.consecutiveTimeouts[pid] = (s.consecutiveTimeouts[pid] ?? 0) + 1;
}

function shouldForceEnd(s: GS2InternalState, pid: string): boolean {
  return (s.consecutiveTimeouts[pid] ?? 0) >= 3;
}

export function resetTimeout(s: GS2InternalState, pid: string) {
  s.consecutiveTimeouts[pid] = 0;
}

/* ────────── undo snapshots ────────── */

function snapshotPlayer(p: GS2PlayerInternal): GS2PlayerSnapshot {
  return {
    score: p.score,
    sugarRemain: p.sugarRemain,
    hand: [...p.hand],
    pendingCard: p.pendingCard,
    pendingSugar: p.pendingSugar,
    submitted: p.submitted,
    hrPenaltyPending: p.hrPenaltyPending,
    breathUsed: p.breathUsed,
  };
}

function restorePlayer(p: GS2PlayerInternal, snap: GS2PlayerSnapshot) {
  p.score = snap.score;
  p.sugarRemain = snap.sugarRemain;
  p.hand = [...snap.hand];
  p.pendingCard = snap.pendingCard;
  p.pendingSugar = snap.pendingSugar;
  p.submitted = snap.submitted;
  p.hrPenaltyPending = snap.hrPenaltyPending;
  p.breathUsed = snap.breathUsed;
}

function pushUndoSnapshot(s: GS2InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    extension: s.extension,
    maxRound: s.maxRound,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    history: s.history.map((r) => ({ ...r, steps: [...r.steps] })),
    stages: s.stages.map((stage) => ({
      ...stage,
      rounds: stage.rounds.map((r) => ({ ...r, steps: [...r.steps] })),
    })),
    stageStartScores: { ...s.stageStartScores },
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
  });
  // 최대 12개 보관
  if (s.undoSnapshots.length > 12) s.undoSnapshots.shift();
}

function applySnapshot(s: GS2InternalState, snap: GS2UndoSnapshot) {
  s.round = snap.round;
  s.extension = snap.extension;
  s.maxRound = snap.maxRound;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.history = snap.history.map((r) => ({ ...r, steps: [...r.steps] }));
  s.stages = snap.stages.map((stage) => ({
    ...stage,
    rounds: stage.rounds.map((r) => ({ ...r, steps: [...r.steps] })),
  }));
  s.stageStartScores = { ...snap.stageStartScores };
  s.consecutiveTimeouts = { ...snap.consecutiveTimeouts };
  s.resolveSteps = [];
  s.lastRoundRecord = null;
}

export function performGS2Undo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (s.undoSnapshots.length < 1) return false;

  s.aiGeneration += 1;
  clearAllTimers(s);

  const snap = s.undoSnapshots[s.undoSnapshots.length - 1];
  applySnapshot(s, snap);

  if (s.phase === 'input') {
    armRoundTimer(io, s);
  }
  void broadcastState(io, s);
  if (s.playMode === 'com' && s.phase === 'input') s.onAITurn?.(io, s);
  return true;
}

export function getGrapeSugar2ResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return buildArchiveRecord(s);
}

export function tryNextRoundReady(io: IO, s: GS2InternalState, _pid: string): string | null {
  if (s.phase !== 'roundEnd') return '지금은 다음 라운드 준비를 보낼 수 없습니다.';
  // 자동 진입 타이머가 있으므로 즉시 진입을 굳이 강제하지 않고, 본인 측에 보내준 신호로 활용.
  // 단, 빠른 진입을 원할 경우: 양측 모두 ready 시 즉시 진입.
  // 단순 구현: 현 라운드 대기 시간 단축은 생략. (no-op)
  void io;
  return null;
}
