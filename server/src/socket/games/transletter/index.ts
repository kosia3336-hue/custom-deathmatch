/** 트랜스레터 — 서버 모듈. 2인 스피드 레이스: 동일 3문제, 10분, 먼저 3개 다 풀면 승리. */
import type { GameState } from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  TL_PUZZLE_COUNT,
  TL_TIME_LIMIT_SEC,
  transformWord,
  type TransletterAction,
  type TransletterGameData,
  type TransletterResult,
} from '@shared/types/transletter.js';
import { transletterWordEntries } from '@shared/data/transletter-words.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
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

interface Puzzle {
  category: string;
  transformed: string;
  answer: string;
}

interface PlayerProgress {
  solved: boolean[];      // 문제별 정답 여부
  solveTimes: number[];   // 문제별 정답 시각 (ms)
  count: number;
  lastSolveAt: number;    // 마지막 정답 시각 (동점 시 빠른 쪽 비교용). 0 = 없음
}

interface TLState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  phase: 'playing' | 'finished';
  puzzles: Puzzle[];      // 두 플레이어 공통 3문제
  progress: Record<string, PlayerProgress>;
  startedAt: number;
  result: TransletterResult | null;
  gameOver: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EndGameFn;
}

const gameStates = new Map<string, TLState>();
const ENTRIES = transletterWordEntries();

console.log(`[transletter] 출제 단어 ${ENTRIES.length}개 로드`);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 서로 다른 3문제 생성 (변형이 원본과 같으면 재시도) */
function makePuzzles(): Puzzle[] {
  const used = new Set<string>();
  const out: Puzzle[] = [];
  let guard = 0;
  while (out.length < TL_PUZZLE_COUNT && guard++ < 200) {
    const e = pick(ENTRIES);
    if (used.has(e.word)) continue;
    used.add(e.word);
    let transformed = transformWord(e.word);
    let t = 0;
    while (transformed === e.word && t++ < 10) transformed = transformWord(e.word);
    out.push({ category: e.category, answer: e.word, transformed });
  }
  return out;
}

function maskNick(s: TLState, viewerId: string | null, p: Player): string {
  return isTokenAnonymized(s.roomId, p.id) && p.id !== viewerId ? ANONYMOUS_NICKNAME : p.nickname;
}

function buildGameData(s: TLState, viewerId: string | null): TransletterGameData {
  const [a, b] = s.players;
  const mine = viewerId ? s.progress[viewerId] : undefined;
  const oppId = viewerId === a.id ? b.id : viewerId === b.id ? a.id : null;
  const opp = oppId ? s.progress[oppId] : undefined;
  return {
    phase: s.phase,
    startedAt: s.startedAt,
    timeLimitSec: TL_TIME_LIMIT_SEC,
    puzzles: s.puzzles.map((p) => ({ category: p.category, transformed: p.transformed })),
    mySolved: mine ? [...mine.solved] : s.puzzles.map(() => false),
    myCount: mine?.count ?? 0,
    oppCount: opp?.count ?? 0,
    players: {
      [a.id]: { nickname: maskNick(s, viewerId, a) },
      [b.id]: { nickname: maskNick(s, viewerId, b) },
    },
    result: s.result,
    isSolo: s.playMode === 'solo',
  };
}

function buildGameState(s: TLState, gameData: TransletterGameData): GameState {
  return {
    roomId: s.roomId,
    message:
      s.phase === 'playing'
        ? `제한시간 10분 — 3문제를 먼저 다 맞히세요! (${gameData.myCount}/${TL_PUZZLE_COUNT})`
        : '게임 종료',
    currentTurn: null,
    turnNumber: gameData.myCount,
    startedAt: s.startedAt,
    turnStartedAt: null,
    gameData: gameData as unknown as Record<string, unknown>,
  };
}

async function broadcastState(io: IO, s: TLState) {
  const sockets = await io.in(socketRoom(s.roomId)).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const isPlayer = s.players.some((p) => p.id === pid);
    sock.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
  }
}

function clearTimer(s: TLState) {
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
}

/** 승자 결정 — 즉시승(3개 완성)이면 winnerId 전달, 시간종료면 null 전달해 비교 */
function decideWinner(s: TLState, instantWinnerId: string | null): TransletterResult {
  const [a, b] = s.players;
  const pa = s.progress[a.id]!;
  const pb = s.progress[b.id]!;
  const counts = { [a.id]: pa.count, [b.id]: pb.count };

  if (instantWinnerId) {
    return { winnerId: instantWinnerId, reason: '3문제 모두 완성!', counts, answers: s.puzzles.map((p) => p.answer) };
  }
  // 시간 종료
  if (pa.count !== pb.count) {
    const winner = pa.count > pb.count ? a.id : b.id;
    return { winnerId: winner, reason: `더 많이 맞힘 (${Math.max(pa.count, pb.count)}문제)`, counts, answers: s.puzzles.map((p) => p.answer) };
  }
  if (pa.count === 0) {
    return { winnerId: null, reason: '둘 다 못 맞힘 — 무승부', counts, answers: s.puzzles.map((p) => p.answer) };
  }
  // 개수 동점 → 마지막 정답을 더 빨리 낸 쪽 (lastSolveAt 작은 쪽)
  const winner = pa.lastSolveAt <= pb.lastSolveAt ? a.id : b.id;
  return { winnerId: winner, reason: `${pa.count}문제 동점 — 더 빨리 완료`, counts, answers: s.puzzles.map((p) => p.answer) };
}

