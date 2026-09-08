import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  WinningStreakGameData, WSPlayerInfo, WSRevealData,
  WSRoundRecord, WSCardType, WSCardCount,
} from '@shared/types/winning-streak.js';
import { CARD_TYPES, WS_TOTAL_ROUNDS } from '@shared/types/winning-streak.js';
import { REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  InternalState, WSPlayerInternal, WSRoundActionLog,
  WSPlayerSnapshot, WSUndoSnapshot,
} from './types.js';
import { judgeMatch } from './judge.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

function playerToInfo(p: WSPlayerInternal): WSPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    currentStreak: p.currentStreak,
    maxStreak: p.maxStreak,
    totalWins: p.totalWins,
    remainingCards: { ...p.remainingCards },
    lastPlayedCard: p.lastPlayedCard,
    submitted: p.submitted,
  };
}

export function getAvailableCards(player: WSPlayerInternal): WSCardType[] {
  const available: WSCardType[] = [];
  for (const ct of CARD_TYPES) {
    if (player.remainingCards[ct] <= 0) continue;
    if (ct === player.lastPlayedCard) continue;
    available.push(ct);
  }
  if (available.length === 0 && player.lastPlayedCard && player.remainingCards[player.lastPlayedCard] > 0) {
    available.push(player.lastPlayedCard);
  }
  return available;
}

/* ────────── broadcasting ────────── */

function phaseMessage(s: InternalState): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  switch (s.phase) {
    case 'cardSelect': {
      const p1sub = s.player1.submitted;
      const p2sub = s.player2.submitted;
      if (p1sub && p2sub) return `라운드 ${s.round} — 양측 제출 완료`;
      if (p1sub || p2sub) return `라운드 ${s.round} — 상대의 제출을 기다리는 중...`;
      return `라운드 ${s.round} — 카드를 선택하세요`;
    }
    case 'reveal': return `라운드 ${s.round} — 카드 공개!`;
    case 'result': return `라운드 ${s.round} — 결과`;
    default: return '';
  }
}

function buildGameDataForPlayer(s: InternalState, socketId: string): WinningStreakGameData {
  const _dbg = isDbgViewer(s.playMode, sessions.getMemberId(socketId));
  const maskNick = (id: string, nick: string) =>
    nicknameForViewer(s.roomId, id, nick, socketId);
  const players: Record<string, WSPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };

  let revealData: WSRevealData | null = null;
  if ((s.phase === 'reveal' || s.phase === 'result') && s.actionLog.length > 0) {
    const last = s.actionLog[s.actionLog.length - 1];
    revealData = {
      players: Object.fromEntries(
        Object.entries(last.players).map(([id, pr]) => {
          return [id, {
            card: pr.card,
            result: pr.result,
            streakBefore: pr.streakBefore,
            streakAfter: pr.streakAfter,
            maxStreakBefore: pr.maxStreakAfter === pr.streakAfter && pr.streakAfter > 0
              ? pr.maxStreakAfter - 1
              : pr.maxStreakAfter,
            maxStreakAfter: pr.maxStreakAfter,
            maxStreakUpdated: pr.streakAfter === pr.maxStreakAfter && pr.streakAfter > 0
              && (s.roundHistory.length <= 1 || (() => {
                const prevRound = s.roundHistory.length >= 2
                  ? s.roundHistory[s.roundHistory.length - 2]
                  : null;
                return prevRound ? (prevRound.players[id]?.maxStreakAfter ?? 0) < pr.maxStreakAfter : true;
              })()),
            totalWinsAfter: pr.totalWinsAfter,
          }];
        }),
      ),
      matchDescription: last.matchDescription,
    };
  }

  const roundHistory: WSRoundRecord[] = s.roundHistory.map((r) => ({
    round: r.round,
    players: Object.fromEntries(
      Object.entries(r.players).map(([id, pr]) => [id, {
        card: pr.card,
        result: pr.result,
        streakBefore: pr.streakBefore,
        streakAfter: pr.streakAfter,
        maxStreakAfter: pr.maxStreakAfter,
        totalWinsAfter: pr.totalWinsAfter,
      }]),
    ),
  }));

  const base: WinningStreakGameData = {
    round: s.round,
    phase: s.phase,
    players,
    revealData,
    roundHistory,
    winner: s.winner,
    winType: s.winType,
  };

  if (_dbg && s.phase === 'cardSelect') {
    const opp = socketId === s.player1.id ? s.player2 : s.player1;
    return {
      ...base,
      _x: { opponentSelectedCard: opp.selectedCard },
    } as WinningStreakGameData;
  }

  return base;
}

