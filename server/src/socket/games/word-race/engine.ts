/**
 * 단어 맞히기 2인 스피드 레이스 엔진 — 트랜스레터·모음이 없어요가 함께 쓴다.
 * 판 규칙은 shared/types/word-race.ts. 게임은 문제를 만드는 함수만 넘긴다.
 */
import type { GameState } from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  WR_PUZZLE_COUNT,
  WR_TIME_LIMIT_SEC,
  type WordRaceAction,
  type WordRaceGameData,
  type WordRaceResult,
} from '@shared/types/word-race.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
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

export interface WordRacePuzzle {
  category: string;
  /** 문제로 보여 줄 글자 */
  shown: string;
  /** 대표 정답 (결과에 공개) */
  answer: string;
  /** 정답으로 받는 단어들. answer 를 포함한다. */
  accepts: ReadonlySet<string>;
}

export interface WordRaceConfig {
  /** WR_PUZZLE_COUNT 개의 서로 다른 문제 */
  makePuzzles: () => WordRacePuzzle[];
}

interface PlayerProgress {
  solved: boolean[]; // 문제별 정답 여부
  solveTimes: number[]; // 문제별 정답 시각 (ms)
  count: number;
  lastSolveAt: number; // 마지막 정답 시각 (동점 시 빠른 쪽 비교용). 0 = 없음
}

interface RaceState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  phase: 'playing' | 'finished';
  puzzles: WordRacePuzzle[]; // 두 플레이어 공통 3문제
  progress: Record<string, PlayerProgress>;
  startedAt: number;
  result: WordRaceResult | null;
  gameOver: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EndGameFn;
}

/** 단어 목록에서 서로 다른 n 개를 고른다 */
export function pickDistinct<T>(items: readonly T[], n: number, key: (item: T) => string): T[] {
  const used = new Set<string>();
  const out: T[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 500) {
    const item = items[Math.floor(Math.random() * items.length)]!;
    const k = key(item);
    if (used.has(k)) continue;
    used.add(k);
    out.push(item);
  }
  return out;
}

