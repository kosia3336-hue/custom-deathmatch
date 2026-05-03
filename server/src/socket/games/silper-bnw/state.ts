import type { GameState } from '@shared/types/events.js';
import type {
  SBNWGameData,
  SBNWPlayerInfo,
  SBNWRevealData,
  SBNWRevealSide,
  SBNWRoundRecord,
  SBNWSegmentResolution,
  SBNWSegmentSummary,
  SBNWTile,
  SBNWWinType,
} from '@shared/types/silper-bnw.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import {
  REMATCH_INTRO_MS,
  REVEAL_DELAY_MS,
  SBNW_INITIAL_TILES,
  SBNW_MAX_REMATCH,
  SBNW_MAX_SCORE,
  SBNW_TOTAL_ROUNDS,
  SBNW_TOTAL_TILE_COUNT,
  TIMEOUT_LIMIT,
  WIN_DISPLAY_MS,
} from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import {
  autoSubmitTiles,
  canAnyLegalSubmit,
  consumeTiles,
  judgeRound,
  maxTile,
  resolveTiebreaker,
  tilesToValueStr,
  validateTiles,
  type SubmitErrorReason,
} from './judge.js';
import type {
  InternalState,
  SBNWPlayerInternal,
  SBNWPlayerSnapshot,
  SBNWUndoSnapshot,
} from './types.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

export function makePlayer(id: string, nickname: string): SBNWPlayerInternal {
  return {
    id,
    nickname,
    score: 0,
    tiles: { ...SBNW_INITIAL_TILES },
    tileCount: SBNW_TOTAL_TILE_COUNT,
    submitted: false,
  };
}

export function getFirstPlayer(s: InternalState): SBNWPlayerInternal {
  return s.player1.id === s.firstPlayerId ? s.player1 : s.player2;
}

export function getSecondPlayer(s: InternalState): SBNWPlayerInternal {
  return s.player1.id === s.firstPlayerId ? s.player2 : s.player1;
}

export function getPlayer(s: InternalState, id: string): SBNWPlayerInternal | null {
  if (s.player1.id === id) return s.player1;
  if (s.player2.id === id) return s.player2;
  return null;
}

export function getOpponent(s: InternalState, id: string): SBNWPlayerInternal | null {
  if (s.player1.id === id) return s.player2;
  if (s.player2.id === id) return s.player1;
  return null;
}

function phaseMessage(s: InternalState): string {
  const seg = s.rematchIndex > 0 ? `재대결 ${s.rematchIndex}회차 — ` : '';
  if (s.phase === 'firstSubmit') return `${seg}라운드 ${s.round} — 선 플레이어 타일 제시`;
  if (s.phase === 'secondSubmit') return `${seg}라운드 ${s.round} — 후 플레이어 타일 제시`;
  if (s.phase === 'reveal') return `${seg}라운드 ${s.round} — 결과 공개`;
  if (s.phase === 'rematchIntro') return '재대결 준비 중';
  return '게임이 종료되었습니다.';
}

function playerToInfo(p: SBNWPlayerInternal, revealSelf: boolean): SBNWPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    tiles: revealSelf ? { ...p.tiles } : null,
    tileCount: p.tileCount,
    submitted: p.submitted,
  };
}

function buildRevealSide(tiles: SBNWTile[]): SBNWRevealSide {
  return {
    tilesUsed: [...tiles],
    digits: tiles.length,
    valueStr: tilesToValueStr(tiles),
  };
}

/** 빈 RevealSide — 상대방에게 타일/값을 숨길 때 사용 */
function maskedRevealSide(digits: number): SBNWRevealSide {
  return { tilesUsed: [], digits, valueStr: '' };
}

/**
 * revealData를 뷰어 기준으로 빌드한다.
 * - 본인 카드: 실제 타일 배열 + 값 공개
 * - 상대 카드: 타일/값 숨김(tilesUsed:[], valueStr:''), digits만 공개
 * - 관전자(viewerId=null): 양측 모두 숨김
 */
