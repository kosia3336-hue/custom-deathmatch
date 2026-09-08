import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
/**
 * 콰트로 — 서버 상태/로직.
 *
 * 흐름: mulligan(선→후→선→후) → [round 1..4: open(동시) → (round<4) exchange(선-후-후-선-선-후…)] → reveal
 *  - 교환: 가상 플레이어 6명과 각자 정확히 1회씩(총 6회) 교환해야 함. 스탑(교환 포기) 가능하나
 *    마지막 교환 페이즈(3라운드)에서는 미사용 VP가 남아 있으면 스탑 불가.
 *  - 다음 라운드 선후공: 해당 교환 페이즈에서 먼저 스탑한 쪽이 후공.
 */
import type { GameState } from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  QUATRO_SUIT_PRIORITY,
  QUATRO_MAX_MULLIGANS,
  QUATRO_VP_COUNT,
  QUATRO_HAND_SIZE,
  type QuatroCard,
  type QuatroSuit,
  type QuatroPhase,
  type QuatroGameData,
  type QuatroVpView,
  type QuatroPlayerView,
  type QuatroResultSummary,
  type QuatroLogEntry,
} from '@shared/types/quatro.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';

export type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

interface QPlayer {
  id: string;
  nickname: string;
  hand: QuatroCard[];
  openIds: Set<string>;
  seenIds: Set<string>; // 멀리건 중복 수령 방지 (이전에 들고 있던 카드)
  mulligansUsed: number;
  mulliganDone: boolean;
  stopped: boolean;
  usedVps: Set<number>;
  openChoice: string | null;
}

interface QVp {
  cards: QuatroCard[];
  openIds: Set<string>; // 플레이어에게서 받은 (공개) 카드
  usedBy: Set<string>; // 교환한 플레이어 id
}

export interface QuatroState {
  roomId: string;
  playMode: PlayMode;
  phase: QuatroPhase;
  round: number;
  players: [QPlayer, QPlayer];
  vps: QVp[];
  deck: QuatroCard[]; // 미분배 잔여 (멀리건 풀)
  firstIdx: 0 | 1;
  mulliganQueue: number[]; // 플레이어 idx 순서
  turnQueue: number[]; // exchange 턴 순서 (플레이어 idx)
  turnPtr: number;
  firstStopperId: string | null;
  result: QuatroResultSummary | null;
  log: QuatroLogEntry[];
  gameOver: boolean;
  startedAt: number;
  turnStartedAt: number;
  /** 턴 시간제한(초). null = 무제한 (자동 진행 없음) */
  timeLimitSeconds: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EndGameFn;
}

export const gameStates = new Map<string, QuatroState>();

/* ────────── 덱 ────────── */

const SUITS: QuatroSuit[] = ['spade', 'diamond', 'heart', 'club'];

