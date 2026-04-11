import type { GameState } from '@shared/types/events.js';
import type { NumberFourGameData, NF4PlayerInfo, NF4Number, NF4RoundRecord } from '@shared/types/number4.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { TOTAL_ROUNDS, TILES_PER_ROUND, REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState, InternalRoundRecord, NF4PlayerInternal, NF4UndoSnapshot } from './types.js';
import { judgeNumber, tiebreaker } from './judge.js';
import { socketRoom } from '../../utils.js';

export const gameStates = new Map<string, InternalState>();

/* ────────────────────── helpers ──────────────────────── */

function playerToInfo(p: NF4PlayerInternal, isMe: boolean): NF4PlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    remainingWhite: isMe ? p.remainingWhite : -1,
    remainingBlack: isMe ? p.remainingBlack : -1,
    submitted: p.submitted,
  };
}

/** InternalRoundRecord → NF4RoundRecord (타일 수치 제거) */
function toClientRoundHistory(history: InternalRoundRecord[]): NF4RoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    players: Object.fromEntries(
      Object.entries(r.players).map(([pid, pr]) => [
        pid,
        { number: pr.number, success: pr.success, scoreChange: pr.scoreChange, scoreAfter: pr.scoreAfter },
      ]),
    ),
  }));
}

/* ────────────────────── broadcasting ─────────────────── */

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    if (s.winType === 'timeout') return '시간 초과로 게임이 종료되었습니다.';
    if (s.winType === 'elimination') return '승점 0점으로 탈락하여 게임이 종료되었습니다.';
    return '게임이 종료되었습니다.';
  }

  if (s.phase === 'reveal') return `라운드 ${s.round} — 결과`;

  if (s.playMode === 'solo' && s.currentSide) {
    const label = s.currentSide === 'player1' ? '1P' : '2P';
    if (s.phase === 'tileSubmit') return `라운드 ${s.round} — ${label} 타일을 선택하세요`;
    if (s.phase === 'numberSubmit') return `라운드 ${s.round} — ${label} 넘버를 선택하세요`;
  }

  if (s.phase === 'tileSubmit') return `라운드 ${s.round} — 타일을 선택하세요`;
  if (s.phase === 'numberSubmit') return `라운드 ${s.round} — 넘버를 선택하세요`;
  return '';
}

function buildGameDataForPlayer(s: InternalState, socketId: string): NumberFourGameData {
  const isPlayer1 = socketId === s.player1.id;
  const isPlayer2 = socketId === s.player2.id;
  const isSolo = s.playMode === 'solo';

  const players: Record<string, NF4PlayerInfo> = {};

  if (isSolo) {
    players[s.player1.id] = playerToInfo(s.player1, true);
    players[s.player2.id] = playerToInfo(s.player2, true);
  } else {
    players[s.player1.id] = playerToInfo(s.player1, isPlayer1);
    players[s.player2.id] = playerToInfo(s.player2, isPlayer2);
  }

  return {
    round: s.round,
    phase: s.phase,
    players,
    revealData: null,
    roundHistory: toClientRoundHistory(s.roundHistory),
    winner: s.winner,
    winType: s.winType,
    tiebreakerReason: s.tiebreakerReason,
    currentSide: s.currentSide,
  };
}

function buildRevealGameData(s: InternalState, socketId: string): NumberFourGameData {
  const data = buildGameDataForPlayer(s, socketId);
  const lastHistory = s.roundHistory[s.roundHistory.length - 1];

  if (lastHistory) {
    const revealPlayers: Record<string, import('@shared/types/number4.js').NF4RevealPlayerData> = {};
    const lastLog = s.actionLog[s.actionLog.length - 1];

    for (const [pid, rec] of Object.entries(lastHistory.players)) {
      const logPlayer = lastLog?.players[pid];
      revealPlayers[pid] = {
        number: rec.number,
        success: rec.success,
        scoreChange: rec.scoreChange,
        conditionDetail: logPlayer?.conditionDetail ?? '',
      };
    }
    data.revealData = { players: revealPlayers };
  }

  return data;
}

function buildGameState(s: InternalState, gameData: NumberFourGameData): GameState {
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
    const gameData = s.phase === 'reveal' || s.phase === 'finished'
      ? buildRevealGameData(s, sock.id)
      : buildGameDataForPlayer(s, sock.id);
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const gameData = s.phase === 'reveal' || s.phase === 'finished'
    ? buildRevealGameData(s, socket.id)
    : buildGameDataForPlayer(s, socket.id);
  socket.emit('game:state', buildGameState(s, gameData));
}

/* ────────────────────── turn timer ──────────────────── */

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
  s.roundTimer = setTimeout(() => {
    handleTimeout(io, s);
  }, s.timeLimitSeconds * 1000);
}