function buildRevealData(s: InternalState, viewerId: string | null): SBNWRevealData | null {
  if (s.phase !== 'reveal' && s.phase !== 'finished' && s.phase !== 'rematchIntro') return null;
  if (!s.firstTiles || !s.secondTiles) return null;
  const last = s.actionLog[s.actionLog.length - 1] ?? null;

  const firstIsViewer  = viewerId === s.firstPlayerId;
  const secondIsViewer = viewerId != null && viewerId !== s.firstPlayerId;

  return {
    firstPlayerId: s.firstPlayerId,
    first:  firstIsViewer  ? buildRevealSide(s.firstTiles)  : maskedRevealSide(s.firstTiles.length),
    second: secondIsViewer ? buildRevealSide(s.secondTiles) : maskedRevealSide(s.secondTiles.length),
    winnerId: last?.winnerId ?? null,
  };
}

/** 기록실 저장용 — 마스킹 없이 전체 데이터 복제 */
function cloneRoundHistoryFull(actionLog: SBNWRoundRecord[]): SBNWRoundRecord[] {
  return actionLog.map((log) => ({
    round: log.round,
    rematchIndex: log.rematchIndex,
    firstPlayerId: log.firstPlayerId,
    winnerId: log.winnerId,
    players: Object.fromEntries(
      Object.entries(log.players).map(([pid, pd]) => [
        pid,
        {
          nickname: pd.nickname,
          tilesUsed: [...pd.tilesUsed],
          digits: pd.digits,
          valueStr: pd.valueStr,
          scoreBefore: pd.scoreBefore,
          scoreAfter: pd.scoreAfter,
          scoreChange: pd.scoreChange,
          tileCountBefore: pd.tileCountBefore,
          tileCountAfter: pd.tileCountAfter,
        },
      ]),
    ),
  }));
}

/** 기록실 저장용 — 마스킹 없이 세그먼트 복제 */
function cloneSegmentSummaryFull(seg: SBNWSegmentSummary): SBNWSegmentSummary {
  return {
    rematchIndex: seg.rematchIndex,
    firstPlayerIdAtStart: seg.firstPlayerIdAtStart,
    finalScores: { ...seg.finalScores },
    finalTiles: Object.fromEntries(
      Object.entries(seg.finalTiles).map(([pid, t]) => [pid, { ...t }]),
    ) as Record<string, Record<SBNWTile, number>>,
    resolution: seg.resolution,
    winnerId: seg.winnerId,
    rounds: cloneRoundHistoryFull(seg.rounds),
  };
}

/**
 * 라운드 기록을 뷰어 기준으로 복제한다.
 * 상대 플레이어의 tilesUsed / valueStr 는 숨긴다 (digits는 공개).
 */
function cloneRoundHistory(actionLog: SBNWRoundRecord[], viewerId: string | null): SBNWRoundRecord[] {
  return actionLog.map((log) => ({
    round: log.round,
    rematchIndex: log.rematchIndex,
    firstPlayerId: log.firstPlayerId,
    winnerId: log.winnerId,
    players: Object.fromEntries(
      Object.entries(log.players).map(([pid, pd]) => {
        const isSelf = viewerId === pid;
        return [
          pid,
          {
            nickname: pd.nickname,
            tilesUsed: isSelf ? [...pd.tilesUsed] : [],
            digits: pd.digits,
            valueStr: isSelf ? pd.valueStr : '',
            scoreBefore: pd.scoreBefore,
            scoreAfter: pd.scoreAfter,
            scoreChange: pd.scoreChange,
            tileCountBefore: pd.tileCountBefore,
            tileCountAfter: pd.tileCountAfter,
          },
        ];
      }),
    ),
  }));
}

function buildGameDataFor(s: InternalState, viewerId: string | null): SBNWGameData {
  const isP1 = viewerId === s.player1.id;
  const isP2 = viewerId === s.player2.id;
  return {
    phase: s.phase,
    round: s.round,
    firstPlayerId: s.firstPlayerId,
    players: {
      [s.player1.id]: playerToInfo(s.player1, isP1),
      [s.player2.id]: playerToInfo(s.player2, isP2),
    },
    firstHint: s.firstDigits != null ? { digits: s.firstDigits } : null,
    revealData: buildRevealData(s, viewerId),
    roundHistory: cloneRoundHistory(s.actionLog, viewerId),
    segmentsHistory: s.segmentsHistory.map((seg) => cloneSegmentSummary(seg, viewerId)),
    rematchIndex: s.rematchIndex,
    finishReason: s.finishReason,
    winner: s.winner,
    winType: s.winType,
  };
}