function buildDeck(): QuatroCard[] {
  const deck: QuatroCard[] = [];
  for (const suit of SUITS) {
    for (let n = 1; n <= 6; n++) deck.push({ id: `${suit}-${n}`, suit, num: n });
  }
  deck.push({ id: 'black-0-a', suit: 'black', num: 0 });
  deck.push({ id: 'black-0-b', suit: 'black', num: 0 });
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ────────── 초기화 ────────── */

export function createState(
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
): QuatroState {
  const deck = buildDeck();
  const mk = (p: Player): QPlayer => {
    const hand = deck.splice(0, QUATRO_HAND_SIZE);
    return {
      id: p.id,
      nickname: p.nickname,
      hand,
      openIds: new Set(),
      seenIds: new Set(hand.map((c) => c.id)),
      mulligansUsed: 0,
      mulliganDone: false,
      stopped: false,
      usedVps: new Set(),
      openChoice: null,
    };
  };
  const p0 = mk(players[0]);
  const p1 = mk(players[1]);

  const s: QuatroState = {
    roomId,
    playMode,
    phase: 'mulligan',
    round: 0,
    players: [p0, p1],
    vps: [],
    deck,
    firstIdx: 0,
    mulliganQueue: [0, 1, 0, 1],
    turnQueue: [],
    turnPtr: 0,
    firstStopperId: null,
    result: null,
    log: [],
    gameOver: false,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    timer: null,
    endGameCallback,
  };
  return s;
}

/** 멀리건 종료 후 가상 플레이어 분배 */
function dealVps(s: QuatroState) {
  s.vps = [];
  for (let i = 0; i < QUATRO_VP_COUNT; i++) {
    s.vps.push({ cards: s.deck.splice(0, 3), openIds: new Set(), usedBy: new Set() });
  }
}

/* ────────── 진행 헬퍼 ────────── */

function player(s: QuatroState, idx: number): QPlayer {
  return s.players[idx]!;
}

export function playerIdxById(s: QuatroState, id: string): 0 | 1 | -1 {
  if (s.players[0].id === id) return 0;
  if (s.players[1].id === id) return 1;
  return -1;
}

function secondIdx(s: QuatroState): 0 | 1 {
  return s.firstIdx === 0 ? 1 : 0;
}

/** exchange 턴 순서 생성: 선,후,후,선,선,후,후,… (충분히 길게) */
function buildTurnQueue(s: QuatroState): number[] {
  const f = s.firstIdx;
  const g = secondIdx(s);
  const seq: number[] = [f];
  let cur = g;
  while (seq.length < 24) {
    seq.push(cur, cur);
    cur = cur === f ? g : f;
  }
  return seq;
}

/** 현재 멀리건 차례 플레이어 idx (없으면 -1) */
export function currentMulliganIdx(s: QuatroState): number {
  while (s.mulliganQueue.length > 0) {
    const idx = s.mulliganQueue[0];
    const p = player(s, idx);
    if (p.mulliganDone || p.mulligansUsed >= QUATRO_MAX_MULLIGANS) {
      s.mulliganQueue.shift();
      continue;
    }
    return idx;
  }
  return -1;
}

/** 현재 교환 턴 플레이어 idx (없으면 -1 = 페이즈 종료) */
export function currentExchangeIdx(s: QuatroState): number {
  while (s.turnPtr < s.turnQueue.length) {
    const idx = s.turnQueue[s.turnPtr];
    const p = player(s, idx);
    if (p.stopped) {
      s.turnPtr++;
      continue;
    }
    if (p.usedVps.size >= QUATRO_VP_COUNT) {
      p.stopped = true;
      s.turnPtr++;
      continue;
    }
    return idx;
  }
  return -1;
}

/** 마지막 교환 페이즈(3라운드)인가 */
export function isLastExchangePhase(s: QuatroState): boolean {
  return s.round >= 3;
}

/* ────────── 멀리건 ────────── */

export function applyMulligan(s: QuatroState, idx: number, use: boolean) {
  const p = player(s, idx);
  s.log.push({ round: 0, type: 'mulligan', actorId: p.id, used: use });
  if (!use) {
    p.mulliganDone = true; // 거부 의사 = 더 이상 멀리건 없음
    return;
  }
  // 새 4장: 이전에 들고 있던 카드는 다시 받을 수 없음
  const pool = shuffle(s.deck.filter((c) => !p.seenIds.has(c.id)));
  const drawn = pool.slice(0, QUATRO_HAND_SIZE);
  if (drawn.length < QUATRO_HAND_SIZE) {
    // 풀 부족 (이론상 희박) — 멀리건 무효 처리
    p.mulliganDone = true;
    return;
  }
  // 기존 손패는 덱으로 반환
  s.deck = s.deck.filter((c) => !drawn.some((d) => d.id === c.id));
  s.deck.push(...p.hand);
  s.deck = shuffle(s.deck);
  p.hand = drawn;
  for (const c of drawn) p.seenIds.add(c.id);
  p.mulligansUsed++;
}

/** 멀리건 페이즈 종료 → 1라운드 오픈으로 */
export function startRounds(s: QuatroState) {
  dealVps(s);
  s.round = 1;
  beginOpenPhase(s);
}

export function beginOpenPhase(s: QuatroState) {
  s.phase = 'open';
  for (const p of s.players) p.openChoice = null;
  s.turnStartedAt = Date.now();
}

export function beginExchangePhase(s: QuatroState) {
  s.phase = 'exchange';
  for (const p of s.players) p.stopped = false;
  s.firstStopperId = null;
  s.turnQueue = buildTurnQueue(s);
  s.turnPtr = 0;
  s.turnStartedAt = Date.now();
}

/** 오픈 확정 처리 (둘 다 선택 완료 시) */
export function commitOpens(s: QuatroState) {
  for (const p of s.players) {
    if (p.openChoice) {
      p.openIds.add(p.openChoice);
      const card = p.hand.find((c) => c.id === p.openChoice);
      if (card) s.log.push({ round: s.round, type: 'open', actorId: p.id, card });
    }
    p.openChoice = null;
  }
}

/** 교환 페이즈 종료 → 다음 라운드 (스탑 순서에 따라 선후공 변경) */
export function endExchangePhase(s: QuatroState) {
  if (s.firstStopperId) {
    // 먼저 스탑한 사람이 후공
    const stopIdx = playerIdxById(s, s.firstStopperId);
    if (stopIdx !== -1) s.firstIdx = stopIdx === 0 ? 1 : 0;
  }
  s.round++;
  beginOpenPhase(s);
}

/* ────────── 가상 플레이어 교환 규칙 ────────── */

function suitPri(c: QuatroCard): number {
  return QUATRO_SUIT_PRIORITY[c.suit];
}

/** VP 가 내줄 카드 선택 */
export function vpPickCard(s: QuatroState, vpIdx: number, forPlayerIdx: number): QuatroCard {
  const vp = s.vps[vpIdx]!;
  const p = player(s, forPlayerIdx);

  // 1) 검정 0 이 있으면 무조건 검정 0
  const black = vp.cards.find((c) => c.suit === 'black');
  if (black) return black;

  const openCards = p.hand.filter((c) => p.openIds.has(c.id));
  const openSuits = new Set<QuatroSuit>(
    openCards.map((c) => c.suit).filter((x): x is QuatroSuit => x !== 'black'),
  );
  const openNums = new Set(openCards.filter((c) => c.suit !== 'black').map((c) => c.num));

  // 2) 오픈된 카드 기준 콰트로에 적합한 카드 (문양·숫자 모두 비중복)
  const fit = vp.cards.filter((c) => !openSuits.has(c.suit) && !openNums.has(c.num));
  const pool = fit.length > 0 ? fit : vp.cards;

  // 3) 가장 높은 수 → 문양 우선순위
  return [...pool].sort((a, b) => (b.num - a.num) || (suitPri(b) - suitPri(a)))[0]!;
}

/** 교환 실행. giveCardId 는 플레이어의 비공개 카드 */
export function applyExchange(s: QuatroState, pIdx: number, vpIdx: number, giveCardId: string): string | null {
  const p = player(s, pIdx);
  const vp = s.vps[vpIdx];
  if (!vp) return '가상 플레이어가 없습니다.';
  if (p.usedVps.has(vpIdx)) return '이미 교환한 가상 플레이어입니다.';
  const give = p.hand.find((c) => c.id === giveCardId);
  if (!give) return '가지고 있지 않은 카드입니다.';
  if (p.openIds.has(giveCardId)) return '오픈된 카드는 교환할 수 없습니다.';

  const receive = vpPickCard(s, vpIdx, pIdx);

  // 스왑
  p.hand = p.hand.filter((c) => c.id !== give.id);
  p.hand.push(receive);
  p.seenIds.add(receive.id);
  vp.cards = vp.cards.filter((c) => c.id !== receive.id);
  vp.cards.push(give);
  vp.openIds.delete(receive.id);
  vp.openIds.add(give.id); // 넘긴 카드는 공개 상태
  vp.usedBy.add(p.id);
  p.usedVps.add(vpIdx);
  s.log.push({ round: s.round, type: 'exchange', actorId: p.id, vpIndex: vpIdx, gave: give, received: receive });
  return null;
}

/* ────────── 판정 ────────── */

/** 콰트로 여부: 검정0 은 만능. 단 검정0 2장 보유 시 콰트로 실패. 나머지는 문양·숫자 모두 중복 없어야 함 */
export function isQuatro(hand: QuatroCard[]): boolean {
  if (hand.filter((c) => c.suit === 'black').length >= 2) return false;
  const normal = hand.filter((c) => c.suit !== 'black');
  const suits = new Set(normal.map((c) => c.suit));
  const nums = new Set(normal.map((c) => c.num));
  return suits.size === normal.length && nums.size === normal.length;
}

function handSum(hand: QuatroCard[]): number {
  return hand.reduce((a, c) => a + c.num, 0);
}

/** 동점 비교: 숫자 내림차순 → 문양 우선순위 내림차순으로 카드별 비교. 1=a승, -1=b승, 0=무 */
function compareHands(a: QuatroCard[], b: QuatroCard[]): number {
  const key = (h: QuatroCard[]) =>
    [...h].sort((x, y) => (y.num - x.num) || (suitPri(y) - suitPri(x)));
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const ca = ka[i];
    const cb = kb[i];
    if (!ca || !cb) return ca ? 1 : cb ? -1 : 0;
    if (ca.num !== cb.num) return ca.num > cb.num ? 1 : -1;
    if (suitPri(ca) !== suitPri(cb)) return suitPri(ca) > suitPri(cb) ? 1 : -1;
  }
  return 0;
}