export function startRoundTimer(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armRoundTimer(io, s);
}

/* ────────────────────── undo snapshots ───────────── */

function snapshotPlayer(p: NF4PlayerInternal): NF4UndoSnapshot['player1'] {
  return {
    score: p.score,
    remainingWhite: p.remainingWhite,
    remainingBlack: p.remainingBlack,
    submitted: p.submitted,
    submittedWhite: p.submittedWhite,
    submittedBlack: p.submittedBlack,
    submittedNumber: p.submittedNumber,
  };
}

function restorePlayer(p: NF4PlayerInternal, snap: NF4UndoSnapshot['player1']) {
  p.score = snap.score;
  p.remainingWhite = snap.remainingWhite;
  p.remainingBlack = snap.remainingBlack;
  p.submitted = snap.submitted;
  p.submittedWhite = snap.submittedWhite;
  p.submittedBlack = snap.submittedBlack;
  p.submittedNumber = snap.submittedNumber;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    roundHistory: JSON.parse(JSON.stringify(s.roundHistory)) as InternalRoundRecord[],
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as InternalState['actionLog'],
    currentSide: s.currentSide,
    aiTargetNumber: s.aiTargetNumber,
  });
}

function applyNF4UndoSnapshot(s: InternalState, snap: NF4UndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.roundHistory = JSON.parse(JSON.stringify(snap.roundHistory)) as InternalRoundRecord[];
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as InternalState['actionLog'];
  s.currentSide = snap.currentSide;
  s.aiTargetNumber = snap.aiTargetNumber;
}

function hasPartialRoundNF4(s: InternalState): boolean {
  if (s.phase !== 'tileSubmit') return true;
  return (
    s.player1.submitted || s.player2.submitted ||
    s.player1.submittedWhite !== null || s.player2.submittedWhite !== null
  );
}

export function performNumberFourUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  s.aiGeneration++;
  clearRoundTimer(s);

  if (hasPartialRoundNF4(s)) {
    if (s.undoSnapshots.length < 1) return false;
    applyNF4UndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    armRoundTimer(io, s);
    broadcastState(io, s);
    return true;
  }

  if (s.undoSnapshots.length < 2) return false;
  s.undoSnapshots.pop();
  const prev = s.undoSnapshots[s.undoSnapshots.length - 1];
  applyNF4UndoSnapshot(s, prev);
  armRoundTimer(io, s);
  broadcastState(io, s);
  return true;
}

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);

  // submitted 플래그는 페이즈 전환 시 리셋되므로 현재 페이즈 기준으로 올바르게 동작
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

function autoSubmitDefaults(p: NF4PlayerInternal) {
  if (p.submittedWhite === null) {
    const w = Math.min(4, p.remainingWhite);
    p.submittedWhite = w;
    p.submittedBlack = TILES_PER_ROUND - w;
    if (p.submittedBlack > p.remainingBlack) {
      p.submittedBlack = p.remainingBlack;
      p.submittedWhite = TILES_PER_ROUND - p.submittedBlack;
    }
  }
  if (p.submittedNumber === null) {
    p.submittedNumber = 1;
  }
  p.submitted = true;
}

/* ────────────────────── game resolution ──────────────── */

function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string,
  winnerNick: string,
  loserId: string,
  loserNick: string,
  winType: InternalState['winType'],
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  broadcastState(io, s);

  const payload = {
    rankings: [
      { playerId: winnerId, nickname: winnerNick, rank: 1, score: s.player1.id === winnerId ? s.player1.score : s.player2.score },
      { playerId: loserId, nickname: loserNick, rank: 2, score: s.player1.id === loserId ? s.player1.score : s.player2.score },
    ],
    totalTurns: s.round,
    gameResultData: {
      winType: s.winType,
      tiebreakerReason: s.tiebreakerReason,
      finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
      roundHistory: s.roundHistory,
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

/* ────────────────────── round processing ─────────────── */

function delayedResolve(
  io: IO,
  s: InternalState,
  winnerId: string,
  loserId: string,
  winType: InternalState['winType'],
) {
  const winnerP = winnerId === s.player1.id ? s.player1 : s.player2;
  const loserP = loserId === s.player1.id ? s.player1 : s.player2;
  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    if (s.aiGeneration !== gen) return;
    resolveGame(io, s, winnerId, winnerP.nickname, loserId, loserP.nickname, winType);
  }, REVEAL_DELAY_MS);
}

