/**
 * 조각조각 — 서버 모듈. 룰은 shared/types/jogak.ts.
 * 출제 단어는 트랜스레터·모음이 없어요와 같은 topic-words, 한글 분해는 shared/lib/hangul.
 */
import type { GameState } from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  JG_REVEAL_MS,
  JG_ROUND_SEC,
  JG_TOTAL_ROUNDS,
  JG_WIN_SCORE,
  JG_WRONG_LOCK_MS,
  fitsPieces,
  makePieces,
  type JogakAction,
  type JogakGameData,
  type JogakPhase,
  type JogakResult,
  type JogakRoundRecord,
} from '@shared/types/jogak.js';
import { topicWordEntries } from '@shared/data/topic-words.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { pickDistinct } from '../word-race/engine.js';
import type { IO, TypedSocket } from '../../types.js';

type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

const ENTRIES = topicWordEntries();

/** 주제 → 그 주제 단어들. 정답 목록을 만들 때 쓴다. */
const BY_CATEGORY = new Map<string, string[]>();
for (const e of ENTRIES) {
  const list = BY_CATEGORY.get(e.category) ?? [];
  list.push(e.word);
  BY_CATEGORY.set(e.category, list);
}

console.log(`[jogak] 출제 단어 ${ENTRIES.length}개 로드`);

export interface JogakPuzzle {
  category: string;
  pieces: string[];
  /** 대표 정답 (라운드가 끝나면 공개) */
  answer: string;
  /** 정답으로 받는 단어들 — 같은 주제에서 조각이 들어맞는 단어. answer 를 포함한다. */
  accepts: ReadonlySet<string>;
}

function makePuzzle(e: { category: string; word: string }): JogakPuzzle {
  const pieces = makePieces(e.word);
  const accepts = new Set((BY_CATEGORY.get(e.category) ?? []).filter((w) => fitsPieces(w, pieces)));
  accepts.add(e.word);
  return { category: e.category, pieces, answer: e.word, accepts };
}

interface JogakState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  phase: JogakPhase;
  puzzles: JogakPuzzle[];
  round: number; // 1부터
  roundStartedAt: number;
  scores: Record<string, number>;
  /** 오답 뒤 다시 낼 수 있는 시각 */
  lockedUntil: Record<string, number>;
  history: JogakRoundRecord[];
  result: JogakResult | null;
  gameOver: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EndGameFn;
}

const gameStates = new Map<string, JogakState>();

function isSolo(s: JogakState) {
  return s.playMode === 'solo';
}

function buildGameData(s: JogakState, viewerId: string | null): JogakGameData {
  const [a, b] = s.players;
  const pz = s.puzzles[s.round - 1]!;
  const players: JogakGameData['players'] = {
    [a.id]: { nickname: nicknameForViewer(s.roomId, a.id, a.nickname, viewerId) },
  };
  if (!isSolo(s))
    players[b.id] = { nickname: nicknameForViewer(s.roomId, b.id, b.nickname, viewerId) };
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: JG_TOTAL_ROUNDS,
    winScore: JG_WIN_SCORE,
    roundSeconds: JG_ROUND_SEC,
    roundStartedAt: s.roundStartedAt,
    category: pz.category,
    pieces: pz.pieces,
    scores: { ...s.scores },
    history: s.history,
    players,
    result: s.result,
    isSolo: isSolo(s),
  };
}

function buildGameState(s: JogakState, gameData: JogakGameData): GameState {
  return {
    roomId: s.roomId,
    message: s.phase === 'finished' ? '게임 종료' : `${s.round}라운드 — 주제: ${gameData.category}`,
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.roundStartedAt,
    turnStartedAt: s.phase === 'playing' ? s.roundStartedAt : null,
    gameData: gameData as unknown as Record<string, unknown>,
  };
}

function viewerOf(s: JogakState, socketId: string): string | null {
  const pid = sessions.getToken(socketId) ?? socketId;
  return s.players.some((p) => p.id === pid) ? pid : null;
}

async function broadcastState(io: IO, s: JogakState) {
  const sockets = await io.in(socketRoom(s.roomId)).fetchSockets();
  for (const sock of sockets) {
    sock.emit('game:state', buildGameState(s, buildGameData(s, viewerOf(s, sock.id))));
  }
}

function clearTimer(s: JogakState) {
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
}

function startRound(io: IO, s: JogakState, round: number) {
  clearTimer(s);
  s.round = round;
  s.phase = 'playing';
  s.roundStartedAt = Date.now();
  s.lockedUntil = {};
  s.timer = setTimeout(() => {
    if (gameStates.get(s.roomId) !== s || s.phase !== 'playing') return;
    endRound(io, s, null); // 시간 종료 — 아무도 점수 없음
  }, JG_ROUND_SEC * 1000);
  void broadcastState(io, s);
}

/** 남은 라운드를 모두 이겨도 1등을 따라잡을 수 없는가 */
function decided(s: JogakState): boolean {
  if (isSolo(s)) return false;
  const [a, b] = s.players;
  const sa = s.scores[a.id] ?? 0;
  const sb = s.scores[b.id] ?? 0;
  if (Math.max(sa, sb) >= JG_WIN_SCORE) return true;
  return Math.abs(sa - sb) > JG_TOTAL_ROUNDS - s.round;
}

