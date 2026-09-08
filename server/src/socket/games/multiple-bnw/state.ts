import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import type { GameState } from '@shared/types/events.js';
import { sessions } from '../../../store/sessions.js';
import type {
  MultipleBnwGameData, MBNWPlayerInfo, MBNWRoundRecord, MBNWResultData,
  MBNWColorReveal, MBNWSuspectResult, MBNWTile,
} from '@shared/types/multiple-bnw.js';
import { MBNW_TILE_COLOR, MBNW_TOTAL_ROUNDS } from '@shared/types/multiple-bnw.js';
import { REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  InternalState, MBNWPlayerInternal, MBNWRoundActionLog,
  MBNWPlayerSnapshot, MBNWUndoSnapshot,
} from './types.js';
import { judgeMultiple } from './judge.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

function getFirstPlayer(s: InternalState): MBNWPlayerInternal {
  return s.player1.id === s.firstPlayerId ? s.player1 : s.player2;
}

function getSecondPlayer(s: InternalState): MBNWPlayerInternal {
  return s.player1.id === s.firstPlayerId ? s.player2 : s.player1;
}

function playerToInfo(p: MBNWPlayerInternal): MBNWPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    remainingTiles: [...p.remainingTiles],
    submitted: p.submitted,
    isFirst: p.isFirst,
  };
}

function toClientRoundHistory(history: MBNWRoundActionLog[]): MBNWRoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    firstPlayerId: r.firstPlayerId,
    players: Object.fromEntries(
      Object.entries(r.players).map(([pid, pr]) => [
        pid,
        {
          color: pr.tileColor,
          suspected: pr.suspected,
          suspectSuccess: pr.suspectSuccess,
          bonusPoint: pr.bonusPoint,
          normalPoint: pr.normalPoint,
          scoreAfter: pr.scoreAfter,
        },
      ]),
    ),
  }));
}

/* ────────── broadcasting ────────── */

function phaseMessage(s: InternalState, viewerToken: string): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  const maskNick = (p: MBNWPlayerInternal) =>
    isTokenAnonymized(s.roomId, p.id) && p.id !== viewerToken ? ANONYMOUS_NICKNAME : p.nickname;
  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  switch (s.phase) {
    case 'tileSubmit': return `라운드 ${s.round} — ${maskNick(fp)}(선플)이 타일을 선택 중...`;
    case 'tileRespond': return `라운드 ${s.round} — ${maskNick(sp)}(후플)이 응답 중...`;
    case 'suspectFirst': return `라운드 ${s.round} — ${maskNick(fp)}(선플)이 배수의심 여부를 결정 중...`;
    case 'suspectSecond': return `라운드 ${s.round} — ${maskNick(sp)}(후플)이 배수의심 여부를 결정 중...`;
    case 'result': return `라운드 ${s.round} — 결과`;
    default: return '';
  }
}

function buildGameDataForPlayer(s: InternalState, pid: string): MultipleBnwGameData {
  const isPlayer = pid === s.player1.id || pid === s.player2.id;
  const myPlayer = pid === s.player1.id ? s.player1 : pid === s.player2.id ? s.player2 : null;
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) && id !== pid ? ANONYMOUS_NICKNAME : nick;

  const players: Record<string, MBNWPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };

  // 잔여 타일은 본인에게만 전달, 상대/관전자에게는 빈 배열
  const _dbg = !!myPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid));
  if (myPlayer) {
    const opponentId = myPlayer.id === s.player1.id ? s.player2.id : s.player1.id;
    if (!_dbg) {
      players[opponentId].remainingTiles = [];
    }
  } else {
    players[s.player1.id].remainingTiles = [];
    players[s.player2.id].remainingTiles = [];
  }

  let resultData: MBNWResultData | null = null;
  if ((s.phase === 'result' || s.phase === 'finished') && s.actionLog.length > 0) {
    const last = s.actionLog[s.actionLog.length - 1];
    const hasSuspectWinner = Object.values(last.players).some(pr => pr.suspectSuccess === true);
    const allNormalPoints = Object.values(last.players).map(pr => pr.normalPoint);
    const anyNormalWinner = !hasSuspectWinner && allNormalPoints.some(n => n > 0);

    resultData = {
      players: Object.fromEntries(
        Object.entries(last.players).map(([id, pr]) => {
          let normalWin: boolean | null = null;
          if (!hasSuspectWinner) {
            normalWin = pr.normalPoint > 0 ? true : (anyNormalWinner ? false : null);
          }
          return [id, {
            color: pr.tileColor,
            suspected: pr.suspected,
            suspectSuccess: pr.suspectSuccess,
            bonusPoint: pr.bonusPoint,
            normalWin,
            normalPoint: pr.normalPoint,
            totalScoreChange: pr.totalScoreChange,
            scoreAfter: pr.scoreAfter,
          }];
        }),
      ),
    };
  }

  // suspectResult: 관전자에게는 result 전까지 의심 선언 여부 숨김
  let suspectResult: MBNWSuspectResult | null = null;
  if (s.suspectResult) {
    if (isPlayer) {
      suspectResult = { ...s.suspectResult };
    } else if (s.phase === 'result' || s.phase === 'finished') {
      suspectResult = { ...s.suspectResult };
    }
  }

  // 의심 페이즈에서 본인 타일 숫자 전달
  let myTile: number | null = null;
  if (myPlayer?.currentTile != null &&
      (s.phase === 'suspectFirst' || s.phase === 'suspectSecond')) {
    myTile = myPlayer.currentTile;
  }

  const base: MultipleBnwGameData = {
    round: s.round,
    phase: s.phase,
    firstPlayerId: s.firstPlayerId,
    players,
    colorReveal: s.colorReveal ? { ...s.colorReveal } : null,
    suspectResult,
    resultData,
    roundHistory: toClientRoundHistory(s.roundHistory),
    winner: s.winner,
    winType: s.winType,
    myTile,
  };

  if (_dbg && myPlayer && (s.phase === 'tileRespond' || s.phase === 'suspectFirst' || s.phase === 'suspectSecond')) {
    const opp = myPlayer.id === s.player1.id ? s.player2 : s.player1;
    if (opp.currentTile != null) {
      return {
        ...base,
        _x: { opponentMyTile: opp.currentTile },
      } as MultipleBnwGameData;
    }
  }

  return base;
}

