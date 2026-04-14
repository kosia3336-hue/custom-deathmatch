import type { GameState } from '@shared/types/events.js';
import type {
  BettingRpsGameData, BRPSPlayerInfo, BRPSRevealData, BRPSRevealPlayerData, BRPSRoundRecord,
} from '@shared/types/betting-rps.js';
import { brpsMatchWinBonus } from '@shared/types/betting-rps.js';
import { BRPS_TOTAL_ROUNDS, BRPS_INITIAL_CHIPS, BRPS_BET_MULTIPLIER, REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, BRPSPlayerInternal, BRPSRoundActionLog } from './types.js';
import { judgeBet, settleChips } from './judge.js';
import { socketRoom } from '../../utils.js';

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
  const players: Record<string, BRPSPlayerInfo> = {
    [s.player1.id]: playerToInfo(s.player1, reveal || socketId === s.player1.id),
    [s.player2.id]: playerToInfo(s.player2, reveal || socketId === s.player2.id),
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
  const players: Record<string, BRPSPlayerInfo> = {
    [s.player1.id]: playerToSpectatorInfo(s.player1, reveal),
    [s.player2.id]: playerToSpectatorInfo(s.player2, reveal),
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
    const isPlayer = sock.id === s.player1.id || sock.id === s.player2.id;
    const gameData = isPlayer
      ? buildGameDataForPlayer(s, sock.id)
      : buildSpectatorGameData(s);
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const isPlayer = socket.id === s.player1.id || socket.id === s.player2.id;
  const gameData = isPlayer
    ? buildGameDataForPlayer(s, socket.id)
    : buildSpectatorGameData(s);
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
  armRoundTimer(io, s);
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
