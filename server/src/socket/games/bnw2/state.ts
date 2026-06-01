import type { GameState } from '@shared/types/events.js';
import type { BNW2GameData, BNW2PlayerInfo, BNW2RevealData } from '@shared/types/bnw2.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { isPurinInsightViewer } from '../../purin-insight.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { BNW2_INITIAL_POINTS, BNW2_MAX_SCORE, REVEAL_DELAY_MS, WIN_DISPLAY_MS, calcBNW2Stage, calcBNW2Color } from './constants.js';
import { judgeRound, autoSubmitPoints } from './judge.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, BNW2PlayerInternal, BNW2RoundLog, BNW2PlayerSnapshot, BNW2UndoSnapshot } from './types.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

function getFirstPlayer(s: InternalState): BNW2PlayerInternal {
  return s.player1.id === s.firstPlayerId ? s.player1 : s.player2;
}

function getSecondPlayer(s: InternalState): BNW2PlayerInternal {
  return s.player1.id === s.firstPlayerId ? s.player2 : s.player1;
}

export function getPlayer(s: InternalState, id: string): BNW2PlayerInternal | null {
  if (s.player1.id === id) return s.player1;
  if (s.player2.id === id) return s.player2;
  return null;
}

function phaseMessage(s: InternalState): string {
  if (s.phase === 'firstSubmit') return `라운드 ${s.round} — 선 플레이어 포인트 제시`;
  if (s.phase === 'secondSubmit') return `라운드 ${s.round} — 후 플레이어 포인트 제시`;
  if (s.phase === 'reveal') return `라운드 ${s.round} — 결과`;
  return '게임이 종료되었습니다.';
}

function playerToInfo(p: BNW2PlayerInternal, revealSelf: boolean): BNW2PlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    stage: calcBNW2Stage(p.remainingPoints),
    remainingPoints: revealSelf ? p.remainingPoints : null,
    submitted: p.submitted,
  };
}

function buildRevealData(s: InternalState): BNW2RevealData | null {
  if (s.phase !== 'reveal' && s.phase !== 'finished') return null;
  if (s.actionLog.length === 0) return null;
  const last = s.actionLog[s.actionLog.length - 1];
  const players: BNW2RevealData['players'] = {};
  for (const [pid, pd] of Object.entries(last.players)) {
    players[pid] = {
      color: pd.color,
      points: pd.points,
      scoreChange: pd.scoreChange,
      scoreBefore: pd.scoreBefore,
      scoreAfter: pd.scoreAfter,
      stageBefore: pd.stageBefore,
      stageAfter: pd.stageAfter,
    };
  }
  return { players, winnerId: last.winnerId };
}

function buildGameDataForPlayer(s: InternalState, socketId: string): BNW2GameData {
  const purin = isPurinInsightViewer(s.playMode, socketId, s.player1, s.player2);
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) && id !== socketId ? ANONYMOUS_NICKNAME : nick;
  const players: Record<string, BNW2PlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, socketId === s.player1.id || (purin && socketId === s.player2.id)), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, socketId === s.player2.id || (purin && socketId === s.player1.id)), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };
  return {
    phase: s.phase,
    round: s.round,
    firstPlayerId: s.firstPlayerId,
    players,
    prevFirstStage: s.phase === 'secondSubmit' ? s.prevFirstStage : null,
    firstPlayerColor: s.phase === 'secondSubmit' && s.firstPoints !== null ? calcBNW2Color(s.firstPoints) : null,
    revealData: buildRevealData(s),
    roundHistory: s.actionLog.map(logToRecord),
    winner: s.winner,
    winType: s.winType,
  };
}

function buildSpectatorGameData(s: InternalState): BNW2GameData {
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) ? ANONYMOUS_NICKNAME : nick;
  const players: Record<string, BNW2PlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, false), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, false), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };
  return {
    phase: s.phase,
    round: s.round,
    firstPlayerId: s.firstPlayerId,
    players,
    prevFirstStage: s.phase === 'secondSubmit' ? s.prevFirstStage : null,
    firstPlayerColor: s.phase === 'secondSubmit' && s.firstPoints !== null ? calcBNW2Color(s.firstPoints) : null,
    revealData: buildRevealData(s),
    roundHistory: s.actionLog.map(logToRecord),
    winner: s.winner,
    winType: s.winType,
  };
}

