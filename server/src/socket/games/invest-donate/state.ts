import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  InvestDonateGameData, IDPlayerInfo, IDRoundRecord, IDRevealData, IDRevealPlayerData,
} from '@shared/types/invest-donate.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { ID_TOTAL_ROUNDS, ID_INITIAL_SCORE, ID_INITIAL_COIN_STOCK, REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  InternalState, InternalRoundRecord, IDPlayerInternal,
  IDUndoSnapshot, IDPlayerSnapshot, RoundActionLog,
} from './types.js';
import { judgeInvest, judgeDonate, coinValue, coinAdd, coinSubtract, stockTotal } from './judge.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

function playerToInfo(p: IDPlayerInternal, revealSelf: boolean): IDPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    coinStock: { ...p.coinStock },
    submitted: p.submitted,
    investCoins: revealSelf ? p.investCoins : null,
    donateCoins: revealSelf ? p.donateCoins : null,
    investBadge: p.investBadge,
    donateBadge: p.donateBadge,
  };
}

function toClientRoundHistory(history: InternalRoundRecord[]): IDRoundRecord[] {
  return history.map(r => ({
    round: r.round,
    players: Object.fromEntries(
      Object.entries(r.players).map(([pid, pr]) => [pid, { ...pr }]),
    ),
  }));
}

/* ────────── broadcasting ────────── */

function buildRevealData(s: InternalState): IDRevealData | null {
  if ((s.phase !== 'reveal' && s.phase !== 'finished') || s.roundHistory.length === 0) return null;
  const last = s.roundHistory[s.roundHistory.length - 1];
  const players: Record<string, IDRevealPlayerData> = {};
  for (const [pid, rec] of Object.entries(last.players)) {
    players[pid] = {
      investCoins: rec.investCoins,
      donateCoins: rec.donateCoins,
      investTotal: rec.investTotal,
      donateTotal: rec.donateTotal,
      investBadge: rec.investBadge,
      donateBadge: rec.donateBadge,
      scoreChange: rec.scoreChange,
    };
  }
  const investTied = last.players[s.player1.id]?.investBadge === null && last.players[s.player2.id]?.investBadge === null;
  const donateTied = last.players[s.player1.id]?.donateBadge === 'miser' && last.players[s.player2.id]?.donateBadge === 'miser';
  return { players, investTied, donateTied };
}

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    if (s.winType === 'timeout') return '시간 초과로 게임이 종료되었습니다.';
    if (s.winType === 'elimination') return '승점 0점으로 탈락하여 게임이 종료되었습니다.';
    return '게임이 종료되었습니다.';
  }
  if (s.phase === 'reveal') return `라운드 ${s.round} — 결과`;
  if (s.phase === 'submit') return `라운드 ${s.round} — 투자와 기부를 배분하세요`;
  return '';
}

function buildGameDataForPlayer(s: InternalState, socketId: string): InvestDonateGameData {
  const isP1 = socketId === s.player1.id;
  const isP2 = socketId === s.player2.id;
  const isReveal = s.phase === 'reveal' || s.phase === 'finished';
  const _dbg = isDbgViewer(s.playMode, sessions.getMemberId(socketId));
  const maskNick = (id: string, nick: string) =>
    nicknameForViewer(s.roomId, id, nick, socketId);

  const players: Record<string, IDPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, isReveal || isP1 || (_dbg && isP2)), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, isReveal || isP2 || (_dbg && isP1)), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };

  return {
    round: s.round,
    totalRounds: s.totalRounds,
    phase: s.phase,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.roundHistory),
    winner: s.winner,
    winType: s.winType,
    rematchReason: s.rematchReason,
  };
}

function buildSpectatorGameData(s: InternalState): InvestDonateGameData {
  const isReveal = s.phase === 'reveal' || s.phase === 'finished';
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) ? ANONYMOUS_NICKNAME : nick;
  const players: Record<string, IDPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, isReveal), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, isReveal), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };

  return {
    round: s.round,
    totalRounds: s.totalRounds,
    phase: s.phase,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.roundHistory),
    winner: s.winner,
    winType: s.winType,
    rematchReason: s.rematchReason,
  };
}