function finishGame(io: IO, s: TLState, instantWinnerId: string | null) {
  clearTimer(s);
  s.phase = 'finished';
  s.gameOver = true;

  const [a, b] = s.players;

  // 솔로 — 상대가 없으므로 개인 진행 결과만 단일 랭킹으로 보고한다(a===b 중복 방지).
  if (s.playMode === 'solo') {
    const p = s.progress[a.id]!;
    const solvedAll = p.count >= TL_PUZZLE_COUNT;
    s.result = {
      winnerId: p.count > 0 ? a.id : null,
      reason: solvedAll
        ? `${TL_PUZZLE_COUNT}문제 모두 완성!`
        : `제한시간 종료 — ${p.count}/${TL_PUZZLE_COUNT}문제 해결`,
      counts: { [a.id]: p.count },
      answers: s.puzzles.map((pz) => pz.answer),
    };
    void broadcastState(io, s);

    const payload = {
      rankings: [{ playerId: a.id, nickname: a.nickname, rank: 1, score: p.count }],
      totalTurns: p.count,
      gameResultData: {
        result: s.result,
        players: { [a.id]: { nickname: a.nickname } },
      },
    };
    setTimeout(() => {
      if (!gameStates.has(s.roomId)) return;
      gameStates.delete(s.roomId);
      s.endGameCallback(io, s.roomId, payload);
    }, 3500);
    return;
  }

  s.result = decideWinner(s, instantWinnerId);
  void broadcastState(io, s);

  const r = s.result;
  const rankings = r.winnerId
    ? [
        { playerId: r.winnerId, nickname: (r.winnerId === a.id ? a : b).nickname, rank: 1, score: r.counts[r.winnerId] ?? 0 },
        {
          playerId: r.winnerId === a.id ? b.id : a.id,
          nickname: (r.winnerId === a.id ? b : a).nickname,
          rank: 2,
          score: r.counts[r.winnerId === a.id ? b.id : a.id] ?? 0,
        },
      ]
    : [
        { playerId: a.id, nickname: a.nickname, rank: 1, score: r.counts[a.id] ?? 0 },
        { playerId: b.id, nickname: b.nickname, rank: 1, score: r.counts[b.id] ?? 0 },
      ];

  const payload = {
    rankings,
    totalTurns: (s.progress[a.id]?.count ?? 0) + (s.progress[b.id]?.count ?? 0),
    gameResultData: {
      result: r,
      players: { [a.id]: { nickname: a.nickname }, [b.id]: { nickname: b.nickname } },
    },
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, 3500);
}

export function initTransletter(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  _timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearTimer(prev);
  gameStates.delete(roomId);

  const mkProgress = (): PlayerProgress => ({
    solved: Array(TL_PUZZLE_COUNT).fill(false),
    solveTimes: Array(TL_PUZZLE_COUNT).fill(0),
    count: 0,
    lastSolveAt: 0,
  });

  // 1인 솔로 — 상대가 없으므로 유일한 플레이어를 두 슬롯 모두에 채운다(내부 자료구조 재사용).
  // 룸에 실제로 저장되는 players 는 여전히 1명뿐이라 랭크 집계에는 영향 없음.
  const p0 = players[0];
  const p1 = playMode === 'solo' ? p0 : players[1];

  const s: TLState = {
    roomId,
    playMode,
    players: [p0, p1] as [Player, Player],
    phase: 'playing',
    puzzles: makePuzzles(),
    progress: { [p0.id]: mkProgress(), [p1.id]: mkProgress() },
    startedAt,
    result: null,
    gameOver: false,
    timer: null,
    endGameCallback,
  };
  gameStates.set(roomId, s);

  s.timer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.gameOver) return;
    finishGame(io, s, null); // 시간 종료
  }, TL_TIME_LIMIT_SEC * 1000);

  void broadcastState(io, s);
}

export function handleTransletterAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.phase !== 'playing') return;

  const pid = sessions.getToken(socket.id) ?? socket.id;
  const prog = s.progress[pid];
  if (!prog) return; // 관전자 등

  const action = data as TransletterAction;
  if (action.type !== 'submit') return;

  const index = Number(action.index);
  if (!Number.isInteger(index) || index < 0 || index >= TL_PUZZLE_COUNT) return;
  if (prog.solved[index]) return; // 이미 푼 문제

  const word = String(action.word ?? '').replace(/\s/g, '').trim();
  if (!/^[가-힣]+$/.test(word)) {
    socket.emit('error', { message: '한글 단어를 입력해 주세요.' });
    return;
  }
  if (word !== s.puzzles[index].answer) {
    socket.emit('error', { message: '땡! 다시 생각해 보세요.' });
    return;
  }

  // 정답
  const now = Date.now();
  prog.solved[index] = true;
  prog.solveTimes[index] = now;
  prog.count += 1;
  prog.lastSolveAt = now;

  if (prog.count >= TL_PUZZLE_COUNT) {
    finishGame(io, s, pid); // 즉시 승리
    return;
  }
  void broadcastState(io, s);
}

export function cleanupTransletter(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTimer(s);
  gameStates.delete(roomId);
}

export function getTransletterState(roomId: string) {
  const s = gameStates.get(roomId);
  return s ? { gameOver: s.gameOver, totalTurns: 0 } : undefined;
}

export function emitTransletterStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = s.players.some((p) => p.id === pid);
  socket.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
}

export function performTransletterUndo(_io: IO, _roomId: string): boolean {
  return false;
}
export function canTransletterUndo(_roomId: string): boolean {
  return false;
}
export function getTransletterResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  return s?.result ? { result: s.result } : undefined;
}