function buildGameState(s: InternalState, gameData: MultipleBnwGameData, viewerToken: string): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s, viewerToken),
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
    sock.emit('game:state', buildGameState(s, gameData, pid));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const gameData = buildGameDataForPlayer(s, pid);
  const raw = gameData as Record<string, unknown>;
  const ext = raw['_x'];
  if (ext !== undefined) { delete raw['_x']; socket.emit('ext:data', ext); }
  socket.emit('game:state', buildGameState(s, gameData, pid));
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
  s.roundTimer = scheduleTurnExpiry(io, s, 'roundTimer', () => (s.phase === 'tileSubmit' || s.phase === 'suspectFirst') ? getFirstPlayer(s).id : (s.phase === 'tileRespond' || s.phase === 'suspectSecond') ? getSecondPlayer(s).id : null, () => handleTimeout(io, s), s.timeLimitSeconds * 1000);
}

export function startPhaseTimer(io: IO, s: InternalState) {
  armRoundTimer(io, s);
}

export function startRoundWithSnapshot(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armRoundTimer(io, s);
}

/* ────────── undo snapshots ────────── */

function snapshotPlayer(p: MBNWPlayerInternal): MBNWPlayerSnapshot {
  return {
    score: p.score,
    remainingTiles: [...p.remainingTiles],
    submitted: p.submitted,
    isFirst: p.isFirst,
    currentTile: p.currentTile,
  };
}

function restorePlayer(p: MBNWPlayerInternal, snap: MBNWPlayerSnapshot) {
  p.score = snap.score;
  p.remainingTiles = [...snap.remainingTiles];
  p.submitted = snap.submitted;
  p.isFirst = snap.isFirst;
  p.currentTile = snap.currentTile;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    firstPlayerId: s.firstPlayerId,
    secondPlayerId: s.secondPlayerId,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    colorReveal: s.colorReveal ? { ...s.colorReveal } : null,
    suspectResult: s.suspectResult ? { ...s.suspectResult } : null,
    roundHistory: JSON.parse(JSON.stringify(s.roundHistory)) as MBNWRoundActionLog[],
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as MBNWRoundActionLog[],
    suspectSuccessCount: { ...s.suspectSuccessCount },
    firstPlayerRounds: { ...s.firstPlayerRounds },
  });
}

function applySnapshot(s: InternalState, snap: MBNWUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.firstPlayerId = snap.firstPlayerId;
  s.secondPlayerId = snap.secondPlayerId;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.colorReveal = snap.colorReveal ? { ...snap.colorReveal } : null;
  s.suspectResult = snap.suspectResult ? { ...snap.suspectResult } : null;
  s.roundHistory = JSON.parse(JSON.stringify(snap.roundHistory)) as MBNWRoundActionLog[];
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as MBNWRoundActionLog[];
  s.suspectSuccessCount = { ...snap.suspectSuccessCount };
  s.firstPlayerRounds = { ...snap.firstPlayerRounds };
}

function hasPartialRound(s: InternalState): boolean {
  return s.phase !== 'tileSubmit';
}