function buildGameState(s: InternalState, gameData: WinningStreakGameData): GameState {
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
    const gameData = buildGameDataForPlayer(s, pid);
    const raw = gameData as Record<string, unknown>;
    const ext = raw['_x'];
    if (ext !== undefined) { delete raw['_x']; sock.emit('ext:data', ext); }
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const gameData = buildGameDataForPlayer(s, pid);
  const raw = gameData as Record<string, unknown>;
  const ext = raw['_x'];
  if (ext !== undefined) { delete raw['_x']; socket.emit('ext:data', ext); }
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

export function startPhaseTimer(io: IO, s: InternalState) {
  armRoundTimer(io, s);
}

export function startRoundWithSnapshot(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armRoundTimer(io, s);
}

/* ────────── undo snapshots ────────── */

function snapshotPlayer(p: WSPlayerInternal): WSPlayerSnapshot {
  return {
    currentStreak: p.currentStreak,
    maxStreak: p.maxStreak,
    totalWins: p.totalWins,
    remainingCards: { ...p.remainingCards },
    lastPlayedCard: p.lastPlayedCard,
    selectedCard: p.selectedCard,
    submitted: p.submitted,
  };
}

function restorePlayer(p: WSPlayerInternal, snap: WSPlayerSnapshot) {
  p.currentStreak = snap.currentStreak;
  p.maxStreak = snap.maxStreak;
  p.totalWins = snap.totalWins;
  p.remainingCards = { ...snap.remainingCards };
  p.lastPlayedCard = snap.lastPlayedCard;
  p.selectedCard = snap.selectedCard;
  p.submitted = snap.submitted;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    roundHistory: JSON.parse(JSON.stringify(s.roundHistory)) as WSRoundActionLog[],
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as WSRoundActionLog[],
  });
}

function applySnapshot(s: InternalState, snap: WSUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.roundHistory = JSON.parse(JSON.stringify(snap.roundHistory)) as WSRoundActionLog[];
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as WSRoundActionLog[];
}

function hasPartialRound(s: InternalState): boolean {
  return s.phase !== 'cardSelect' || s.player1.submitted || s.player2.submitted;
}

export function performWinningStreakUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  s.aiGeneration++;
  clearRoundTimer(s);

  if (hasPartialRound(s)) {
    if (s.undoSnapshots.length < 1) return false;
    applySnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    armRoundTimer(io, s);
    broadcastState(io, s);
    if (s.playMode === 'com') s.onAITurn?.(io, s);
    return true;
  }

  if (s.undoSnapshots.length < 2) return false;
  s.undoSnapshots.pop();
  applySnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  armRoundTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
  return true;
}

/* ────────── timeout ────────── */

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);

  if (s.phase !== 'cardSelect') return;

  const p1 = s.player1;
  const p2 = s.player2;

  if (!p1.submitted) {
    trackTimeout(s, p1.id);
    if (shouldForceEnd(s, p1.id)) {
      resolveGame(io, s, p2.id, p2.nickname, p1.id, p1.nickname, 'timeout');
      return;
    }
    autoSubmitCard(s, p1);
  }

  if (!p2.submitted) {
    trackTimeout(s, p2.id);
    if (shouldForceEnd(s, p2.id)) {
      resolveGame(io, s, p1.id, p1.nickname, p2.id, p2.nickname, 'timeout');
      return;
    }
    autoSubmitCard(s, p2);
  }

  processRound(io, s);
}

function autoSubmitCard(s: InternalState, p: WSPlayerInternal) {
  const available = getAvailableCards(p);
  const card = available[Math.floor(Math.random() * available.length)];
  p.selectedCard = card;
  p.submitted = true;
}