export function judge(s: QuatroState): QuatroResultSummary {
  const [a, b] = s.players;
  const qa = isQuatro(a.hand);
  const qb = isQuatro(b.hand);
  const sa = handSum(a.hand);
  const sb = handSum(b.hand);

  let winnerId: string | null = null;
  let reason: string;

  if (qa !== qb) {
    winnerId = qa ? a.id : b.id;
    reason = '콰트로 완성';
  } else {
    const label = qa ? '콰트로 완성 — ' : '';
    if (sa !== sb) {
      winnerId = sa > sb ? a.id : b.id;
      reason = `${label}합계 ${Math.max(sa, sb)} vs ${Math.min(sa, sb)}`;
    } else {
      const cmp = compareHands(a.hand, b.hand);
      if (cmp === 0) {
        winnerId = null;
        reason = '완전 동점';
      } else {
        winnerId = cmp > 0 ? a.id : b.id;
        reason = `${label}합계 동점 — 높은 카드 우세`;
      }
    }
  }

  return {
    winnerId,
    reason,
    hands: { [a.id]: [...a.hand], [b.id]: [...b.hand] },
    quatro: { [a.id]: qa, [b.id]: qb },
    sums: { [a.id]: sa, [b.id]: sb },
  };
}

/* ────────── 상태 브로드캐스트 ────────── */