function endRound(io: IO, s: JogakState, winnerId: string | null) {
  clearTimer(s);
  const pz = s.puzzles[s.round - 1]!;
  if (winnerId) s.scores[winnerId] = (s.scores[winnerId] ?? 0) + 1;
  s.history = [
    ...s.history,
    { round: s.round, category: pz.category, pieces: pz.pieces, answer: pz.answer, winnerId },
  ];

  if (s.round >= JG_TOTAL_ROUNDS || decided(s)) {
    finishGame(io, s);
    return;
  }
  s.phase = 'reveal';
  void broadcastState(io, s);
  s.timer = setTimeout(() => {
    if (gameStates.get(s.roomId) !== s || s.phase !== 'reveal') return;
    startRound(io, s, s.round + 1);
  }, JG_REVEAL_MS);
}

function decideResult(s: JogakState): JogakResult {
  const [a, b] = s.players;
  const sa = s.scores[a.id] ?? 0;
  if (isSolo(s)) {
    return {
      winnerId: sa > 0 ? a.id : null,
      reason: `${JG_TOTAL_ROUNDS}문제 중 ${sa}문제 정답`,
    };
  }
  const sb = s.scores[b.id] ?? 0;
  if (sa === sb) return { winnerId: null, reason: `${sa} : ${sb} 동점 — 무승부` };
  const winnerId = sa > sb ? a.id : b.id;
  const hi = Math.max(sa, sb);
  const lo = Math.min(sa, sb);
  return {
    winnerId,
    reason: hi >= JG_WIN_SCORE ? `${hi}점 선취 (${hi} : ${lo})` : `${hi} : ${lo}`,
  };
}

function finishGame(io: IO, s: JogakState) {
  clearTimer(s);
  s.phase = 'finished';
  s.gameOver = true;
  s.result = decideResult(s);
  void broadcastState(io, s);

  const [a, b] = s.players;
  const r = s.result;
  const score = (id: string) => s.scores[id] ?? 0;
  const rankings = isSolo(s)
    ? [{ playerId: a.id, nickname: a.nickname, rank: 1, score: score(a.id) }]
    : r.winnerId
      ? [
          {
            playerId: r.winnerId,
            nickname: (r.winnerId === a.id ? a : b).nickname,
            rank: 1,
            score: score(r.winnerId),
          },
          {
            playerId: r.winnerId === a.id ? b.id : a.id,
            nickname: (r.winnerId === a.id ? b : a).nickname,
            rank: 2,
            score: score(r.winnerId === a.id ? b.id : a.id),
          },
        ]
      : [
          { playerId: a.id, nickname: a.nickname, rank: 1, score: score(a.id) },
          { playerId: b.id, nickname: b.nickname, rank: 1, score: score(b.id) },
        ];

  const players = isSolo(s)
    ? { [a.id]: { nickname: a.nickname } }
    : { [a.id]: { nickname: a.nickname }, [b.id]: { nickname: b.nickname } };
  const payload = {
    rankings,
    totalTurns: s.round,
    gameResultData: { result: r, scores: { ...s.scores }, history: s.history, players },
  };

  setTimeout(() => {
    if (gameStates.get(s.roomId) !== s) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, 3500);
}

export function initJogak(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  _startedAt: number,
  _timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearTimer(prev);
  gameStates.delete(roomId);

  // 1인 솔로 — 유일한 플레이어를 두 슬롯 모두에 채운다(룸에 저장되는 players 는 그대로 1명).
  const p0 = players[0];
  const p1 = playMode === 'solo' ? p0 : players[1];

  const s: JogakState = {
    roomId,
    playMode,
    players: [p0, p1] as [Player, Player],
    phase: 'playing',
    puzzles: pickDistinct(ENTRIES, JG_TOTAL_ROUNDS, (e) => e.word).map(makePuzzle),
    round: 1,
    roundStartedAt: Date.now(),
    scores: { [p0.id]: 0, [p1.id]: 0 },
    lockedUntil: {},
    history: [],
    result: null,
    gameOver: false,
    timer: null,
    endGameCallback,
  };
  gameStates.set(roomId, s);
  startRound(io, s, 1);
}

export function handleJogakAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.phase !== 'playing') return;

  const pid = viewerOf(s, socket.id);
  if (!pid) return; // 관전자

  const action = data as JogakAction;
  if (action.type !== 'submit') return;
  if (Number(action.round) !== s.round) return; // 지난 라운드에 늦게 도착한 답

  const now = Date.now();
  if (now < (s.lockedUntil[pid] ?? 0)) return;

  const word = String(action.word ?? '').replace(/\s/g, '');
  if (!/^[가-힣]+$/.test(word)) {
    socket.emit('error', { message: '한글 단어를 입력해 주세요.' });
    return;
  }
  if (!s.puzzles[s.round - 1]!.accepts.has(word)) {
    s.lockedUntil[pid] = now + JG_WRONG_LOCK_MS;
    socket.emit('error', { message: '땡! 다시 생각해 보세요.' });
    return;
  }
  endRound(io, s, pid);
}

export function cleanupJogak(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTimer(s);
  gameStates.delete(roomId);
}

export function getJogakState(roomId: string) {
  const s = gameStates.get(roomId);
  return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
}

export function emitJogakStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  socket.emit('game:state', buildGameState(s, buildGameData(s, viewerOf(s, socket.id))));
}

export const performJogakUndo = (): boolean => false;
export const canJogakUndo = (): boolean => false;

export function getJogakResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  return s?.result ? { result: s.result, scores: { ...s.scores }, history: s.history } : undefined;
}

/** 테스트용 — 진행 중인 판의 문제(정답 포함) */
export function jogakPuzzlesOf(roomId: string): readonly JogakPuzzle[] | undefined {
  return gameStates.get(roomId)?.puzzles;
}