function cloneSegmentSummary(seg: SBNWSegmentSummary, viewerId: string | null): SBNWSegmentSummary {
  return {
    rematchIndex: seg.rematchIndex,
    firstPlayerIdAtStart: seg.firstPlayerIdAtStart,
    finalScores: { ...seg.finalScores },
    finalTiles: Object.fromEntries(
      Object.entries(seg.finalTiles).map(([pid, t]) => [pid, { ...t }]),
    ) as Record<string, Record<SBNWTile, number>>,
    resolution: seg.resolution,
    winnerId: seg.winnerId,
    rounds: cloneRoundHistory(seg.rounds, viewerId),
  };
}

function buildGameState(s: InternalState, gameData: SBNWGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn:
      s.phase === 'firstSubmit'
        ? s.firstPlayerId
        : s.phase === 'secondSubmit'
          ? getSecondPlayer(s).id
          : null,
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
    const gameData = buildGameDataFor(s, isPlayer ? pid : null);
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = pid === s.player1.id || pid === s.player2.id;
  const gameData = buildGameDataFor(s, isPlayer ? pid : null);
  socket.emit('game:state', buildGameState(s, gameData));
}

/* ────────── timer ────────── */

export function clearRoundTimer(s: InternalState) {
  if (s.roundTimer) {
    clearTimeout(s.roundTimer);
    s.roundTimer = null;
  }
}

function armTimer(s: InternalState, onTimeout: () => void) {
  clearRoundTimer(s);
  if (!s.timeLimitSeconds) return;
  s.turnStartedAt = Date.now();
  s.roundTimer = setTimeout(onTimeout, s.timeLimitSeconds * 1000);
}

export function startFirstSubmitTimer(io: IO, s: InternalState) {
  armTimer(s, () => handleFirstTimeout(io, s));
}

function startSecondSubmitTimer(io: IO, s: InternalState) {
  armTimer(s, () => handleSecondTimeout(io, s));
}

function handleFirstTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'firstSubmit') return;
  const fp = getFirstPlayer(s);
  s.consecutiveTimeouts[fp.id] = (s.consecutiveTimeouts[fp.id] ?? 0) + 1;
  if (s.consecutiveTimeouts[fp.id] >= TIMEOUT_LIMIT) {
    const winner = getSecondPlayer(s);
    resolveGame(io, s, winner.id, winner.nickname, fp.id, fp.nickname, 'timeout');
    return;
  }
  const tiles = autoSubmitTiles(fp.tiles);
  if (tiles.length === 0) {
    const winner = getSecondPlayer(s);
    resolveGame(io, s, winner.id, winner.nickname, fp.id, fp.nickname, 'autoLoss');
    return;
  }
  s.lastAutoSubmittedBy = fp.id;
  applyFirstSubmit(io, s, tiles);
}

function handleSecondTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'secondSubmit') return;
  const sp = getSecondPlayer(s);
  s.consecutiveTimeouts[sp.id] = (s.consecutiveTimeouts[sp.id] ?? 0) + 1;
  if (s.consecutiveTimeouts[sp.id] >= TIMEOUT_LIMIT) {
    const winner = getFirstPlayer(s);
    resolveGame(io, s, winner.id, winner.nickname, sp.id, sp.nickname, 'timeout');
    return;
  }
  const tiles = autoSubmitTiles(sp.tiles);
  if (tiles.length === 0) {
    const winner = getFirstPlayer(s);
    resolveGame(io, s, winner.id, winner.nickname, sp.id, sp.nickname, 'autoLoss');
    return;
  }
  s.lastAutoSubmittedBy = sp.id;
  applySecondSubmit(io, s, tiles);
}

/* ────────── undo ────────── */