function maskNick(s: QuatroState, viewerId: string | null, p: QPlayer): string {
  return isTokenAnonymized(s.roomId, p.id) && p.id !== viewerId ? ANONYMOUS_NICKNAME : p.nickname;
}

function playerView(s: QuatroState, p: QPlayer, viewerId: string | null, isSelf: boolean): QuatroPlayerView {
  const revealAll = isSelf || s.phase === 'reveal' || s.phase === 'finished';
  return {
    id: p.id,
    nickname: maskNick(s, viewerId, p),
    mulligansUsed: p.mulligansUsed,
    stopped: p.stopped,
    vpUsedCount: p.usedVps.size,
    hand: p.hand.map((c) => {
      const open = p.openIds.has(c.id);
      return { card: revealAll || open ? c : null, open };
    }),
  };
}

function vpViews(s: QuatroState, viewerId: string | null): QuatroVpView[] {
  return s.vps.map((vp, i) => ({
    index: i,
    receivedOpen: vp.cards.filter((c) => vp.openIds.has(c.id)),
    hiddenCount: vp.cards.filter((c) => !vp.openIds.has(c.id)).length,
    usedByMe: viewerId ? vp.usedBy.has(viewerId) : false,
    usedByOpp: viewerId
      ? [...vp.usedBy].some((id) => id !== viewerId)
      : vp.usedBy.size > 0,
  }));
}

function currentTurnId(s: QuatroState): string | null {
  if (s.phase === 'mulligan') {
    const idx = currentMulliganIdx(s);
    return idx === -1 ? null : s.players[idx].id;
  }
  if (s.phase === 'exchange') {
    const idx = currentExchangeIdx(s);
    return idx === -1 ? null : s.players[idx].id;
  }
  return null;
}