function buildGameState(s: InternalState, gameData: InvestDonateGameData): GameState {
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

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();

  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const isPlayer = pid === s.player1.id || pid === s.player2.id;
    const gameData = isPlayer
      ? buildGameDataForPlayer(s, pid)
      : buildSpectatorGameData(s);
    if (isPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
      const opp = pid === s.player1.id ? s.player2 : s.player1;
      if ((s.phase === 'reveal' || s.phase === 'finished') && s.roundHistory.length > 0) {
        const last = s.roundHistory[s.roundHistory.length - 1];
        const d = last.players[opp.id];
        const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
        if (d) sock.emit('ext:data', { game: 'invest-donate', round: last.round, opponent: oppNick, investCoins: d.investCoins, donateCoins: d.donateCoins });
      } else if (s.phase === 'submit' && opp.submitted && opp.investCoins && opp.donateCoins) {
        const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
        sock.emit('ext:data', { game: 'invest-donate', round: s.round, opponent: oppNick, investCoins: opp.investCoins, donateCoins: opp.donateCoins });
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
  if (isPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
    const opp = pid === s.player1.id ? s.player2 : s.player1;
    if ((s.phase === 'reveal' || s.phase === 'finished') && s.roundHistory.length > 0) {
      const last = s.roundHistory[s.roundHistory.length - 1];
      const d = last.players[opp.id];
      const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
      if (d) socket.emit('ext:data', { game: 'invest-donate', round: last.round, opponent: oppNick, investCoins: d.investCoins, donateCoins: d.donateCoins });
    } else if (s.phase === 'submit' && opp.submitted && opp.investCoins && opp.donateCoins) {
      const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
      socket.emit('ext:data', { game: 'invest-donate', round: s.round, opponent: oppNick, investCoins: opp.investCoins, donateCoins: opp.donateCoins });
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

function snapshotPlayer(p: IDPlayerInternal): IDPlayerSnapshot {
  return {
    score: p.score,
    coinStock: { ...p.coinStock },
    submitted: p.submitted,
    investCoins: p.investCoins ? { ...p.investCoins } : null,
    donateCoins: p.donateCoins ? { ...p.donateCoins } : null,
    investBadge: p.investBadge,
    donateBadge: p.donateBadge,
  };
}

function restorePlayer(p: IDPlayerInternal, snap: IDPlayerSnapshot) {
  p.score = snap.score;
  p.coinStock = { ...snap.coinStock };
  p.submitted = snap.submitted;
  p.investCoins = snap.investCoins ? { ...snap.investCoins } : null;
  p.donateCoins = snap.donateCoins ? { ...snap.donateCoins } : null;
  p.investBadge = snap.investBadge;
  p.donateBadge = snap.donateBadge;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    roundHistory: structuredClone(s.roundHistory),
    actionLog: structuredClone(s.actionLog),
  });
}

function applyUndoSnapshot(s: InternalState, snap: IDUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.roundHistory = structuredClone(snap.roundHistory);
  s.actionLog = structuredClone(snap.actionLog);
}

function hasPartialRound(s: InternalState): boolean {
  return s.phase !== 'submit' || s.player1.submitted || s.player2.submitted;
}

export function performInvestDonateUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  s.aiGeneration++;
  clearRoundTimer(s);

  if (hasPartialRound(s)) {
    if (s.undoSnapshots.length < 1) return false;
    applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    armRoundTimer(io, s);
    broadcastState(io, s);
    return true;
  }

  if (s.undoSnapshots.length < 2) return false;
  s.undoSnapshots.pop();
  applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  armRoundTimer(io, s);
  broadcastState(io, s);
  return true;
}

/* ────────── timeout ────────── */

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);

  const p1Done = s.player1.submitted;
  const p2Done = s.player2.submitted;

  if (!p1Done && !p2Done) {
    autoSubmitDefaults(s.player1);
    autoSubmitDefaults(s.player2);
    processRound(io, s);
    return;
  }

  const winnerId = p1Done ? s.player1.id : s.player2.id;
  const loserId = p1Done ? s.player2.id : s.player1.id;
  const winnerP = p1Done ? s.player1 : s.player2;
  const loserP = p1Done ? s.player2 : s.player1;

  resolveGame(io, s, winnerId, winnerP.nickname, loserId, loserP.nickname, 'timeout');
}

