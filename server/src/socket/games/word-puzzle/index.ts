/** 단어 퍼즐 — 서버 모듈 (init / handleAction / cleanup). */
import type { GameState } from '@shared/types/events.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import {
  WP_TOTAL_ROUNDS,
  WP_WIN_SCORE,
  WP_ROUND_SECONDS,
  WP_REVEAL_MS,
  type WordPuzzleAction,
  type WordPuzzleGameData,
  type WordPuzzleRoundResult,
} from '@shared/types/word-puzzle.js';
import { wordPickPool, wordDictStats, isRealWord } from '@shared/data/word-pool.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { hasWordSearchChance } from '../../../shop/roomShopState.js';
import { consumeWordSearchForRoom } from '../../../shop/applyAutoConsumables.js';
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

interface WPState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  phase: 'playing' | 'reveal' | 'finished';
  round: number;
  answerWords: string[];
  /** 이번 판에 이미 낸 단어 — 7라운드 동안 같은 단어가 다시 나오지 않게 */
  usedWords: Set<string>;
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
/**
 * 출제용 풀 — 표준국어대사전 3글자 명사(정적). 검증은 이 풀이 아니라
 * '해당 라운드에 뽑힌 정답 3단어'로만 하므로 런타임 사전 조회·API 호출이 없다.
 */
const WORDS = wordPickPool();

