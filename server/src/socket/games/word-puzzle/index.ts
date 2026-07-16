/** 단어 퍼즐 — 서버 모듈 (init / handleAction / cleanup). */
import type { GameState } from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  WP_TOTAL_ROUNDS,
  WP_ROUND_SECONDS,
  WP_REVEAL_MS,
  type WordPuzzleAction,
  type WordPuzzleGameData,
  type WordPuzzleRoundResult,
} from '@shared/types/word-puzzle.js';
import { validThreeLetterWords } from '@shared/data/three-letter-words.js';
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

interface WPState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  phase: 'playing' | 'reveal' | 'finished';
  round: number;
  answerWords: string[];
  grid: string[];
  scores: Record<string, number>;
  history: WordPuzzleRoundResult[];
  lastResult: WordPuzzleRoundResult | null;
  roundStartedAt: number;
  startedAt: number;
  gameOver: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EndGameFn;
}

const gameStates = new Map<string, WPState>();
const DICT = new Set(validThreeLetterWords());
const WORDS = validThreeLetterWords();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 라운드 출제: 서로 다른 3단어 + 글자 9개 셔플 */
function dealRound(s: WPState) {
  const picked = shuffle(WORDS).slice(0, 3);
  s.answerWords = picked;
  s.grid = shuffle(picked.join('').split(''));
  s.phase = 'playing';
  s.lastResult = null;
  s.roundStartedAt = Date.now();
}

function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const cnt = new Map<string, number>();
  for (const x of a) cnt.set(x, (cnt.get(x) ?? 0) + 1);
  for (const x of b) {
    const n = cnt.get(x);
    if (!n) return false;
    cnt.set(x, n - 1);
  }
  return true;
}

function maskNick(s: WPState, viewerId: string | null, p: Player): string {
  return isTokenAnonymized(s.roomId, p.id) && p.id !== viewerId ? ANONYMOUS_NICKNAME : p.nickname;
}

function buildGameData(s: WPState, viewerId: string | null): WordPuzzleGameData {
  const [a, b] = s.players;
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: WP_TOTAL_ROUNDS,
    grid: s.phase === 'playing' || s.phase === 'reveal' ? s.grid : [],
    scores: { ...s.scores },
    players: {
      [a.id]: { nickname: maskNick(s, viewerId, a) },
      [b.id]: { nickname: maskNick(s, viewerId, b) },
    },
    roundStartedAt: s.roundStartedAt,
    roundSeconds: WP_ROUND_SECONDS,
    lastResult: s.lastResult,
    history: [...s.history],
  };
}

function buildGameState(s: WPState, gameData: WordPuzzleGameData): GameState {
  return {
    roomId: s.roomId,
    message:
      s.phase === 'playing'
        ? `라운드 ${s.round}/${WP_TOTAL_ROUNDS} — 3글자 단어 3개를 찾아 조합하세요!`
        : s.phase === 'reveal'
          ? '라운드 결과'
          : '게임 종료',
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.roundStartedAt,
    gameData: gameData as unknown as Record<string, unknown>,
  };
}

async function broadcastState(io: IO, s: WPState) {
  const sockets = await io.in(socketRoom(s.roomId)).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const isPlayer = s.players.some((p) => p.id === pid);
    sock.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
  }
}

function clearTimer(s: WPState) {
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
}

function startRoundTimer(io: IO, s: WPState) {
  clearTimer(s);
  s.timer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.gameOver || s.phase !== 'playing') return;
    // 시간 초과 — 승자 없음
    endRound(io, s, null, null);
  }, WP_ROUND_SECONDS * 1000);
}