function snapshotPlayer(p: SBNWPlayerInternal): SBNWPlayerSnapshot {
  return {
    score: p.score,
    tiles: { ...p.tiles },
    tileCount: p.tileCount,
    submitted: p.submitted,
  };
}

function restorePlayer(p: SBNWPlayerInternal, snap: SBNWPlayerSnapshot) {
  p.score = snap.score;
  p.tiles = { ...snap.tiles };
  p.tileCount = snap.tileCount;
  p.submitted = snap.submitted;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    rematchIndex: s.rematchIndex,
    firstPlayerId: s.firstPlayerId,
    firstTiles: s.firstTiles ? [...s.firstTiles] : null,
    firstDigits: s.firstDigits,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    actionLog: cloneRoundHistoryFull(s.actionLog),
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
  });
}

function applyUndoSnapshot(s: InternalState, snap: SBNWUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.rematchIndex = snap.rematchIndex;
  s.firstPlayerId = snap.firstPlayerId;
  s.firstTiles = snap.firstTiles ? [...snap.firstTiles] : null;
  s.firstDigits = snap.firstDigits;
  s.secondTiles = null;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.actionLog = cloneRoundHistoryFull(snap.actionLog);
  s.consecutiveTimeouts = { ...snap.consecutiveTimeouts };
  s.lastAutoSubmittedBy = null;
}

function hasPartialRound(s: InternalState): boolean {
  return s.phase !== 'firstSubmit';
}

export function performSilperBnwUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (s.phase === 'rematchIntro' || s.phase === 'finished') return false;

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