function logToRecord(log: BNW2RoundLog) {
  const players: Record<string, {
    color: import('@shared/types/bnw2.js').BNW2Color;
    points: number;
    scoreChange: number; scoreBefore: number; scoreAfter: number;
    stageBefore: number; stageAfter: number;
  }> = {};
  for (const [pid, pd] of Object.entries(log.players)) {
    players[pid] = {
      color: pd.color,
      points: pd.points,
      scoreChange: pd.scoreChange,
      scoreBefore: pd.scoreBefore,
      scoreAfter: pd.scoreAfter,
      stageBefore: pd.stageBefore,
      stageAfter: pd.stageAfter,
    };
  }
  return { round: log.round, firstPlayerId: log.firstPlayerId, players, winnerId: log.winnerId };
}

function buildGameState(s: InternalState, gameData: BNW2GameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: s.phase === 'firstSubmit' ? s.firstPlayerId : null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds ? s.turnStartedAt : null,
    gameData,
  };
}

/* ────────── broadcast ────────── */

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
      const oppId = pid === s.player1.id ? s.player2.id : s.player1.id;
      if (s.phase === 'reveal' || s.phase === 'finished') {
        const last = s.actionLog[s.actionLog.length - 1];
        const d = last?.players[oppId];
        if (d) {
          const oppNick = isTokenAnonymized(s.roomId, oppId) ? ANONYMOUS_NICKNAME : d.nickname;
          sock.emit('ext:data', { game: 'bnw2', round: last!.round, opponent: oppNick, color: d.color, points: d.points });
        }
      } else if (s.phase === 'secondSubmit' && s.firstPoints !== null && pid !== s.firstPlayerId) {
        const fp = getFirstPlayer(s);
        const fpNick = isTokenAnonymized(s.roomId, fp.id) ? ANONYMOUS_NICKNAME : fp.nickname;
        sock.emit('ext:data', { game: 'bnw2', round: s.round, opponent: fpNick, color: calcBNW2Color(s.firstPoints), points: s.firstPoints });
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
    const oppId = pid === s.player1.id ? s.player2.id : s.player1.id;
    if (s.phase === 'reveal' || s.phase === 'finished') {
      const last = s.actionLog[s.actionLog.length - 1];
      const d = last?.players[oppId];
      if (d) {
        const oppNick = isTokenAnonymized(s.roomId, oppId) ? ANONYMOUS_NICKNAME : d.nickname;
        socket.emit('ext:data', { game: 'bnw2', round: last!.round, opponent: oppNick, color: d.color, points: d.points });
      }
    } else if (s.phase === 'secondSubmit' && s.firstPoints !== null && pid !== s.firstPlayerId) {
      const fp = getFirstPlayer(s);
      const fpNick = isTokenAnonymized(s.roomId, fp.id) ? ANONYMOUS_NICKNAME : fp.nickname;
      socket.emit('ext:data', { game: 'bnw2', round: s.round, opponent: fpNick, color: calcBNW2Color(s.firstPoints), points: s.firstPoints });
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

function armTimer(io: IO, s: InternalState, onTimeout: () => void) {
  clearRoundTimer(s);
  if (!s.timeLimitSeconds) return;
  s.turnStartedAt = Date.now();
  s.roundTimer = setTimeout(onTimeout, s.timeLimitSeconds * 1000);
}

export function startFirstSubmitTimer(io: IO, s: InternalState) {
  armTimer(io, s, () => handleFirstTimeout(io, s));
}

function startSecondSubmitTimer(io: IO, s: InternalState) {
  armTimer(io, s, () => handleSecondTimeout(io, s));
}

function handleFirstTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'firstSubmit') return;
  const fp = getFirstPlayer(s);
  processFirstSubmit(io, s, autoSubmitPoints(fp.remainingPoints));
}

function handleSecondTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'secondSubmit') return;
  const sp = getSecondPlayer(s);
  processSecondSubmit(io, s, autoSubmitPoints(sp.remainingPoints));
}

/* ────────── undo ────────── */

function snapshotPlayer(p: BNW2PlayerInternal): BNW2PlayerSnapshot {
  return { score: p.score, remainingPoints: p.remainingPoints, submitted: p.submitted };
}

function restorePlayer(p: BNW2PlayerInternal, snap: BNW2PlayerSnapshot) {
  p.score = snap.score;
  p.remainingPoints = snap.remainingPoints;
  p.submitted = snap.submitted;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    firstPlayerId: s.firstPlayerId,
    firstPoints: s.firstPoints,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as BNW2RoundLog[],
  });
}

function applyUndoSnapshot(s: InternalState, snap: BNW2UndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.firstPlayerId = snap.firstPlayerId;
  s.firstPoints = snap.firstPoints;
  s.secondPoints = null;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as BNW2RoundLog[];
}

function hasPartialRound(s: InternalState): boolean {
  return s.phase !== 'firstSubmit';
}

export function performBNW2Undo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  s.aiGeneration++;
  clearRoundTimer(s);

  if (hasPartialRound(s)) {
    if (s.undoSnapshots.length < 1) return false;
    applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    startFirstSubmitTimer(io, s);
    broadcastState(io, s);
    if (s.playMode === 'com') s.onAITurn?.(io, s);
    return true;
  }

  if (s.undoSnapshots.length < 2) return false;
  s.undoSnapshots.pop();
  applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  startFirstSubmitTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
  return true;
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
        { playerId: winnerId, nickname: winnerNick, rank: 1, score: (winnerId === p1.id ? p1 : p2).score },
        { playerId: loserId!, nickname: loserNick, rank: 2, score: (loserId === p1.id ? p1 : p2).score },
      ]
    : [
        { playerId: p1.id, nickname: p1.nickname, rank: 1, score: p1.score },
        { playerId: p2.id, nickname: p2.nickname, rank: 1, score: p2.score },
      ];

  const payload = {
    rankings,
    totalTurns: s.round,
    gameResultData: {
      winType: s.winType,
      finalScores: { [p1.id]: p1.score, [p2.id]: p2.score },
      finalPoints: { [p1.id]: p1.remainingPoints, [p2.id]: p2.remainingPoints },
      actions: s.actionLog.map(logToRecord),
      players: { [p1.id]: { nickname: p1.nickname }, [p2.id]: { nickname: p2.nickname } },
    },
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, WIN_DISPLAY_MS);
}

/* ────────── core processing ────────── */

function checkGameOver(io: IO, s: InternalState): boolean {
  const p1 = s.player1;
  const p2 = s.player2;

  if (p1.score >= BNW2_MAX_SCORE) {
    resolveGame(io, s, p1.id, p1.nickname, p2.id, p2.nickname, 'score');
    return true;
  }
  if (p2.score >= BNW2_MAX_SCORE) {
    resolveGame(io, s, p2.id, p2.nickname, p1.id, p1.nickname, 'score');
    return true;
  }

  if (p1.remainingPoints === 0 && p2.remainingPoints === 0) {
    if (p1.score > p2.score) {
      resolveGame(io, s, p1.id, p1.nickname, p2.id, p2.nickname, 'exhaustion');
    } else if (p2.score > p1.score) {
      resolveGame(io, s, p2.id, p2.nickname, p1.id, p1.nickname, 'exhaustion');
    } else {
      const fp = getFirstPlayer(s);
      const sp = getSecondPlayer(s);
      resolveGame(io, s, fp.id, fp.nickname, sp.id, sp.nickname, 'draw');
    }
    return true;
  }

  return false;
}