export function createWordRace(config: WordRaceConfig) {
  const gameStates = new Map<string, RaceState>();

  function maskNick(s: RaceState, viewerId: string | null, p: Player): string {
    return nicknameForViewer(s.roomId, p.id, p.nickname, viewerId);
  }

  function buildGameData(s: RaceState, viewerId: string | null): WordRaceGameData {
    const [a, b] = s.players;
    const mine = viewerId ? s.progress[viewerId] : undefined;
    const oppId = viewerId === a.id ? b.id : viewerId === b.id ? a.id : null;
    const opp = oppId ? s.progress[oppId] : undefined;
    return {
      phase: s.phase,
      startedAt: s.startedAt,
      timeLimitSec: WR_TIME_LIMIT_SEC,
      puzzles: s.puzzles.map((p) => ({ category: p.category, shown: p.shown })),
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

  function buildGameState(s: RaceState, gameData: WordRaceGameData): GameState {
    return {
      roomId: s.roomId,
      message:
        s.phase === 'playing'
          ? `제한시간 10분 — 3문제를 먼저 다 맞히세요! (${gameData.myCount}/${WR_PUZZLE_COUNT})`
          : '게임 종료',
      currentTurn: null,
      turnNumber: gameData.myCount,
      startedAt: s.startedAt,
      turnStartedAt: null,
      gameData: gameData as unknown as Record<string, unknown>,
    };
  }

  async function broadcastState(io: IO, s: RaceState) {
    const sockets = await io.in(socketRoom(s.roomId)).fetchSockets();
    for (const sock of sockets) {
      const pid = sessions.getToken(sock.id) ?? sock.id;
      const isPlayer = s.players.some((p) => p.id === pid);
      sock.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
    }
  }

  function clearTimer(s: RaceState) {
    if (s.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  }

  /** 승자 결정 — 즉시승(3개 완성)이면 winnerId 전달, 시간종료면 null 전달해 비교 */
  function decideWinner(s: RaceState, instantWinnerId: string | null): WordRaceResult {
    const [a, b] = s.players;
    const pa = s.progress[a.id]!;
    const pb = s.progress[b.id]!;
    const counts = { [a.id]: pa.count, [b.id]: pb.count };
    const answers = s.puzzles.map((p) => p.answer);

    if (instantWinnerId) {
      return { winnerId: instantWinnerId, reason: '3문제 모두 완성!', counts, answers };
    }
    // 시간 종료
    if (pa.count !== pb.count) {
      const winner = pa.count > pb.count ? a.id : b.id;
      return { winnerId: winner, reason: `더 많이 맞힘 (${Math.max(pa.count, pb.count)}문제)`, counts, answers };
    }
    if (pa.count === 0) {
      return { winnerId: null, reason: '둘 다 못 맞힘 — 무승부', counts, answers };
    }
    // 개수 동점 → 마지막 정답을 더 빨리 낸 쪽 (lastSolveAt 작은 쪽)
    const winner = pa.lastSolveAt <= pb.lastSolveAt ? a.id : b.id;
    return { winnerId: winner, reason: `${pa.count}문제 동점 — 더 빨리 완료`, counts, answers };
  }

  function finishGame(io: IO, s: RaceState, instantWinnerId: string | null) {
    clearTimer(s);
    s.phase = 'finished';
    s.gameOver = true;

    const [a, b] = s.players;

    // 솔로 — 상대가 없으므로 개인 진행 결과만 단일 랭킹으로 보고한다(a===b 중복 방지).
    if (s.playMode === 'solo') {
      const p = s.progress[a.id]!;
      const solvedAll = p.count >= WR_PUZZLE_COUNT;
      s.result = {
        winnerId: p.count > 0 ? a.id : null,
        reason: solvedAll
          ? `${WR_PUZZLE_COUNT}문제 모두 완성!`
          : `제한시간 종료 — ${p.count}/${WR_PUZZLE_COUNT}문제 해결`,
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

  function init(
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
      solved: Array(WR_PUZZLE_COUNT).fill(false),
      solveTimes: Array(WR_PUZZLE_COUNT).fill(0),
      count: 0,
      lastSolveAt: 0,
    });

    // 1인 솔로 — 상대가 없으므로 유일한 플레이어를 두 슬롯 모두에 채운다(내부 자료구조 재사용).
    // 룸에 실제로 저장되는 players 는 여전히 1명뿐이라 랭크 집계에는 영향 없음.
    const p0 = players[0];
    const p1 = playMode === 'solo' ? p0 : players[1];

    const s: RaceState = {
      roomId,
      playMode,
      players: [p0, p1] as [Player, Player],
      phase: 'playing',
      puzzles: config.makePuzzles(),
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
    }, WR_TIME_LIMIT_SEC * 1000);

    void broadcastState(io, s);
  }

  function handleAction(io: IO, socket: TypedSocket, roomId: string, data: Record<string, unknown>) {
    const s = gameStates.get(roomId);
    if (!s || s.gameOver || s.phase !== 'playing') return;

    const pid = sessions.getToken(socket.id) ?? socket.id;
    const prog = s.progress[pid];
    if (!prog) return; // 관전자 등

    const action = data as WordRaceAction;
    if (action.type !== 'submit') return;

    const index = Number(action.index);
    if (!Number.isInteger(index) || index < 0 || index >= WR_PUZZLE_COUNT) return;
    if (prog.solved[index]) return; // 이미 푼 문제

    const word = String(action.word ?? '').replace(/\s/g, '').trim();
    if (!/^[가-힣]+$/.test(word)) {
      socket.emit('error', { message: '한글 단어를 입력해 주세요.' });
      return;
    }
    if (!s.puzzles[index].accepts.has(word)) {
      socket.emit('error', { message: '땡! 다시 생각해 보세요.' });
      return;
    }

    // 정답
    const now = Date.now();
    prog.solved[index] = true;
    prog.solveTimes[index] = now;
    prog.count += 1;
    prog.lastSolveAt = now;

    if (prog.count >= WR_PUZZLE_COUNT) {
      finishGame(io, s, pid); // 즉시 승리
      return;
    }
    void broadcastState(io, s);
  }

  function cleanup(roomId: string) {
    const s = gameStates.get(roomId);
    if (s) clearTimer(s);
    gameStates.delete(roomId);
  }

  function getState(roomId: string) {
    const s = gameStates.get(roomId);
    return s ? { gameOver: s.gameOver, totalTurns: 0 } : undefined;
  }

  function emitStateToSocket(socket: TypedSocket, roomId: string) {
    const s = gameStates.get(roomId);
    if (!s) return;
    const pid = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = s.players.some((p) => p.id === pid);
    socket.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
  }

  function getResultData(roomId: string): unknown {
    const s = gameStates.get(roomId);
    return s?.result ? { result: s.result } : undefined;
  }

  return {
    init,
    handleAction,
    cleanup,
    getState,
    emitStateToSocket,
    performUndo: (_io: IO, _roomId: string): boolean => false,
    canUndo: (_roomId: string): boolean => false,
    getResultData,
    /** 테스트용 — 진행 중인 판의 문제(정답 포함) */
    puzzlesOf: (roomId: string): readonly WordRacePuzzle[] | undefined => gameStates.get(roomId)?.puzzles,
  };
}