export function processRound(io: IO, s: InternalState) {
  clearRoundTimer(s);

  const p1w = s.player1.submittedWhite!;
  const p1b = s.player1.submittedBlack!;
  const p1n = s.player1.submittedNumber!;
  const p2w = s.player2.submittedWhite!;
  const p2b = s.player2.submittedBlack!;
  const p2n = s.player2.submittedNumber!;

  const j1 = judgeNumber(p1w, p1b, p2w, p2b, p1n);
  const j2 = judgeNumber(p2w, p2b, p1w, p1b, p2n);

  const p1ScoreBefore = s.player1.score;
  const p2ScoreBefore = s.player2.score;

  s.player1.score = Math.max(0, s.player1.score + j1.scoreChange);
  s.player2.score = Math.max(0, s.player2.score + j2.scoreChange);

  s.player1.remainingWhite -= p1w;
  s.player1.remainingBlack -= p1b;
  s.player2.remainingWhite -= p2w;
  s.player2.remainingBlack -= p2b;

  const roundRecord: InternalRoundRecord = {
    round: s.round,
    players: {
      [s.player1.id]: {
        white: p1w, black: p1b, number: p1n,
        success: j1.success, scoreChange: j1.scoreChange, scoreAfter: s.player1.score,
      },
      [s.player2.id]: {
        white: p2w, black: p2b, number: p2n,
        success: j2.success, scoreChange: j2.scoreChange, scoreAfter: s.player2.score,
      },
    },
  };
  s.roundHistory.push(roundRecord);

  s.actionLog.push({
    round: s.round,
    players: {
      [s.player1.id]: {
        nickname: s.player1.nickname,
        white: p1w, black: p1b, number: p1n,
        success: j1.success, scoreChange: j1.scoreChange,
        scoreBefore: p1ScoreBefore, scoreAfter: s.player1.score,
        conditionDetail: j1.conditionDetail,
      },
      [s.player2.id]: {
        nickname: s.player2.nickname,
        white: p2w, black: p2b, number: p2n,
        success: j2.success, scoreChange: j2.scoreChange,
        scoreBefore: p2ScoreBefore, scoreAfter: s.player2.score,
        conditionDetail: j2.conditionDetail,
      },
    },
  });

  s.phase = 'reveal';
  broadcastState(io, s);

  const p1Dead = s.player1.score === 0;
  const p2Dead = s.player2.score === 0;

  if (p1Dead && p2Dead) {
    const tb = tiebreaker(s);
    s.tiebreakerReason = tb.reason;
    const loserId = tb.winnerId === s.player1.id ? s.player2.id : s.player1.id;
    delayedResolve(io, s, tb.winnerId, loserId, 'tiebreaker');
    return;
  }

  if (p1Dead) {
    delayedResolve(io, s, s.player2.id, s.player1.id, 'elimination');
    return;
  }

  if (p2Dead) {
    delayedResolve(io, s, s.player1.id, s.player2.id, 'elimination');
    return;
  }

  if (s.round >= TOTAL_ROUNDS) {
    if (s.player1.score !== s.player2.score) {
      const winnerId = s.player1.score > s.player2.score ? s.player1.id : s.player2.id;
      const loserId = winnerId === s.player1.id ? s.player2.id : s.player1.id;
      delayedResolve(io, s, winnerId, loserId, 'score');
    } else {
      const tb = tiebreaker(s);
      s.tiebreakerReason = tb.reason;
      const loserId = tb.winnerId === s.player1.id ? s.player2.id : s.player1.id;
      delayedResolve(io, s, tb.winnerId, loserId, 'tiebreaker');
    }
    return;
  }

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    if (s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, REVEAL_DELAY_MS);
}

/* ────────────────────── round advance ────────────────── */

export function advanceRound(io: IO, s: InternalState) {
  s.round++;
  s.phase = 'tileSubmit';

  resetSubmissions(s.player1);
  resetSubmissions(s.player2);

  const p1Total = s.player1.remainingWhite + s.player1.remainingBlack;
  const p2Total = s.player2.remainingWhite + s.player2.remainingBlack;

  if (p1Total === TILES_PER_ROUND) {
    s.player1.submittedWhite = s.player1.remainingWhite;
    s.player1.submittedBlack = s.player1.remainingBlack;
    s.player1.submitted = true;
  }
  if (p2Total === TILES_PER_ROUND) {
    s.player2.submittedWhite = s.player2.remainingWhite;
    s.player2.submittedBlack = s.player2.remainingBlack;
    s.player2.submitted = true;
  }

  if (s.player1.submitted && s.player2.submitted) {
    s.phase = 'numberSubmit';
    s.player1.submitted = false;
    s.player2.submitted = false;
  }

  if (s.playMode === 'solo') {
    s.currentSide = 'player1';
  }

  startRoundTimer(io, s);
  broadcastState(io, s);
}

function resetSubmissions(p: NF4PlayerInternal) {
  p.submitted = false;
  p.submittedWhite = null;
  p.submittedBlack = null;
  p.submittedNumber = null;
}