function trackTimeout(s: InternalState, playerId: string) {
  s.consecutiveTimeouts[playerId] = (s.consecutiveTimeouts[playerId] ?? 0) + 1;
}

function shouldForceEnd(s: InternalState, playerId: string): boolean {
  return (s.consecutiveTimeouts[playerId] ?? 0) >= 3;
}

export function resetTimeout(s: InternalState, playerId: string) {
  s.consecutiveTimeouts[playerId] = 0;
}

/* ────────── streak update ────────── */

function updateStreak(
  current: number, max: number, totalWins: number,
  result: 'win' | 'lose' | 'draw_lose' | 'draw_win',
): { streak: number; maxStreak: number; totalWins: number } {
  if (result === 'win' || result === 'draw_win') {
    const newStreak = current + 1;
    return {
      streak: newStreak,
      maxStreak: Math.max(newStreak, max),
      totalWins: totalWins + 1,
    };
  }
  return { streak: 0, maxStreak: max, totalWins };
}

/* ────────── round processing ────────── */

export function processRound(io: IO, s: InternalState) {
  clearRoundTimer(s);

  const p1 = s.player1;
  const p2 = s.player2;
  const c1 = p1.selectedCard!;
  const c2 = p2.selectedCard!;

  const { resultA, resultB, description } = judgeMatch(c1, c2);

  const streakBefore1 = p1.currentStreak;
  const streakBefore2 = p2.currentStreak;

  const s1 = updateStreak(p1.currentStreak, p1.maxStreak, p1.totalWins, resultA);
  const s2 = updateStreak(p2.currentStreak, p2.maxStreak, p2.totalWins, resultB);

  p1.currentStreak = s1.streak;
  p1.maxStreak = s1.maxStreak;
  p1.totalWins = s1.totalWins;

  p2.currentStreak = s2.streak;
  p2.maxStreak = s2.maxStreak;
  p2.totalWins = s2.totalWins;

  p1.remainingCards[c1]--;
  p2.remainingCards[c2]--;

  p1.lastPlayedCard = c1;
  p2.lastPlayedCard = c2;

  const log: WSRoundActionLog = {
    round: s.round,
    players: {
      [p1.id]: {
        nickname: p1.nickname,
        card: c1,
        result: resultA,
        streakBefore: streakBefore1,
        streakAfter: p1.currentStreak,
        maxStreakAfter: p1.maxStreak,
        totalWinsAfter: p1.totalWins,
      },
      [p2.id]: {
        nickname: p2.nickname,
        card: c2,
        result: resultB,
        streakBefore: streakBefore2,
        streakAfter: p2.currentStreak,
        maxStreakAfter: p2.maxStreak,
        totalWinsAfter: p2.totalWins,
      },
    },
    matchDescription: description,
  };
  s.roundHistory.push(log);
  s.actionLog.push(log);

  s.phase = 'reveal';
  broadcastState(io, s);

  if (s.round >= WS_TOTAL_ROUNDS) {
    const gen = s.aiGeneration;
    setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      endByStreak(io, s);
    }, REVEAL_DELAY_MS);
    return;
  }

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, REVEAL_DELAY_MS);
}

function endByStreak(io: IO, s: InternalState) {
  const p1 = s.player1;
  const p2 = s.player2;

  if (p1.maxStreak !== p2.maxStreak) {
    const winnerId = p1.maxStreak > p2.maxStreak ? p1.id : p2.id;
    const loserId = winnerId === p1.id ? p2.id : p1.id;
    const w = winnerId === p1.id ? p1 : p2;
    const l = loserId === p1.id ? p1 : p2;
    resolveGame(io, s, winnerId, w.nickname, loserId, l.nickname, 'streak');
    return;
  }

  if (p1.totalWins !== p2.totalWins) {
    const winnerId = p1.totalWins > p2.totalWins ? p1.id : p2.id;
    const loserId = winnerId === p1.id ? p2.id : p1.id;
    const w = winnerId === p1.id ? p1 : p2;
    const l = loserId === p1.id ? p1 : p2;
    resolveGame(io, s, winnerId, w.nickname, loserId, l.nickname, 'wins');
    return;
  }

  resolveGameDraw(io, s);
}