export function canSilperBnwUndoState(s: InternalState): boolean {
  if (s.gameOver) return false;
  if (s.phase === 'rematchIntro' || s.phase === 'finished') return false;
  return hasPartialRound(s) ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

/* ────────── game resolution ────────── */

function buildFinishReasonText(
  resolution: SBNWSegmentResolution,
  winnerId: string | null,
  s: InternalState,
): string {
  const p1 = s.player1;
  const p2 = s.player2;
  if (resolution === 'score') {
    const winner = winnerId === p1.id ? p1 : p2;
    return `승점 ${p1.score}:${p2.score} — ${winner.nickname} 승`;
  }
  if (resolution === 'tiebreakTile') {
    const winner = winnerId === p1.id ? p1 : p2;
    const m = maxTile(winner.tiles);
    return `승점 동률 ${p1.score}:${p2.score} — 남은 최대 타일 ${m}로 ${winner.nickname} 승`;
  }
  if (resolution === 'rematchNeeded') {
    return '승점·최대 타일 모두 동률 — 재대결';
  }
  return '';
}

function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string | null,
  winnerNick: string,
  loserId: string | null,
  loserNick: string,
  winType: SBNWWinType,
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  clearRoundTimer(s);
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

  const totalRounds = s.segmentsHistory.reduce((sum, seg) => sum + seg.rounds.length, 0) + s.actionLog.length;

  // 현재 세그먼트가 segmentsHistory에 아직 push 되지 않은 경우(checkGameOver 경로) 인라인 추가
  const lastPushedRematch = s.segmentsHistory.at(-1)?.rematchIndex;
  const allSegments: SBNWSegmentSummary[] = [...s.segmentsHistory];
  if (lastPushedRematch !== s.rematchIndex) {
    const segResolution: SBNWSegmentResolution =
      winType === 'score' || winType === 'rematch'
        ? 'score'
        : winType === 'tiebreakTile'
          ? 'tiebreakTile'
          : 'continuing';
    allSegments.push({
      rematchIndex: s.rematchIndex,
      firstPlayerIdAtStart: s.actionLog[0]?.firstPlayerId ?? s.firstPlayerId,
      finalScores: { [p1.id]: p1.score, [p2.id]: p2.score },
      finalTiles: { [p1.id]: { ...p1.tiles }, [p2.id]: { ...p2.tiles } },
      resolution: segResolution,
      winnerId,
      rounds: cloneRoundHistoryFull(s.actionLog),
    });
  }

  const payload = {
    rankings,
    totalTurns: totalRounds,
    gameResultData: {
      winType: s.winType,
      winnerId: s.winner,
      finalScores: { [p1.id]: p1.score, [p2.id]: p2.score },
      finalTiles: { [p1.id]: { ...p1.tiles }, [p2.id]: { ...p2.tiles } },
      totalRounds,
      rematchCount: s.rematchIndex,
      segmentsHistory: allSegments.map(cloneSegmentSummaryFull),
      actions: cloneRoundHistoryFull(s.actionLog),
      players: { [p1.id]: { nickname: p1.nickname }, [p2.id]: { nickname: p2.nickname } },
      finishReason: s.finishReason,
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
  if (p1.score >= SBNW_MAX_SCORE) {
    const winType: SBNWWinType = s.rematchIndex > 0 ? 'rematch' : 'score';
    s.finishReason = `${p1.nickname} ${SBNW_MAX_SCORE}선승`;
    resolveGame(io, s, p1.id, p1.nickname, p2.id, p2.nickname, winType);
    return true;
  }
  if (p2.score >= SBNW_MAX_SCORE) {
    const winType: SBNWWinType = s.rematchIndex > 0 ? 'rematch' : 'score';
    s.finishReason = `${p2.nickname} ${SBNW_MAX_SCORE}선승`;
    resolveGame(io, s, p2.id, p2.nickname, p1.id, p1.nickname, winType);
    return true;
  }
  return false;
}

function pushSegmentSummary(s: InternalState, resolution: SBNWSegmentResolution, winnerId: string | null) {
  const p1 = s.player1;
  const p2 = s.player2;
  // 세그먼트 시작 시점의 선플은 첫 라운드 기록에서 추출, 없으면 현재값
  const startFirst = s.actionLog[0]?.firstPlayerId ?? s.firstPlayerId;
  s.segmentsHistory.push({
    rematchIndex: s.rematchIndex,
    firstPlayerIdAtStart: startFirst,
    finalScores: { [p1.id]: p1.score, [p2.id]: p2.score },
    finalTiles: { [p1.id]: { ...p1.tiles }, [p2.id]: { ...p2.tiles } },
    resolution,
    winnerId,
    rounds: cloneRoundHistoryFull(s.actionLog),
  });
}

function endSegment(io: IO, s: InternalState) {
  const p1 = s.player1;
  const p2 = s.player2;
  const res = resolveTiebreaker(p1.score, p1.tiles, p2.score, p2.tiles);

  if (res.kind === 'score' || res.kind === 'tiebreakTile') {
    const winner = res.winner === 'p1' ? p1 : p2;
    const loser = res.winner === 'p1' ? p2 : p1;
    pushSegmentSummary(s, res.kind, winner.id);
    s.finishReason = buildFinishReasonText(res.kind, winner.id, s);
    const winType: SBNWWinType = s.rematchIndex > 0 ? 'rematch' : res.kind;
    resolveGame(io, s, winner.id, winner.nickname, loser.id, loser.nickname, winType);
    return;
  }

  // rematchNeeded
  pushSegmentSummary(s, 'rematchNeeded', null);

  if (s.rematchIndex + 1 > SBNW_MAX_REMATCH) {
    s.finishReason = `최대 재대결 횟수(${SBNW_MAX_REMATCH}) 초과 — 무승부`;
    resolveGame(io, s, null, '', null, '', 'draw');
    return;
  }

  beginRematch(io, s);
}

function beginRematch(io: IO, s: InternalState) {
  clearRoundTimer(s);

  s.rematchIndex += 1;
  s.round = 0;
  s.phase = 'rematchIntro';

  for (const p of [s.player1, s.player2]) {
    p.score = 0;
    p.tiles = { ...SBNW_INITIAL_TILES };
    p.tileCount = SBNW_TOTAL_TILE_COUNT;
    p.submitted = false;
  }

  // 선후 교대 — 직전 세그먼트의 마지막 선플과 반대로
  s.firstPlayerId = s.firstPlayerId === s.player1.id ? s.player2.id : s.player1.id;

  // revealData를 rematchIntro 동안에도 보여주려면 firstTiles/secondTiles를 잠시 유지해야 하지만
  // 새 세그먼트로 진입하면서 모든 라운드 상태는 리셋
  s.firstTiles = null;
  s.firstDigits = null;
  s.secondTiles = null;
  s.actionLog = [];
  s.undoSnapshots = [];
  s.consecutiveTimeouts = { [s.player1.id]: 0, [s.player2.id]: 0 };
  s.lastAutoSubmittedBy = null;
  s.finishReason = null;

  broadcastState(io, s);

  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    s.phase = 'firstSubmit';
    s.round = 1;
    pushUndoSnapshot(s);
    startFirstSubmitTimer(io, s);
    broadcastState(io, s);
    if (s.playMode === 'com') s.onAITurn?.(io, s);
  }, REMATCH_INTRO_MS);
}

