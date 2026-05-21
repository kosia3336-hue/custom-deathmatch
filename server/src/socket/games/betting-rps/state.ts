import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  BettingRpsGameData, BRPSPlayerInfo, BRPSRevealData, BRPSRevealPlayerData, BRPSRoundRecord,
} from '@shared/types/betting-rps.js';
import { brpsMatchWinBonus } from '@shared/types/betting-rps.js';
import { BRPS_TOTAL_ROUNDS, BRPS_INITIAL_CHIPS, BRPS_BET_MULTIPLIER, REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, BRPSPlayerInternal, BRPSRoundActionLog, BRPSPlayerSnapshot, BRPSUndoSnapshot } from './types.js';
import { judgeBet, settleChips } from './judge.js';
import { socketRoom } from '../../utils.js';
import { isPurinInsightViewer } from '../../purin-insight.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

function isRevealPhase(s: InternalState): boolean {
  return s.phase === 'reveal' || s.phase === 'finished';
}

function getChoiceRightId(s: InternalState): string {
  // 홀수 라운드 = player1, 짝수 라운드 = player2
  return s.round % 2 === 1 ? s.player1.id : s.player2.id;
}

function playerToInfo(p: BRPSPlayerInternal, revealSelf: boolean): BRPSPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    chips: p.chips,
    role: p.role,
    hasChoiceRight: p.hasChoiceRight,
    submitted: p.submitted,
    matchResult: revealSelf ? p.matchResult : null,
    prediction: revealSelf ? p.prediction : null,
    betChips: revealSelf ? p.betChips : null,
  };
}

function toClientRoundHistory(history: BRPSRoundActionLog[]): BRPSRoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    choiceRightPlayerId: r.choiceRightPlayerId,
    players: Object.fromEntries(
      Object.entries(r.players).map(([pid, pr]) => [
        pid,
        {
          role: pr.role,
          matchResult: pr.matchResult,
          prediction: pr.prediction,
          betChips: pr.betChips,
          betOutcome: pr.betOutcome,
          chipsBefore: pr.chipsBefore,
          chipsAfter: pr.chipsAfter,
          chipChange: pr.chipChange,
        },
      ]),
    ),
  }));
}

function buildRevealData(s: InternalState): BRPSRevealData | null {
  if (!isRevealPhase(s) || s.actionLog.length === 0) return null;
  const last = s.actionLog[s.actionLog.length - 1];
  const players: Record<string, BRPSRevealPlayerData> = {};
  for (const [pid, pr] of Object.entries(last.players)) {
    players[pid] = {
      role: pr.role,
      matchResult: pr.matchResult,
      prediction: pr.prediction,
      betChips: pr.betChips,
      betOutcome: pr.betOutcome,
      chipsBefore: pr.chipsBefore,
      chipsAfter: pr.chipsAfter,
      chipChange: pr.chipChange,
    };
  }
  return { players };
}

function buildGameDataForPlayer(s: InternalState, socketId: string): BettingRpsGameData {
  const reveal = isRevealPhase(s);
  const purin = isPurinInsightViewer(s.playMode, socketId, s.player1, s.player2);
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) && id !== socketId ? ANONYMOUS_NICKNAME : nick;
  const players: Record<string, BRPSPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, reveal || socketId === s.player1.id || (purin && socketId === s.player2.id)), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, reveal || socketId === s.player2.id || (purin && socketId === s.player1.id)), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: s.totalRounds,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.actionLog),
    winner: s.winner,
    winType: s.winType,
  };
}

function playerToSpectatorInfo(p: BRPSPlayerInternal, reveal: boolean): BRPSPlayerInfo {
  if (reveal) return playerToInfo(p, true);
  // roleSelect / submit 페이즈: 칩 수만 공개, 역할·선택권·제출 여부는 숨김
  return {
    id: p.id,
    nickname: p.nickname,
    chips: p.chips,
    role: null,
    hasChoiceRight: false,
    submitted: false,
    matchResult: null,
    prediction: null,
    betChips: null,
  };
}

function buildSpectatorGameData(s: InternalState): BettingRpsGameData {
  const reveal = isRevealPhase(s);
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) ? ANONYMOUS_NICKNAME : nick;
  const players: Record<string, BRPSPlayerInfo> = {
    [s.player1.id]: { ...playerToSpectatorInfo(s.player1, reveal), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToSpectatorInfo(s.player2, reveal), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: s.totalRounds,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.actionLog),
    winner: s.winner,
    winType: s.winType,
  };
}