export function buildGameData(s: QuatroState, viewerId: string | null): QuatroGameData {
  const [a, b] = s.players;
  const meP = viewerId ? s.players.find((p) => p.id === viewerId) ?? null : null;
  const oppP = meP ? s.players.find((p) => p.id !== viewerId)! : null;

  const mustRemain =
    s.phase === 'exchange' && isLastExchangePhase(s) && meP
      ? QUATRO_VP_COUNT - meP.usedVps.size
      : 0;

  return {
    phase: s.phase,
    round: s.round,
    firstId: s.players[s.firstIdx].id,
    currentTurnId: currentTurnId(s),
    me: meP ? playerView(s, meP, viewerId, true) : null,
    opp: oppP ? playerView(s, oppP, viewerId, false) : null,
    players: {
      [a.id]: { nickname: maskNick(s, viewerId, a) },
      [b.id]: { nickname: maskNick(s, viewerId, b) },
    },
    vps: vpViews(s, viewerId),
    iOpened: Boolean(meP?.openChoice) || false,
    oppOpened: Boolean(oppP?.openChoice) || false,
    mustExchangeRemaining: mustRemain,
    result: s.phase === 'reveal' || s.phase === 'finished' ? s.result : null,
    turnSeconds: s.timeLimitSeconds ?? 0, // 0 = 무제한
  };
}

function phaseMessage(s: QuatroState): string {
  switch (s.phase) {
    case 'mulligan': {
      const idx = currentMulliganIdx(s);
      return idx === -1 ? '카드 분배 중…' : `${s.players[idx].nickname} 멀리건 결정 중`;
    }
    case 'open':
      return `${s.round}번째 카드 오픈 — 카드를 선택하세요`;
    case 'exchange': {
      const idx = currentExchangeIdx(s);
      return idx === -1 ? '교환 종료' : `${s.players[idx].nickname} 교환 차례`;
    }
    case 'reveal':
    case 'finished':
      return '최종 공개!';
  }
}

function buildGameState(s: QuatroState, gameData: QuatroGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: currentTurnId(s),
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.turnStartedAt,
    gameData: gameData as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(s.roomId),
  };
}

export async function broadcastState(io: IO, s: QuatroState) {
  const sockets = await io.in(socketRoom(s.roomId)).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const isPlayer = playerIdxById(s, pid) !== -1;
    sock.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
  }
}

export function emitStateToSocketImpl(socket: TypedSocket, s: QuatroState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = playerIdxById(s, pid) !== -1;
  socket.emit('game:state', buildGameState(s, buildGameData(s, isPlayer ? pid : null)));
}

/* ────────── 종료 ────────── */

export function finishGame(io: IO, s: QuatroState) {
  s.phase = 'reveal';
  s.result = judge(s);
  s.gameOver = true;
  clearTimer(s);
  void broadcastState(io, s);

  const [a, b] = s.players;
  const r = s.result;
  const rankings = r.winnerId
    ? [
        {
          playerId: r.winnerId,
          nickname: (r.winnerId === a.id ? a : b).nickname,
          rank: 1,
          score: r.sums[r.winnerId] ?? 0,
        },
        {
          playerId: r.winnerId === a.id ? b.id : a.id,
          nickname: (r.winnerId === a.id ? b : a).nickname,
          rank: 2,
          score: r.sums[r.winnerId === a.id ? b.id : a.id] ?? 0,
        },
      ]
    : [
        { playerId: a.id, nickname: a.nickname, rank: 1, score: r.sums[a.id] ?? 0 },
        { playerId: b.id, nickname: b.nickname, rank: 1, score: r.sums[b.id] ?? 0 },
      ];

  const payload = {
    rankings,
    totalTurns: s.round,
    gameResultData: {
      result: r,
      log: s.log,
      vpHands: s.vps.map((vp) => vp.cards),
      players: { [a.id]: { nickname: a.nickname }, [b.id]: { nickname: b.nickname } },
    },
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    s.phase = 'finished';
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, 8000);
}

/* ────────── 타이머 (무응답 자동 진행) ────────── */

export function clearTimer(s: QuatroState) {
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
}

export function armTimer(io: IO, s: QuatroState, onTimeout: (io: IO, s: QuatroState) => void) {
  clearTimer(s);
  s.turnStartedAt = Date.now();
  // 시간제한 없는 방 — 자동 진행하지 않음
  if (s.timeLimitSeconds === null) return;
  s.timer = scheduleTurnExpiry(io, s, 'timer', () => currentTurnId(s), () => {
    if (!gameStates.has(s.roomId) || s.gameOver) return;
    onTimeout(io, s);
  }, s.timeLimitSeconds * 1000);
}