export function performMultipleBnwUndo(io: IO, roomId: string): boolean {
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

  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);

  switch (s.phase) {
    case 'tileSubmit': {
      trackTimeout(s, fp.id);
      if (shouldForceEnd(s, fp.id)) { resolveGame(io, s, sp.id, sp.nickname, 'timeout', fp.id, fp.nickname); return; }
      const tile = fp.remainingTiles[Math.floor(Math.random() * fp.remainingTiles.length)];
      fp.currentTile = tile;
      fp.submitted = true;
      s.colorReveal = { firstPlayerColor: MBNW_TILE_COLOR[tile], secondPlayerColor: null };
      s.phase = 'tileRespond';
      startPhaseTimer(io, s);
      broadcastState(io, s);
      if (s.playMode === 'com') handleAiPhase(io, s);
      break;
    }
    case 'tileRespond': {
      trackTimeout(s, sp.id);
      if (shouldForceEnd(s, sp.id)) { resolveGame(io, s, fp.id, fp.nickname, 'timeout', sp.id, sp.nickname); return; }
      const tile = sp.remainingTiles[Math.floor(Math.random() * sp.remainingTiles.length)];
      sp.currentTile = tile;
      sp.submitted = true;
      s.colorReveal!.secondPlayerColor = MBNW_TILE_COLOR[tile];
      s.phase = 'suspectFirst';
      startPhaseTimer(io, s);
      broadcastState(io, s);
      if (s.playMode === 'com') handleAiPhase(io, s);
      break;
    }
    case 'suspectFirst': {
      trackTimeout(s, fp.id);
      if (shouldForceEnd(s, fp.id)) { resolveGame(io, s, sp.id, sp.nickname, 'timeout', fp.id, fp.nickname); return; }
      s.suspectResult = { firstSuspected: false, firstSuccess: null, secondSkipped: false, secondSuspected: null, secondSuccess: null };
      s.phase = 'suspectSecond';
      startPhaseTimer(io, s);
      broadcastState(io, s);
      if (s.playMode === 'com') handleAiPhase(io, s);
      break;
    }
    case 'suspectSecond': {
      trackTimeout(s, sp.id);
      if (shouldForceEnd(s, sp.id)) { resolveGame(io, s, fp.id, fp.nickname, 'timeout', sp.id, sp.nickname); return; }
      s.suspectResult!.secondSuspected = false;
      processRound(io, s);
      break;
    }
  }
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

/* ────────── round processing ────────── */

export function processRound(io: IO, s: InternalState) {
  clearRoundTimer(s);

  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  const fTile = fp.currentTile!;
  const sTile = sp.currentTile!;
  const sr = s.suspectResult!;

  let fpBonus = 0;
  let spBonus = 0;
  let fpNormal = 0;
  let spNormal = 0;
  let fpSuspected = false;
  let spSuspected = false;
  let fpSuspectSuccess: boolean | null = null;
  let spSuspectSuccess: boolean | null = null;
  let fpDetail: string | null = null;
  let spDetail: string | null = null;

  let suspectWinner: string | null = null;

  // 선플 의심 판정
  if (sr.firstSuspected) {
    fpSuspected = true;
    const result = judgeMultiple(fTile, sTile);
    fpSuspectSuccess = result.success;
    fpDetail = result.detail;
    if (result.success) {
      suspectWinner = fp.id;
      s.suspectSuccessCount[fp.id] = (s.suspectSuccessCount[fp.id] ?? 0) + 1;
    } else {
      spBonus += 1;
    }
  }

  // 후플 의심 판정 (선플 성공이 아닌 경우에만)
  if (!sr.secondSkipped && sr.secondSuspected) {
    spSuspected = true;
    const result = judgeMultiple(sTile, fTile);
    spSuspectSuccess = result.success;
    spDetail = result.detail;
    sr.secondSuccess = result.success;
    if (result.success) {
      suspectWinner = sp.id;
      s.suspectSuccessCount[sp.id] = (s.suspectSuccessCount[sp.id] ?? 0) + 1;
    } else {
      fpBonus += 1;
    }
  }

  // 정상 정산 (의심 성공자가 없을 때만)
  if (!suspectWinner) {
    if (fTile > sTile) fpNormal = 1;
    else if (sTile > fTile) spNormal = 1;
  } else {
    // 의심 성공자에게 +1
    if (suspectWinner === fp.id) fpNormal = 1;
    else spNormal = 1;
  }

  const fpScoreBefore = fp.score;
  const spScoreBefore = sp.score;
  const fpChange = fpBonus + fpNormal;
  const spChange = spBonus + spNormal;
  fp.score += fpChange;
  sp.score += spChange;

  // 타일 소멸
  fp.remainingTiles = fp.remainingTiles.filter(t => t !== fTile);
  sp.remainingTiles = sp.remainingTiles.filter(t => t !== sTile);

  const log: MBNWRoundActionLog = {
    round: s.round,
    firstPlayerId: s.firstPlayerId,
    players: {
      [fp.id]: {
        nickname: fp.nickname,
        tile: fTile,
        tileColor: MBNW_TILE_COLOR[fTile],
        suspected: fpSuspected,
        suspectSuccess: fpSuspectSuccess,
        suspectDetail: fpDetail,
        bonusPoint: fpBonus,
        normalPoint: fpNormal,
        totalScoreChange: fpChange,
        scoreBefore: fpScoreBefore,
        scoreAfter: fp.score,
      },
      [sp.id]: {
        nickname: sp.nickname,
        tile: sTile,
        tileColor: MBNW_TILE_COLOR[sTile],
        suspected: spSuspected,
        suspectSuccess: spSuspectSuccess,
        suspectDetail: spDetail,
        bonusPoint: spBonus,
        normalPoint: spNormal,
        totalScoreChange: spChange,
        scoreBefore: spScoreBefore,
        scoreAfter: sp.score,
      },
    },
  };
  s.roundHistory.push(log);
  s.actionLog.push(log);

  s.phase = 'result';
  broadcastState(io, s);

  if (s.round >= MBNW_TOTAL_ROUNDS) {
    const gen = s.aiGeneration;
    setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      endByScore(io, s);
    }, REVEAL_DELAY_MS);
    return;
  }

  // 다음 라운드 선플 결정: 라운드 승자 → 선플, 무승부면 현재 선플 유지
  const nextFirstPlayerId = fpNormal > 0 ? fp.id : spNormal > 0 ? sp.id : s.firstPlayerId;

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceRound(io, s, nextFirstPlayerId);
  }, REVEAL_DELAY_MS);
}