function phaseMessage(s: InternalState): string {
  if (s.phase === 'roleSelect') return `라운드 ${s.round} — 역할을 선택하세요`;
  if (s.phase === 'submit') return `라운드 ${s.round} — 제출하세요`;
  if (s.phase === 'reveal') return `라운드 ${s.round} — 결과`;
  return '게임이 종료되었습니다.';
}

function buildGameState(s: InternalState, gameData: BettingRpsGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds ? s.turnStartedAt : null,
    gameData,
  };
}

/* ────────── broadcasting ────────── */

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const isPlayer = pid === s.player1.id || pid === s.player2.id;
    const gameData = isPlayer
      ? buildGameDataForPlayer(s, pid)
      : buildSpectatorGameData(s);
    if (isPlayer && isPurinInsightViewer(s.playMode, pid, s.player1, s.player2)) {
      const opp = pid === s.player1.id ? s.player2 : s.player1;
      if (isRevealPhase(s)) {
        const last = s.actionLog[s.actionLog.length - 1];
        const d = last?.players[opp.id];
        const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
        if (d) sock.emit('ext:data', { game: 'betting-rps', round: last!.round, opponent: oppNick, role: d.role, matchResult: d.matchResult, prediction: d.prediction, betChips: d.betChips });
      } else if (s.phase === 'submit' && opp.submitted) {
        const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
        sock.emit('ext:data', { game: 'betting-rps', round: s.round, opponent: oppNick, role: opp.role, matchResult: opp.matchResult, prediction: opp.prediction, betChips: opp.betChips });
      }
    }
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = pid === s.player1.id || pid === s.player2.id;
  const gameData = isPlayer
    ? buildGameDataForPlayer(s, pid)
    : buildSpectatorGameData(s);
  if (isPlayer && isPurinInsightViewer(s.playMode, pid, s.player1, s.player2)) {
    const opp = pid === s.player1.id ? s.player2 : s.player1;
    if (isRevealPhase(s)) {
      const last = s.actionLog[s.actionLog.length - 1];
      const d = last?.players[opp.id];
      const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
      if (d) socket.emit('ext:data', { game: 'betting-rps', round: last!.round, opponent: oppNick, role: d.role, matchResult: d.matchResult, prediction: d.prediction, betChips: d.betChips });
    } else if (s.phase === 'submit' && opp.submitted) {
      const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
      socket.emit('ext:data', { game: 'betting-rps', round: s.round, opponent: oppNick, role: opp.role, matchResult: opp.matchResult, prediction: opp.prediction, betChips: opp.betChips });
    }
  }
  socket.emit('game:state', buildGameState(s, gameData));
}

/* ────────── timer ────────── */

export function clearRoundTimer(s: InternalState) {
  if (s.roundTimer) {
    clearTimeout(s.roundTimer);
    s.roundTimer = null;
  }
}

function armRoundTimer(io: IO, s: InternalState) {
  clearRoundTimer(s);
  if (!s.timeLimitSeconds) return;
  s.turnStartedAt = Date.now();
  s.roundTimer = setTimeout(() => handleTimeout(io, s), s.timeLimitSeconds * 1000);
}

export function startRoundTimer(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armRoundTimer(io, s);
}

/* ────────── undo snapshots ────────── */

function snapshotPlayer(p: BRPSPlayerInternal): BRPSPlayerSnapshot {
  return {
    chips: p.chips,
    role: p.role,
    hasChoiceRight: p.hasChoiceRight,
    submitted: p.submitted,
    matchResult: p.matchResult,
    prediction: p.prediction,
    betChips: p.betChips,
  };
}

function restorePlayer(p: BRPSPlayerInternal, snap: BRPSPlayerSnapshot) {
  p.chips = snap.chips;
  p.role = snap.role;
  p.hasChoiceRight = snap.hasChoiceRight;
  p.submitted = snap.submitted;
  p.matchResult = snap.matchResult;
  p.prediction = snap.prediction;
  p.betChips = snap.betChips;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as BRPSRoundActionLog[],
  });
}

function applyBRPSUndoSnapshot(s: InternalState, snap: BRPSUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as BRPSRoundActionLog[];
}

/** 이번 라운드에서 이미 행동이 발생했는지 (역할 선택 이후 = partial) */
function hasPartialRound(s: InternalState): boolean {
  return s.phase !== 'roleSelect';
}