function autoSubmitDefaults(p: IDPlayerInternal) {
  if (!p.submitted) {
    p.investCoins = { coin50: 0, coin10: 0, coin1: 0 };
    p.donateCoins = { coin50: 0, coin10: 0, coin1: 0 };
    p.submitted = true;
  }
}

/* ────────── game resolution ────────── */

function resolveGame(
  io: IO, s: InternalState,
  winnerId: string, winnerNick: string,
  loserId: string, loserNick: string,
  winType: InternalState['winType'],
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  broadcastState(io, s);

  const winnerP = winnerId === s.player1.id ? s.player1 : s.player2;
  const loserP = loserId === s.player1.id ? s.player1 : s.player2;

  const payload = {
    rankings: [
      { playerId: winnerId, nickname: winnerNick, rank: 1, score: winnerP.score },
      { playerId: loserId, nickname: loserNick, rank: 2, score: loserP.score },
    ],
    totalTurns: s.round,
    gameResultData: {
      winType: s.winType,
      finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
      finalCoinStocks: { [s.player1.id]: s.player1.coinStock, [s.player2.id]: s.player2.coinStock },
      totalRounds: s.round,
      actions: s.actionLog,
      players: {
        [s.player1.id]: { nickname: s.player1.nickname },
        [s.player2.id]: { nickname: s.player2.nickname },
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

  const p1 = s.player1;
  const p2 = s.player2;

  const investResult = judgeInvest(p1.id, p1.investCoins!, p2.id, p2.investCoins!);
  const donateResult = judgeDonate(p1.id, p1.donateCoins!, p2.id, p2.donateCoins!);

  const totalChange: Record<string, number> = {};
  for (const id of [p1.id, p2.id]) {
    totalChange[id] = investResult.scoreChanges[id] + donateResult.scoreChanges[id];
  }

  const p1ScoreBefore = p1.score;
  const p2ScoreBefore = p2.score;

  p1.score = Math.max(0, p1.score + totalChange[p1.id]);
  p2.score = Math.max(0, p2.score + totalChange[p2.id]);

  for (const player of [p1, p2]) {
    const used = coinAdd(player.investCoins!, player.donateCoins!);
    player.coinStock = coinSubtract(player.coinStock, used);
  }

  for (const player of [p1, p2]) {
    player.investBadge = investResult.badge[player.id] ?? null;
    player.donateBadge = donateResult.badge[player.id] ?? null;
  }

  const roundRecord: InternalRoundRecord = {
    round: s.round,
    players: {},
  };
  for (const id of [p1.id, p2.id]) {
    const player = id === p1.id ? p1 : p2;
    roundRecord.players[id] = {
      investCoins: player.investCoins!,
      donateCoins: player.donateCoins!,
      investTotal: coinValue(player.investCoins!),
      donateTotal: coinValue(player.donateCoins!),
      investBadge: investResult.badge[id] ?? null,
      donateBadge: donateResult.badge[id] ?? null,
      scoreChange: totalChange[id],
      scoreAfter: player.score,
      coinStockAfter: { ...player.coinStock },
    };
  }
  s.roundHistory.push(roundRecord);

  const actionLog: RoundActionLog = {
    round: s.round,
    players: {},
  };
  for (const id of [p1.id, p2.id]) {
    const player = id === p1.id ? p1 : p2;
    const scoreBefore = id === p1.id ? p1ScoreBefore : p2ScoreBefore;
    actionLog.players[id] = {
      nickname: player.nickname,
      investCoins: player.investCoins!,
      donateCoins: player.donateCoins!,
      investTotal: coinValue(player.investCoins!),
      donateTotal: coinValue(player.donateCoins!),
      investBadge: investResult.badge[id] ?? null,
      donateBadge: donateResult.badge[id] ?? null,
      scoreChange: totalChange[id],
      scoreBefore,
      scoreAfter: player.score,
      coinStockAfter: { ...player.coinStock },
    };
  }
  s.actionLog.push(actionLog);

  s.phase = 'reveal';
  broadcastState(io, s);

  const p1Dead = p1.score === 0;
  const p2Dead = p2.score === 0;

  if (p1Dead && p2Dead) {
    resolveDraw(io, s);
    return;
  }
  if (p1Dead) {
    delayedResolve(io, s, p2.id, p1.id, 'elimination');
    return;
  }
  if (p2Dead) {
    delayedResolve(io, s, p1.id, p2.id, 'elimination');
    return;
  }

  if (s.round >= s.totalRounds) {
    if (p1.score !== p2.score) {
      const wId = p1.score > p2.score ? p1.id : p2.id;
      const lId = wId === p1.id ? p2.id : p1.id;
      delayedResolve(io, s, wId, lId, 'score');
      return;
    }
    const p1Total = stockTotal(p1.coinStock);
    const p2Total = stockTotal(p2.coinStock);
    if (p1Total !== p2Total) {
      const wId = p1Total > p2Total ? p1.id : p2.id;
      const lId = wId === p1.id ? p2.id : p1.id;
      delayedResolve(io, s, wId, lId, 'tiebreaker');
      return;
    }
    resolveDraw(io, s);
    return;
  }

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, REVEAL_DELAY_MS);
}

function delayedResolve(io: IO, s: InternalState, winnerId: string, loserId: string, winType: InternalState['winType']) {
  const winnerP = winnerId === s.player1.id ? s.player1 : s.player2;
  const loserP = loserId === s.player1.id ? s.player1 : s.player2;
  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    resolveGame(io, s, winnerId, winnerP.nickname, loserId, loserP.nickname, winType);
  }, REVEAL_DELAY_MS);
}