function processReveal(io: IO, s: InternalState) {
  clearRoundTimer(s);

  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  const fPts = s.firstPoints!;
  const sPts = s.secondPoints!;

  const { winnerId } = judgeRound(fPts, sPts);

  const fStageBefore = calcBNW2Stage(fp.remainingPoints + fPts);
  const sStageBefore = calcBNW2Stage(sp.remainingPoints + sPts);

  const fScoreBefore = fp.score;
  const sScoreBefore = sp.score;

  if (winnerId === 'first') {
    fp.score += 1;
  } else if (winnerId === 'second') {
    sp.score += 1;
  }

  const log: BNW2RoundLog = {
    round: s.round,
    firstPlayerId: s.firstPlayerId,
    players: {
      [fp.id]: {
        nickname: fp.nickname,
        points: fPts,
        color: calcBNW2Color(fPts),
        scoreChange: fp.score - fScoreBefore,
        scoreBefore: fScoreBefore,
        scoreAfter: fp.score,
        stageBefore: fStageBefore,
        stageAfter: calcBNW2Stage(fp.remainingPoints),
      },
      [sp.id]: {
        nickname: sp.nickname,
        points: sPts,
        color: calcBNW2Color(sPts),
        scoreChange: sp.score - sScoreBefore,
        scoreBefore: sScoreBefore,
        scoreAfter: sp.score,
        stageBefore: sStageBefore,
        stageAfter: calcBNW2Stage(sp.remainingPoints),
      },
    },
    winnerId: winnerId === 'first' ? fp.id : winnerId === 'second' ? sp.id : null,
  };
  s.actionLog.push(log);

  s.phase = 'reveal';
  broadcastState(io, s);

  if (checkGameOver(io, s)) return;

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, REVEAL_DELAY_MS);
}

export function processFirstSubmit(io: IO, s: InternalState, points: number) {
  const fp = getFirstPlayer(s);
  s.prevFirstStage = calcBNW2Stage(fp.remainingPoints);
  fp.remainingPoints -= points;
  fp.submitted = true;
  s.firstPoints = points;
  s.phase = 'secondSubmit';

  broadcastState(io, s);
  startSecondSubmitTimer(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

export function processSecondSubmit(io: IO, s: InternalState, points: number) {
  const sp = getSecondPlayer(s);
  sp.remainingPoints -= points;
  sp.submitted = true;
  s.secondPoints = points;

  processReveal(io, s);
}

export function advanceRound(io: IO, s: InternalState) {
  s.round++;

  // 이전 라운드 승자가 선플. 무승부면 현재 선플 유지
  const last = s.actionLog[s.actionLog.length - 1];
  if (last?.winnerId != null) {
    s.firstPlayerId = last.winnerId;
  }

  s.firstPoints = null;
  s.secondPoints = null;
  s.phase = 'firstSubmit';

  s.player1.submitted = false;
  s.player2.submitted = false;

  pushUndoSnapshot(s);
  startFirstSubmitTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── timeout handler ────────── */

export function handleBNW2Timeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);
  const p1 = s.player1;
  const p2 = s.player2;
  const winner = p1.submitted ? p1 : p2.submitted ? p2 : null;
  if (winner) {
    const loser = winner.id === p1.id ? p2 : p1;
    resolveGame(io, s, winner.id, winner.nickname, loser.id, loser.nickname, 'timeout');
  } else {
    const fp = getFirstPlayer(s);
    const sp = getSecondPlayer(s);
    resolveGame(io, s, fp.id, fp.nickname, sp.id, sp.nickname, 'draw');
  }
}

/* ────────── public helpers ────────── */

export function getBNW2ResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  const p1 = s.player1;
  const p2 = s.player2;
  return {
    winType: s.winType,
    finalScores: { [p1.id]: p1.score, [p2.id]: p2.score },
    finalPoints: { [p1.id]: p1.remainingPoints, [p2.id]: p2.remainingPoints },
    actions: s.actionLog.map(logToRecord),
    players: { [p1.id]: { nickname: p1.nickname }, [p2.id]: { nickname: p2.nickname } },
  };
}

export function makePlayer(id: string, nickname: string): BNW2PlayerInternal {
  return {
    id,
    nickname,
    score: 0,
    remainingPoints: BNW2_INITIAL_POINTS,
    submitted: false,
  };
}