/* ────────── game resolution ────────── */

function resolveGame(
  io: IO, s: InternalState,
  winnerId: string, winnerNick: string,
  loserId: string, loserNick: string,
  winType: 'streak' | 'wins' | 'timeout' | 'abandon' | 'stuck',
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  broadcastState(io, s);

  const w = winnerId === s.player1.id ? s.player1 : s.player2;
  const l = loserId === s.player1.id ? s.player1 : s.player2;

  const payload = {
    rankings: [
      { playerId: winnerId, nickname: winnerNick, rank: 1, score: w.maxStreak },
      { playerId: loserId, nickname: loserNick, rank: 2, score: l.maxStreak },
    ],
    totalTurns: s.round,
    gameResultData: buildGameResultData(s),
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, WIN_DISPLAY_MS);
}

function resolveGameDraw(io: IO, s: InternalState) {
  s.winner = null;
  s.winType = 'draw';
  s.gameOver = true;
  s.phase = 'finished';
  broadcastState(io, s);

  const p1 = s.player1;
  const p2 = s.player2;

  const payload = {
    rankings: [
      { playerId: p1.id, nickname: p1.nickname, rank: 1, score: p1.maxStreak },
      { playerId: p2.id, nickname: p2.nickname, rank: 1, score: p2.maxStreak },
    ],
    totalTurns: s.round,
    gameResultData: buildGameResultData(s),
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, WIN_DISPLAY_MS);
}

function buildGameResultData(s: InternalState) {
  return {
    winType: s.winType,
    finalStats: {
      [s.player1.id]: { maxStreak: s.player1.maxStreak, totalWins: s.player1.totalWins },
      [s.player2.id]: { maxStreak: s.player2.maxStreak, totalWins: s.player2.totalWins },
    },
    actions: s.actionLog,
    roundHistory: s.roundHistory,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
  };
}

/* ────────── round advance ────────── */

function isStuck(player: WSPlayerInternal): boolean {
  if (!player.lastPlayedCard) return false;
  for (const ct of CARD_TYPES) {
    if (player.remainingCards[ct] <= 0) continue;
    if (ct !== player.lastPlayedCard) return false;
  }
  return player.remainingCards[player.lastPlayedCard] > 0;
}

function advanceRound(io: IO, s: InternalState) {
  s.round++;

  s.player1.selectedCard = null;
  s.player1.submitted = false;
  s.player2.selectedCard = null;
  s.player2.submitted = false;

  s.phase = 'cardSelect';

  const p1Stuck = isStuck(s.player1);
  const p2Stuck = isStuck(s.player2);

  if (p1Stuck || p2Stuck) {
    if (p1Stuck && p2Stuck) {
      endByStreak(io, s);
    } else if (p1Stuck) {
      resolveGame(io, s, s.player2.id, s.player2.nickname, s.player1.id, s.player1.nickname, 'stuck');
    } else {
      resolveGame(io, s, s.player1.id, s.player1.nickname, s.player2.id, s.player2.nickname, 'stuck');
    }
    return;
  }

  startRoundWithSnapshot(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── handle card submission ────────── */

export function trySubmitCard(
  io: IO, s: InternalState, playerId: string, card: WSCardType,
): string | null {
  const player = s.player1.id === playerId ? s.player1 : s.player2.id === playerId ? s.player2 : null;
  if (!player) return null;

  if (player.submitted) return '이미 카드를 제출했습니다.';
  if (!CARD_TYPES.includes(card)) return '올바른 카드 종류가 아닙니다.';
  if (player.remainingCards[card] <= 0) return '해당 카드가 남아있지 않습니다.';

  if (player.lastPlayedCard === card) {
    const available = getAvailableCards(player);
    if (available.length > 1 || (available.length === 1 && available[0] !== card)) {
      return '직전 라운드에 사용한 카드는 연속으로 낼 수 없습니다.';
    }
  }

  player.selectedCard = card;
  player.submitted = true;

  const other = player === s.player1 ? s.player2 : s.player1;
  if (other.submitted) {
    processRound(io, s);
  } else {
    broadcastState(io, s);
  }

  return null;
}

export function getWinningStreakResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return buildGameResultData(s);
}