function resolveDraw(io: IO, s: InternalState) {
  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    s.winner = null;
    s.winType = 'draw';
    s.gameOver = true;
    s.phase = 'finished';
    broadcastState(io, s);

    const payload = {
      rankings: [
        { playerId: s.player1.id, nickname: s.player1.nickname, rank: 1, score: s.player1.score },
        { playerId: s.player2.id, nickname: s.player2.nickname, rank: 1, score: s.player2.score },
      ],
      totalTurns: s.round,
      gameResultData: {
        winType: 'draw' as const,
        finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
        finalCoinStocks: { [s.player1.id]: s.player1.coinStock, [s.player2.id]: s.player2.coinStock },
        totalRounds: s.round,
        actions: s.actionLog,
        players: {
          [s.player1.id]: { nickname: s.player1.nickname },
          [s.player2.id]: { nickname: s.player2.nickname },
        },
      },
    };

    setTimeout(() => {
      if (!gameStates.has(s.roomId)) return;
      gameStates.delete(s.roomId);
      s.endGameCallback(io, s.roomId, payload);
    }, WIN_DISPLAY_MS);
  }, REVEAL_DELAY_MS);
}

function resetGame(s: InternalState) {
  s.round = 1;
  s.phase = 'submit';
  s.winner = null;
  s.winType = null;
  s.rematchReason = null;
  s.roundHistory = [];
  s.actionLog = [];
  s.undoSnapshots = [];
  s.gameOver = false;

  for (const player of [s.player1, s.player2]) {
    player.score = ID_INITIAL_SCORE;
    player.coinStock = { ...ID_INITIAL_COIN_STOCK };
    player.submitted = false;
    player.investCoins = null;
    player.donateCoins = null;
    player.investBadge = null;
    player.donateBadge = null;
  }
}

/* ────────── round advance ────────── */

export function advanceRound(io: IO, s: InternalState) {
  s.round++;
  s.phase = 'submit';

  for (const player of [s.player1, s.player2]) {
    player.submitted = false;
    player.investCoins = null;
    player.donateCoins = null;
    player.investBadge = null;
    player.donateBadge = null;
  }

  startRoundTimer(io, s);
  broadcastState(io, s);
}

export function getInvestDonateResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    winType: s.winType,
    finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
    finalCoinStocks: { [s.player1.id]: s.player1.coinStock, [s.player2.id]: s.player2.coinStock },
    totalRounds: s.round,
    actions: s.actionLog,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
  };
}