function processReveal(io: IO, s: InternalState) {
  clearRoundTimer(s);

  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  const fTiles = s.firstTiles!;
  const sTiles = s.secondTiles!;

  const { winnerId } = judgeRound(fTiles, sTiles);

  const fScoreBefore = fp.score;
  const sScoreBefore = sp.score;
  const fTileCountBefore = fp.tileCount + fTiles.length; // 이미 consume 완료
  const sTileCountBefore = sp.tileCount + sTiles.length;

  if (winnerId === 'first') fp.score += 1;
  if (winnerId === 'second') sp.score += 1;

  const log: SBNWRoundRecord = {
    round: s.round,
    rematchIndex: s.rematchIndex,
    firstPlayerId: s.firstPlayerId,
    players: {
      [fp.id]: {
        nickname: fp.nickname,
        tilesUsed: [...fTiles],
        digits: fTiles.length,
        valueStr: tilesToValueStr(fTiles),
        scoreBefore: fScoreBefore,
        scoreAfter: fp.score,
        scoreChange: fp.score - fScoreBefore,
        tileCountBefore: fTileCountBefore,
        tileCountAfter: fp.tileCount,
      },
      [sp.id]: {
        nickname: sp.nickname,
        tilesUsed: [...sTiles],
        digits: sTiles.length,
        valueStr: tilesToValueStr(sTiles),
        scoreBefore: sScoreBefore,
        scoreAfter: sp.score,
        scoreChange: sp.score - sScoreBefore,
        tileCountBefore: sTileCountBefore,
        tileCountAfter: sp.tileCount,
      },
    },
    winnerId: winnerId === 'first' ? fp.id : winnerId === 'second' ? sp.id : null,
  };
  s.actionLog.push(log);

  s.phase = 'reveal';
  broadcastState(io, s);

  // 6선승 조기 종료
  if (checkGameOver(io, s)) return;

  // 11R 종료 → 세그먼트 마감
  if (s.round >= SBNW_TOTAL_ROUNDS) {
    const gen = s.aiGeneration;
    setTimeout(() => {
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
      endSegment(io, s);
    }, REVEAL_DELAY_MS);
    return;
  }

  // 일반: 다음 라운드
  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, REVEAL_DELAY_MS);
}