export function performBettingRpsUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  s.aiGeneration++;
  clearRoundTimer(s);

  if (hasPartialRound(s)) {
    // 진행 중인 라운드 → 이번 라운드 시작 시점으로 복원 (스냅샷 유지)
    if (s.undoSnapshots.length < 1) return false;
    applyBRPSUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    armRoundTimer(io, s);
    broadcastState(io, s);
    if (s.playMode === 'com') s.onAITurn?.(io, s);
    return true;
  }

  // 라운드 시작 직후 아무것도 안 한 상태 → 직전 완료 라운드 취소
  if (s.undoSnapshots.length < 2) return false;
  s.undoSnapshots.pop();
  applyBRPSUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  armRoundTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
  return true;
}

/* ────────── timeout ────────── */

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);

  // roleSelect 페이즈 타임아웃: 랜덤 역할 배정 후 submit 진행
  if (s.phase === 'roleSelect') {
    const choiceId = getChoiceRightId(s);
    const role = Math.random() < 0.5 ? 'match' : 'bet';
    assignRoles(s, choiceId, role as 'match' | 'bet');
    s.phase = 'submit';
    broadcastState(io, s);
    // 시간 초과로 submit까지 처리
    autoSubmitAll(s);
    processRound(io, s);
    return;
  }

  // submit 페이즈 타임아웃
  const p1Done = s.player1.submitted;
  const p2Done = s.player2.submitted;

  if (!p1Done && !p2Done) {
    autoSubmitAll(s);
    processRound(io, s);
    return;
  }

  if (p1Done && p2Done) {
    processRound(io, s);
    return;
  }

  const winnerId = p1Done ? s.player1.id : s.player2.id;
  const loserId = p1Done ? s.player2.id : s.player1.id;
  const winnerP = p1Done ? s.player1 : s.player2;
  const loserP = loserId === s.player1.id ? s.player1 : s.player2;
  resolveGame(io, s, winnerId, winnerP.nickname, loserId, loserP.nickname, 'timeout');
}

function autoSubmitAll(s: InternalState) {
  for (const p of [s.player1, s.player2]) {
    if (p.submitted) continue;
    if (p.role === 'match') {
      const results: Array<'win' | 'draw' | 'lose'> = ['win', 'draw', 'lose'];
      p.matchResult = results[Math.floor(Math.random() * 3)];
      p.submitted = true;
    } else if (p.role === 'bet') {
      const results: Array<'win' | 'draw' | 'lose'> = ['win', 'draw', 'lose'];
      p.prediction = results[Math.floor(Math.random() * 3)];
      p.betChips = 0;
      p.submitted = true;
    }
  }
}

/* ────────── role assignment ────────── */

function assignRoles(s: InternalState, choiceId: string, role: 'match' | 'bet') {
  const otherId = choiceId === s.player1.id ? s.player2.id : s.player1.id;
  const choicePlayer = getPlayer(s, choiceId)!;
  const otherPlayer = getPlayer(s, otherId)!;
  choicePlayer.role = role;
  otherPlayer.role = role === 'match' ? 'bet' : 'match';
}

/* ────────── game resolution ────────── */

function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string | null,
  winnerNick: string,
  loserId: string | null,
  loserNick: string,
  winType: InternalState['winType'],
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  broadcastState(io, s);

  const p1 = s.player1;
  const p2 = s.player2;

  const rankings = winnerId
    ? [
        { playerId: winnerId, nickname: winnerNick, rank: 1, score: (winnerId === p1.id ? p1 : p2).chips },
        { playerId: loserId!, nickname: loserNick, rank: 2, score: (loserId === p1.id ? p1 : p2).chips },
      ]
    : [
        { playerId: p1.id, nickname: p1.nickname, rank: 1, score: p1.chips },
        { playerId: p2.id, nickname: p2.nickname, rank: 1, score: p2.chips },
      ];

  const payload = {
    rankings,
    totalTurns: s.round,
    gameResultData: {
      winType: s.winType,
      finalChips: { [p1.id]: p1.chips, [p2.id]: p2.chips },
      totalRounds: s.round,
      actions: s.actionLog,
      players: {
        [p1.id]: { nickname: p1.nickname },
        [p2.id]: { nickname: p2.nickname },
      },
    },
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, WIN_DISPLAY_MS);
}

/* ────────── round processing ────────── */