function endRound(io: IO, s: WPState, winnerId: string | null, submitted: string[] | null) {
  clearTimer(s);
  const result: WordPuzzleRoundResult = {
    round: s.round,
    winnerId,
    answerWords: [...s.answerWords],
    submittedWords: submitted,
    elapsedMs: winnerId ? Date.now() - s.roundStartedAt : null,
  };
  if (winnerId) s.scores[winnerId] = (s.scores[winnerId] ?? 0) + 1;
  s.history.push(result);
  s.lastResult = result;
  s.phase = 'reveal';
  void broadcastState(io, s);

  s.timer = setTimeout(() => {
    if (!gameStates.has(s.roomId) || s.gameOver) return;
    if (s.round >= WP_TOTAL_ROUNDS) {
      finishGame(io, s);
    } else {
      s.round++;
      dealRound(s);
      startRoundTimer(io, s);
      void broadcastState(io, s);
    }
  }, WP_REVEAL_MS);
}

function finishGame(io: IO, s: WPState) {
  s.phase = 'finished';
  s.gameOver = true;
  clearTimer(s);
  void broadcastState(io, s);

  const [a, b] = s.players;
  const sa = s.scores[a.id] ?? 0;
  const sb = s.scores[b.id] ?? 0;
  const rankings =
    sa === sb
      ? [
          { playerId: a.id, nickname: a.nickname, rank: 1, score: sa },
          { playerId: b.id, nickname: b.nickname, rank: 1, score: sb },
        ]
      : sa > sb
        ? [
            { playerId: a.id, nickname: a.nickname, rank: 1, score: sa },
            { playerId: b.id, nickname: b.nickname, rank: 2, score: sb },
          ]
        : [
            { playerId: b.id, nickname: b.nickname, rank: 1, score: sb },
            { playerId: a.id, nickname: a.nickname, rank: 2, score: sa },
          ];

  const payload = {
    rankings,
    totalTurns: s.round,
    gameResultData: {
      history: s.history,
      scores: s.scores,
      players: { [a.id]: { nickname: a.nickname }, [b.id]: { nickname: b.nickname } },
    },
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, 3000);
}

export function initWordPuzzle(
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

  const s: WPState = {
    roomId,
    playMode,
    players: [players[0], players[1]] as [Player, Player],
    phase: 'playing',
    round: 1,
    answerWords: [],
    grid: [],
    scores: { [players[0].id]: 0, [players[1].id]: 0 },
    history: [],
    lastResult: null,
    roundStartedAt: Date.now(),
    startedAt,
    gameOver: false,
    timer: null,
    endGameCallback,
  };
  dealRound(s);
  gameStates.set(roomId, s);
  startRoundTimer(io, s);
  void broadcastState(io, s);
}

export function handleWordPuzzleAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.phase !== 'playing') return;

  const pid = sessions.getToken(socket.id) ?? socket.id;
  if (!s.players.some((p) => p.id === pid)) return;

  const action = data as WordPuzzleAction;
  if (action.type !== 'submit') return;

  const words = Array.isArray(action.words)
    ? action.words.map((w) => String(w).trim()).filter(Boolean)
    : [];
  if (words.length !== 3 || words.some((w) => !/^[가-힣]{3}$/.test(w))) {
    socket.emit('error', { message: '3글자 단어 3개를 모두 조합해 주세요.' });
    return;
  }

  // 1) 9칸 글자 소진 검증
  if (!multisetEqual(words.join('').split(''), s.grid)) {
    socket.emit('error', { message: '격자의 9글자를 정확히 사용해야 해요.' });
    return;
  }
  // 2) 사전 검증 (원본과 달라도 사전 단어 조합이면 정답)
  const invalid = words.filter((w) => !DICT.has(w));
  if (invalid.length > 0) {
    socket.emit('error', { message: `사전에 없는 단어예요: ${invalid.join(', ')}` });
    return;
  }

  endRound(io, s, pid, words);
}

export function cleanupWordPuzzle(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTimer(s);
  gameStates.delete(roomId);
}

export function getWordPuzzleState(roomId: string) {
  const s = gameStates.get(roomId);
  return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
}

export function emitWordPuzzleStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = s.players.some((p) => p.id === pid);
  socket.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
}

export function performWordPuzzleUndo(_io: IO, _roomId: string): boolean {
  return false;
}

export function canWordPuzzleUndo(_roomId: string): boolean {
  return false;
}

export function getWordPuzzleResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  return s ? { history: s.history, scores: s.scores } : undefined;
}