function applyFirstSubmit(io: IO, s: InternalState, tiles: SBNWTile[]) {
  const fp = getFirstPlayer(s);
  consumeTiles(fp.tiles, tiles);
  fp.tileCount -= tiles.length;
  fp.submitted = true;

  s.firstTiles = [...tiles];
  s.firstDigits = tiles.length;
  s.phase = 'secondSubmit';

  broadcastState(io, s);
  startSecondSubmitTimer(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

function applySecondSubmit(io: IO, s: InternalState, tiles: SBNWTile[]) {
  const sp = getSecondPlayer(s);
  consumeTiles(sp.tiles, tiles);
  sp.tileCount -= tiles.length;
  sp.submitted = true;

  s.secondTiles = [...tiles];
  processReveal(io, s);
}

export type SubmitResult = { ok: true } | { ok: false; reason: SubmitErrorReason | 'phaseMismatch' | 'notYourTurn' };

export function processFirstSubmit(io: IO, s: InternalState, playerId: string, tiles: SBNWTile[]): SubmitResult {
  if (s.phase !== 'firstSubmit') return { ok: false, reason: 'phaseMismatch' };
  if (playerId !== s.firstPlayerId) return { ok: false, reason: 'notYourTurn' };
  const fp = getFirstPlayer(s);
  const v = validateTiles(tiles, fp.tiles);
  if (!v.ok) return { ok: false, reason: v.reason };

  clearRoundTimer(s);
  s.consecutiveTimeouts[fp.id] = 0;
  s.lastAutoSubmittedBy = null;
  applyFirstSubmit(io, s, tiles);
  return { ok: true };
}

export function processSecondSubmit(io: IO, s: InternalState, playerId: string, tiles: SBNWTile[]): SubmitResult {
  if (s.phase !== 'secondSubmit') return { ok: false, reason: 'phaseMismatch' };
  if (playerId === s.firstPlayerId) return { ok: false, reason: 'notYourTurn' };
  const sp = getSecondPlayer(s);
  const v = validateTiles(tiles, sp.tiles);
  if (!v.ok) return { ok: false, reason: v.reason };

  clearRoundTimer(s);
  s.consecutiveTimeouts[sp.id] = 0;
  s.lastAutoSubmittedBy = null;
  applySecondSubmit(io, s, tiles);
  return { ok: true };
}

/** AI 자동 제시 우회 진입점 (검증된 타일을 직접 적용) */
export function processFirstSubmitDirect(io: IO, s: InternalState, tiles: SBNWTile[]) {
  const fp = getFirstPlayer(s);
  clearRoundTimer(s);
  s.consecutiveTimeouts[fp.id] = 0;
  s.lastAutoSubmittedBy = null;
  applyFirstSubmit(io, s, tiles);
}

export function processSecondSubmitDirect(io: IO, s: InternalState, tiles: SBNWTile[]) {
  const sp = getSecondPlayer(s);
  clearRoundTimer(s);
  s.consecutiveTimeouts[sp.id] = 0;
  s.lastAutoSubmittedBy = null;
  applySecondSubmit(io, s, tiles);
}

export function advanceRound(io: IO, s: InternalState) {
  s.round += 1;

  // 선권: 이전 라운드 승자. 동점이면 현재 선플 유지.
  const last = s.actionLog[s.actionLog.length - 1];
  if (last?.winnerId != null) {
    s.firstPlayerId = last.winnerId;
  }

  s.firstTiles = null;
  s.firstDigits = null;
  s.secondTiles = null;
  s.phase = 'firstSubmit';

  s.player1.submitted = false;
  s.player2.submitted = false;

  // 자동 패배 체크 (선·후플 모두)
  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  const fpCan = canAnyLegalSubmit(fp.tiles);
  const spCan = canAnyLegalSubmit(sp.tiles);

  if (!fpCan && !spCan) {
    // 양측 모두 타일 소진 → 세그먼트 마감(점수/타일 타이브레이크)으로 판정
    endSegment(io, s);
    return;
  }
  if (!fpCan) {
    s.finishReason = `${fp.nickname} 타일 소진 — 자동 패배`;
    resolveGame(io, s, sp.id, sp.nickname, fp.id, fp.nickname, 'autoLoss');
    return;
  }
  if (!spCan) {
    s.finishReason = `${sp.nickname} 타일 소진 — 자동 패배`;
    resolveGame(io, s, fp.id, fp.nickname, sp.id, sp.nickname, 'autoLoss');
    return;
  }

  pushUndoSnapshot(s);
  startFirstSubmitTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

/* ────────── timeout fallback (방 전체 타임아웃 등 외부 호출) ────────── */

export function handleSilperBnwTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);
  if (s.phase === 'firstSubmit') {
    handleFirstTimeout(io, s);
  } else if (s.phase === 'secondSubmit') {
    handleSecondTimeout(io, s);
  }
}

/* ────────── leave ────────── */

export function handleSilperBnwLeave(io: IO, s: InternalState, leftPlayerId: string) {
  if (s.gameOver) return;
  const winner = getOpponent(s, leftPlayerId);
  const loser = getPlayer(s, leftPlayerId);
  if (!winner || !loser) return;
  s.finishReason = `${loser.nickname} 기권`;
  resolveGame(io, s, winner.id, winner.nickname, loser.id, loser.nickname, 'leave');
}