{
  const st = wordDictStats();
  console.log(
    `[word-puzzle] 출제 풀 ${st.pickPool}단어(큐레이션) · 검색사전 ${st.dict}단어(stdict) 로드`,
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 라운드 출제: 이번 판에 안 나온 서로 다른 3단어 + 글자 9개 셔플 */
function dealRound(s: WPState) {
  const picked = shuffle(WORDS.filter((w) => !s.usedWords.has(w))).slice(0, 3);
  for (const w of picked) s.usedWords.add(w);
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
  return nicknameForViewer(s.roomId, p.id, p.nickname, viewerId);
}

function buildGameData(s: WPState, viewerId: string | null): WordPuzzleGameData {
  const [a, b] = s.players;
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: WP_TOTAL_ROUNDS,
    winScore: WP_WIN_SCORE,
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
    searchChance: viewerId ? hasWordSearchChance(s.roomId, viewerId) : false,
    isSolo: s.playMode === 'solo',
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

const AI_MIN_DELAY_MS = 2500;
const AI_MAX_DELAY_MS = 9000;

/**
 * COM(1인 연습) 모드 — 사람처럼 약간의 지연 후 정답을 제출한다.
 * 별도 전략은 없음(단어조합은 정답이 정해진 스피드 퍼즐이라 판단할 게 없다).
 * 라운드가 바뀌거나 게임이 끝나면(gameStates 교체·라운드 번호 불일치) 예약을 폐기한다.
 */
function scheduleAi(io: IO, s: WPState) {
  if (s.playMode !== 'com') return;
  const ai = s.players.find((p) => p.id === AI_PLAYER_ID);
  if (!ai) return;
  const roundAt = s.round;
  const delay = AI_MIN_DELAY_MS + Math.random() * (AI_MAX_DELAY_MS - AI_MIN_DELAY_MS);
  setTimeout(() => {
    const cur = gameStates.get(s.roomId);
    if (cur !== s || cur.gameOver || cur.phase !== 'playing' || cur.round !== roundAt) return;
    endRound(io, cur, ai.id, [...cur.answerWords]);
  }, delay);
}

/**
 * 승부가 났는가 — 4점을 먼저 땄거나, 남은 라운드를 다 따도 뒤집을 수 없을 때.
 * 솔로는 상대가 없으니 7라운드를 모두 푼다.
 */
function decided(s: WPState): boolean {
  if (s.playMode === 'solo') return false;
  const [sa, sb] = s.players.map((p) => s.scores[p.id] ?? 0);
  return Math.max(sa, sb) >= WP_WIN_SCORE || Math.abs(sa - sb) > WP_TOTAL_ROUNDS - s.round;
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
    if (s.round >= WP_TOTAL_ROUNDS || decided(s)) {
      finishGame(io, s);
    } else {
      s.round++;
      dealRound(s);
      startRoundTimer(io, s);
      scheduleAi(io, s);
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

  // 솔로 — 상대가 없으므로 개인 점수만 단일 랭킹으로 보고한다(a===b 중복 방지).
  if (s.playMode === 'solo') {
    const score = s.scores[a.id] ?? 0;
    const payload = {
      rankings: [{ playerId: a.id, nickname: a.nickname, rank: 1, score }],
      totalTurns: s.round,
      gameResultData: {
        history: s.history,
        scores: s.scores,
        players: { [a.id]: { nickname: a.nickname } },
      },
    };
    setTimeout(() => {
      if (!gameStates.has(s.roomId)) return;
      gameStates.delete(s.roomId);
      s.endGameCallback(io, s.roomId, payload);
    }, 3000);
    return;
  }

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

  // 1인 솔로 — 상대가 없으므로 유일한 플레이어를 두 슬롯 모두에 채운다(내부 자료구조 재사용).
  // 룸에 실제로 저장되는 players 는 여전히 1명뿐이라 랭크 집계·아이템 소모는 영향 없음.
  const isSolo = playMode === 'solo';
  const p0 = players[0];
  const p1 = isSolo ? p0 : players[1];

  const s: WPState = {
    roomId,
    playMode,
    players: [p0, p1] as [Player, Player],
    phase: 'playing',
    round: 1,
    answerWords: [],
    usedWords: new Set(),
    grid: [],
    scores: { [p0.id]: 0, [p1.id]: 0 },
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
  scheduleAi(io, s);
  void broadcastState(io, s);

  // '검색 찬스' 아이템 소모 — 단어조합이 실제 시작될 때만(다른 게임 낭비 방지).
  // 소모 후 사전 검색창이 열리도록 상태를 다시 브로드캐스트한다.
  void consumeWordSearchForRoom(io, roomId, players)
    .then((changed) => {
      if (changed && gameStates.get(roomId) === s) void broadcastState(io, s);
    })
    .catch((err) => {
      console.warn('[word-puzzle] 검색 찬스 소모 실패:', (err as Error).message);
    });
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

  // '검색 찬스' — 실제 사전에 있는 단어인지 조회 (보유자만, 라운드 판정과 무관)
  if (action.type === 'search') {
    if (!hasWordSearchChance(roomId, pid)) return;
    const word = String(action.word ?? '').trim();
    if (!/^[가-힣]{3}$/.test(word)) {
      socket.emit('wordpuzzle:searchResult', { word, exists: false });
      return;
    }
    socket.emit('wordpuzzle:searchResult', { word, exists: isRealWord(word) });
    return;
  }

  if (action.type !== 'submit') return;

  const words = Array.isArray(action.words)
    ? action.words.map((w) => String(w).trim()).filter(Boolean)
    : [];
  if (words.length !== 3 || words.some((w) => !/^[가-힣]{3}$/.test(w))) {
    socket.emit('error', { message: '3글자 단어 3개를 모두 조합해 주세요.' });
    return;
  }

  // 정답 3단어와 정확히 일치하는지만 검증 (사전 조회·API 없음, O(1)).
  //  · 중복 답(다른 조합)은 인정하지 않는다 — 이 라운드의 정답만 정답.
  //  · 멀티셋 비교라 제출 순서는 무관.
  if (!multisetEqual(words, s.answerWords)) {
    // 9글자는 맞지만 정답 조합이 아닌 경우와, 글자 자체가 틀린 경우를 구분해 안내
    if (multisetEqual(words.join('').split(''), s.grid)) {
      socket.emit('error', { message: '9글자는 맞지만 정답 단어 조합이 아니에요.' });
    } else {
      socket.emit('error', { message: '격자의 9글자로 만든 정답 3단어를 맞혀야 해요.' });
    }
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

/** 테스트용 — 지금 라운드의 정답 3단어 */
export function wordPuzzleAnswerOf(roomId: string): string[] | undefined {
  return gameStates.get(roomId)?.answerWords;
}