export function processRound(io: IO, s: InternalState) {
  clearRoundTimer(s);

  const matchPlayer = s.player1.role === 'match' ? s.player1 : s.player2;
  const betPlayer = s.player1.role === 'bet' ? s.player1 : s.player2;

  const matchResult = matchPlayer.matchResult!;
  const prediction = betPlayer.prediction!;
  const betChipsAmt = betPlayer.betChips ?? 0;

  const outcome = judgeBet(matchResult, prediction);
  const successMultiplier = prediction === 'draw' ? BRPS_BET_MULTIPLIER : 2;
  const chipsBefore = betPlayer.chips;
  betPlayer.chips = settleChips(betPlayer.chips, betChipsAmt, outcome, successMultiplier);
  const chipsAfter = betPlayer.chips;

  const matchBonus = matchResult === 'win' ? brpsMatchWinBonus(s.round) : 0;
  const matchChipsBefore = matchPlayer.chips;
  matchPlayer.chips += matchBonus;
  const matchChipsAfter = matchPlayer.chips;

  const log: BRPSRoundActionLog = {
    round: s.round,
    choiceRightPlayerId: getChoiceRightId(s),
    players: {
      [matchPlayer.id]: {
        nickname: matchPlayer.nickname,
        role: 'match',
        matchResult,
        prediction: null,
        betChips: null,
        betOutcome: null,
        chipsBefore: matchChipsBefore,
        chipsAfter: matchChipsAfter,
        chipChange: matchBonus,
      },
      [betPlayer.id]: {
        nickname: betPlayer.nickname,
        role: 'bet',
        matchResult: null,
        prediction,
        betChips: betChipsAmt,
        betOutcome: outcome,
        chipsBefore,
        chipsAfter,
        chipChange: chipsAfter - chipsBefore,
      },
    },
  };
  s.actionLog.push(log);

  s.phase = 'reveal';
  broadcastState(io, s);

  if (s.round >= s.totalRounds) {
    const gen = s.aiGeneration;
    setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      endByChips(io, s);
    }, REVEAL_DELAY_MS);
    return;
  }

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, REVEAL_DELAY_MS);
}

function endByChips(io: IO, s: InternalState) {
  const p1 = s.player1;
  const p2 = s.player2;
  if (p1.chips > p2.chips) {
    resolveGame(io, s, p1.id, p1.nickname, p2.id, p2.nickname, 'chips');
  } else if (p2.chips > p1.chips) {
    resolveGame(io, s, p2.id, p2.nickname, p1.id, p1.nickname, 'chips');
  } else {
    resolveGame(io, s, null, '', null, '', 'draw');
  }
}

/* ────────── round advance ────────── */

export function advanceRound(io: IO, s: InternalState) {
  s.round++;
  s.phase = 'roleSelect';

  for (const p of [s.player1, s.player2]) {
    p.role = null;
    p.submitted = false;
    p.matchResult = null;
    p.prediction = null;
    p.betChips = null;
    p.hasChoiceRight = getChoiceRightId(s) === p.id;
  }

  startRoundTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') {
    s.onAITurn?.(io, s);
  }
}

/* ────────── public helpers ────────── */

export function getPlayer(s: InternalState, id: string): BRPSPlayerInternal | null {
  if (s.player1.id === id) return s.player1;
  if (s.player2.id === id) return s.player2;
  return null;
}

export function getOpponent(s: InternalState, id: string): BRPSPlayerInternal | null {
  if (s.player1.id === id) return s.player2;
  if (s.player2.id === id) return s.player1;
  return null;
}

export function makePlayer(id: string, nickname: string, round: number): BRPSPlayerInternal {
  const choiceRightId = round % 2 === 1 ? id : '';
  return {
    id,
    nickname,
    chips: BRPS_INITIAL_CHIPS,
    role: null,
    hasChoiceRight: false, // set after both players created
    submitted: false,
    matchResult: null,
    prediction: null,
    betChips: null,
  };
}

export { assignRoles, getChoiceRightId };

export function getBettingRpsResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  const p1 = s.player1;
  const p2 = s.player2;
  return {
    winType: s.winType,
    finalChips: { [p1.id]: p1.chips, [p2.id]: p2.chips },
    totalRounds: s.round,
    actions: s.actionLog,
    players: {
      [p1.id]: { nickname: p1.nickname },
      [p2.id]: { nickname: p2.nickname },
    },
  };
}