function endByScore(io: IO, s: InternalState) {
  const p1 = s.player1;
  const p2 = s.player2;

  if (p1.score !== p2.score) {
    const winnerId = p1.score > p2.score ? p1.id : p2.id;
    const loserId = winnerId === p1.id ? p2.id : p1.id;
    const w = winnerId === p1.id ? p1 : p2;
    const l = loserId === p1.id ? p1 : p2;
    resolveGame(io, s, winnerId, w.nickname, 'score', loserId, l.nickname);
    return;
  }

  const s1 = s.suspectSuccessCount[p1.id] ?? 0;
  const s2 = s.suspectSuccessCount[p2.id] ?? 0;
  if (s1 !== s2) {
    const winnerId = s1 > s2 ? p1.id : p2.id;
    const loserId = winnerId === p1.id ? p2.id : p1.id;
    const w = winnerId === p1.id ? p1 : p2;
    const l = loserId === p1.id ? p1 : p2;
    resolveGame(io, s, winnerId, w.nickname, 'suspectCount', loserId, l.nickname);
    return;
  }

  resolveGame(io, s, null, null, 'draw');
}

/* ────────── game resolution ────────── */

function resolveGame(
  io: IO, s: InternalState,
  winnerId: string | null, winnerNick: string | null,
  winType: Exclude<InternalState['winType'], null>,
  loserId?: string,
  loserNick?: string,
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
        { playerId: winnerId, nickname: winnerNick!, rank: 1, score: (winnerId === p1.id ? p1 : p2).score },
        { playerId: loserId!, nickname: loserNick!, rank: 2, score: (loserId === p1.id ? p1 : p2).score },
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
      roundHistory: s.roundHistory,
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

/* ────────── round advance ────────── */

export function advanceRound(io: IO, s: InternalState, nextFirstPlayerId: string) {
  s.round++;

  // 이전 라운드 승자 → 선플, 무승부면 현재 선플 유지
  s.firstPlayerId = nextFirstPlayerId;
  s.secondPlayerId = nextFirstPlayerId === s.player1.id ? s.player2.id : s.player1.id;
  s.firstPlayerRounds[s.firstPlayerId] = (s.firstPlayerRounds[s.firstPlayerId] ?? 0) + 1;

  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  fp.isFirst = true;
  sp.isFirst = false;
  fp.submitted = false;
  sp.submitted = false;
  fp.currentTile = null;
  sp.currentTile = null;

  s.colorReveal = null;
  s.suspectResult = null;
  s.phase = 'tileSubmit';

  startRoundWithSnapshot(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') handleAiPhase(io, s);
}

/* ────────── AI hook ────────── */

function handleAiPhase(io: IO, s: InternalState) {
  s.onAITurn?.(io, s);
}

export { getFirstPlayer, getSecondPlayer };

export function getMultipleBnwResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    winType: s.winType,
    finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
    roundHistory: s.roundHistory,
    actions: s.actionLog,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
  };
}
