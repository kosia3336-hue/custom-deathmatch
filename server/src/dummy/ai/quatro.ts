import type { DummyAiTier } from '@shared/dummy.js';
import type {
  QuatroAction,
  QuatroCard,
  QuatroPhase,
  QuatroSuit,
  QuatroVpView,
} from '@shared/types/quatro.js';
import {
  QUATRO_MAX_MULLIGANS,
  QUATRO_SUIT_PRIORITY,
  QUATRO_VP_COUNT,
} from '@shared/types/quatro.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-017 · multi · 전적 집계 79판(로그 75).
 * VP 숨은 패·상대 미오픈은 안 본다. COM `vpPickCard(실상태)` 금지.
 */

export interface QuatroDummyView {
  gameOver: boolean;
  phase: QuatroPhase;
  round: number;
  firstId: string;
  currentTurnId: string | null;
  myId: string;
  oppId: string;
  my: {
    hand: QuatroCard[];
    openIds: string[];
    mulligansUsed: number;
    stopped: boolean;
    vpUsedCount: number;
    usedVps: number[];
  };
  opp: {
    openCards: QuatroCard[];
    closedCount: number;
    mulligansUsed: number;
    stopped: boolean;
    vpUsedCount: number;
  };
  vps: Array<Pick<QuatroVpView, 'index' | 'receivedOpen' | 'hiddenCount' | 'usedByMe' | 'usedByOpp'>>;
  iOpened: boolean;
  oppOpened: boolean;
  mustExchangeRemaining: number;
  winner: string | 'draw' | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

const SUITS: QuatroSuit[] = ['spade', 'diamond', 'heart', 'club'];

export function fullDeck(): QuatroCard[] {
  const deck: QuatroCard[] = [];
  for (const suit of SUITS) {
    for (let n = 1; n <= 6; n++) deck.push({ id: `${suit}-${n}`, suit, num: n });
  }
  deck.push({ id: 'black-0-a', suit: 'black', num: 0 });
  deck.push({ id: 'black-0-b', suit: 'black', num: 0 });
  return deck;
}

function cloneCard(c: QuatroCard): QuatroCard {
  return { id: c.id, suit: c.suit, num: c.num };
}

function suitPri(c: QuatroCard): number {
  return QUATRO_SUIT_PRIORITY[c.suit];
}

export function isQuatro(hand: QuatroCard[]): boolean {
  if (hand.filter((c) => c.suit === 'black').length >= 2) return false;
  const normal = hand.filter((c) => c.suit !== 'black');
  const suits = new Set(normal.map((c) => c.suit));
  const nums = new Set(normal.map((c) => c.num));
  return suits.size === normal.length && nums.size === normal.length;
}

export function handSum(hand: QuatroCard[]): number {
  return hand.reduce((a, c) => a + c.num, 0);
}

export function distinctSize(hand: QuatroCard[]): number {
  const blacks = hand.filter((c) => c.suit === 'black').length;
  if (blacks >= 2) return 0;
  const normal = hand.filter((c) => c.suit !== 'black');
  return Math.min(new Set(normal.map((c) => c.suit)).size, new Set(normal.map((c) => c.num)).size) + blacks;
}

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

export function vpPickFrom(vpCards: QuatroCard[], openCards: QuatroCard[]): QuatroCard {
  const black = vpCards.find((c) => c.suit === 'black');
  if (black) return black;
  const openSuits = new Set(openCards.filter((c) => c.suit !== 'black').map((c) => c.suit));
  const openNums = new Set(openCards.filter((c) => c.suit !== 'black').map((c) => c.num));
  const fit = vpCards.filter((c) => c.suit === 'black' || (!openSuits.has(c.suit) && !openNums.has(c.num)));
  const pool = fit.length > 0 ? fit : vpCards;
  return [...pool].sort((a, b) => (b.num - a.num) || (suitPri(b) - suitPri(a)))[0]!;
}

function shuffleInPlace<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function knownIds(view: QuatroDummyView): Set<string> {
  const ids = new Set<string>();
  for (const c of view.my.hand) ids.add(c.id);
  for (const c of view.opp.openCards) ids.add(c.id);
  for (const vp of view.vps) {
    for (const c of vp.receivedOpen) ids.add(c.id);
  }
  return ids;
}

function unknownPool(view: QuatroDummyView): QuatroCard[] {
  const known = knownIds(view);
  return fullDeck().filter((c) => !known.has(c.id)).map(cloneCard);
}

function myOpenCards(view: QuatroDummyView): QuatroCard[] {
  const ids = new Set(view.my.openIds);
  return view.my.hand.filter((c) => ids.has(c.id));
}

function myClosed(view: QuatroDummyView): QuatroCard[] {
  const ids = new Set(view.my.openIds);
  return view.my.hand.filter((c) => !ids.has(c.id));
}

function blackCount(hand: QuatroCard[]): number {
  return hand.filter((c) => c.suit === 'black').length;
}

/** 기보: R1은 6을 잠근다. 오픈은 교환 불가이므로 키퍼. COM 최악 카드 오픈과 반대. */
export function openScore(card: QuatroCard, alreadyOpen: QuatroCard[]): number {
  const clash = alreadyOpen.some((o) =>
    o.suit !== 'black' && card.suit !== 'black' && (o.suit === card.suit || o.num === card.num),
  );
  let s = card.num * 12;
  if (card.suit === 'black') s = 28;
  if (clash) s -= 90;
  s += suitPri(card);
  return s;
}

export function pickOpenCard(view: QuatroDummyView): QuatroCard | null {
  const closed = myClosed(view);
  if (closed.length === 0) return null;
  const opened = myOpenCards(view);
  let best = closed[0]!;
  let bestS = -1e9;
  for (const c of closed) {
    const s = openScore(c, opened);
    if (s > bestS) {
      bestS = s;
      best = c;
    }
  }
  return best;
}

/** 기보: 교환의 91%가 마지막(R3). R1·R2는 거의 스탑. */
export function shouldStopEarly(view: QuatroDummyView): boolean {
  if (view.round >= 3) return false;
  if (isQuatro(view.my.hand)) return true;
  if (blackCount(view.my.hand) >= 2) return false;
  if (distinctSize(view.my.hand) < 3) return false;
  return true;
}

export function shouldMulligan(hand: QuatroCard[], used: number): boolean {
  if (used >= QUATRO_MAX_MULLIGANS) return false;
  if (isQuatro(hand)) return false;
  if (blackCount(hand) >= 2) return true;
  if (distinctSize(hand) < 3) return true;
  if (distinctSize(hand) === 3 && handSum(hand) <= 9) return true;
  return false;
}

function outcome(my: QuatroCard[], opp: QuatroCard[]): number {
  const mq = isQuatro(my);
  const oq = isQuatro(opp);
  if (mq !== oq) return mq ? 1 : 0;
  const ms = handSum(my);
  const os = handSum(opp);
  if (ms !== os) return ms > os ? 1 : 0;
  const cmp = compareHands(my, opp);
  if (cmp === 0) return 0.5;
  return cmp > 0 ? 1 : 0;
}

function worstClosed(hand: QuatroCard[], openIds: Set<string>): QuatroCard | null {
  const closed = hand.filter((c) => !openIds.has(c.id));
  if (closed.length === 0) return null;
  let best: { card: QuatroCard; score: number } | null = null;
  for (const c of closed) {
    const rest = hand.filter((x) => x.id !== c.id);
    const s = (isQuatro(rest) ? 500 : distinctSize(rest) * 20) + handSum(rest) - c.num;
    if (!best || s > best.score) best = { card: c, score: s };
  }
  return best?.card ?? null;
}

/**
 * 운영 기보 game-017 multi 로그 75판.
 * 오픈 숫자 빈도·멀리건 사용/거부 횟수·라운드별 교환 횟수.
 * 스탑은 로그에 없음 → 페이즈 150(75×2)에서 교환 횟수를 뺀 하한.
 */
const GIBO_OPEN_NUM: Record<number, Record<number, number>> = {
  1: { 0: 10, 1: 3, 2: 6, 3: 9, 4: 24, 5: 27, 6: 71 },
  2: { 0: 8, 1: 5, 2: 24, 3: 23, 4: 30, 5: 37, 6: 23 },
  3: { 0: 40, 1: 12, 2: 16, 3: 25, 4: 23, 5: 18, 6: 16 },
  4: { 0: 15, 1: 20, 2: 21, 3: 22, 4: 19, 5: 25, 6: 28 },
};
const GIBO_MULLIGAN = { skip: 114, use: 112 };
const GIBO_EXCHANGE = { 1: 20, 2: 61, 3: 819 };
const GIBO_STOP = { 1: 130, 2: 89 };
const GIBO_PRIOR = 0.08;

interface SampledBoard {
  myHand: QuatroCard[];
  myOpenIds: Set<string>;
  oppHand: QuatroCard[];
  oppOpenIds: Set<string>;
  vpCards: QuatroCard[][];
  myUsed: Set<number>;
  oppUsed: Set<number>;
}

function cloneBoard(b: SampledBoard): SampledBoard {
  return {
    myHand: b.myHand.map(cloneCard),
    myOpenIds: new Set(b.myOpenIds),
    oppHand: b.oppHand.map(cloneCard),
    oppOpenIds: new Set(b.oppOpenIds),
    vpCards: b.vpCards.map((vp) => vp.map(cloneCard)),
    myUsed: new Set(b.myUsed),
    oppUsed: new Set(b.oppUsed),
  };
}

function dealFromPool(view: QuatroDummyView, myHand: QuatroCard[], pool: QuatroCard[]): SampledBoard {
  const rest = shuffleInPlace(pool.map(cloneCard));
  let i = 0;
  const oppClosed = rest.slice(i, i + view.opp.closedCount);
  i += view.opp.closedCount;
  const vpCards: QuatroCard[][] = view.vps.map((vp) => {
    const hidden = rest.slice(i, i + vp.hiddenCount);
    i += vp.hiddenCount;
    return [...vp.receivedOpen.map(cloneCard), ...hidden];
  });
  return {
    myHand: myHand.map(cloneCard),
    myOpenIds: new Set(view.my.openIds),
    oppHand: [...view.opp.openCards.map(cloneCard), ...oppClosed],
    oppOpenIds: new Set(view.opp.openCards.map((c) => c.id)),
    vpCards,
    myUsed: new Set(view.my.usedVps),
    oppUsed: new Set(view.vps.filter((v) => v.usedByOpp).map((v) => v.index)),
  };
}

function sampleKeepWorld(view: QuatroDummyView): SampledBoard {
  return dealFromPool(view, view.my.hand, unknownPool(view));
}

function sampleMulliganWorld(view: QuatroDummyView): SampledBoard | null {
  const fresh = shuffleInPlace(unknownPool(view));
  if (fresh.length < 4) return null;
  const drawn = fresh.slice(0, 4);
  const rest = [...fresh.slice(4), ...view.my.hand.map(cloneCard)];
  return dealFromPool(view, drawn, rest);
}

type Side = 'my' | 'opp';

function handOf(board: SampledBoard, who: Side): QuatroCard[] {
  return who === 'my' ? board.myHand : board.oppHand;
}

function openOf(board: SampledBoard, who: Side): Set<string> {
  return who === 'my' ? board.myOpenIds : board.oppOpenIds;
}

function usedOf(board: SampledBoard, who: Side): Set<number> {
  return who === 'my' ? board.myUsed : board.oppUsed;
}

function setHand(board: SampledBoard, who: Side, hand: QuatroCard[]): void {
  if (who === 'my') board.myHand = hand;
  else board.oppHand = hand;
}

function applyExWho(board: SampledBoard, who: Side, vpIdx: number, giveId: string): boolean {
  const hand = handOf(board, who);
  const open = openOf(board, who);
  const used = usedOf(board, who);
  const give = hand.find((c) => c.id === giveId);
  const vp = board.vpCards[vpIdx];
  if (!give || !vp || vp.length === 0 || used.has(vpIdx) || open.has(giveId)) return false;
  const recv = vpPickFrom(vp, hand.filter((c) => open.has(c.id)));
  if (!recv) return false;
  setHand(board, who, [...hand.filter((c) => c.id !== give.id), cloneCard(recv)]);
  board.vpCards[vpIdx] = [...vp.filter((c) => c.id !== recv.id), cloneCard(give)];
  used.add(vpIdx);
  return true;
}

function openKeeper(board: SampledBoard, who: Side): boolean {
  const hand = handOf(board, who);
  const open = openOf(board, who);
  const closed = hand.filter((c) => !open.has(c.id));
  if (closed.length === 0) return false;
  const opened = hand.filter((c) => open.has(c.id));
  let best = closed[0]!;
  let bestS = -1e9;
  for (const c of closed) {
    const s = openScore(c, opened);
    if (s > bestS) {
      bestS = s;
      best = c;
    }
  }
  open.add(best.id);
  return true;
}

function openUntil(board: SampledBoard, who: Side, target: number): void {
  const open = openOf(board, who);
  while (open.size < target) {
    if (!openKeeper(board, who)) break;
  }
}

function firstUnusedVp(used: Set<number>): number | null {
  for (let i = 0; i < QUATRO_VP_COUNT; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

function dumpAll(board: SampledBoard, who: Side): void {
  const used = usedOf(board, who);
  let guard = 0;
  while (used.size < QUATRO_VP_COUNT && guard < QUATRO_VP_COUNT) {
    guard += 1;
    const give = worstClosed(handOf(board, who), openOf(board, who));
    const vpIdx = firstUnusedVp(used);
    if (!give || vpIdx == null) break;
    if (!applyExWho(board, who, vpIdx, give.id)) {
      used.add(vpIdx);
    }
  }
}

/** 기보: 초반 교환은 거의 스탑. 깨진 손(검정0 2장·비중복 3 미만)만 1회. */
function maybeEarlyDump(board: SampledBoard, who: Side): void {
  const hand = handOf(board, who);
  if (isQuatro(hand)) return;
  if (blackCount(hand) < 2 && distinctSize(hand) >= 3) return;
  const give = worstClosed(hand, openOf(board, who));
  const vpIdx = firstUnusedVp(usedOf(board, who));
  if (!give || vpIdx == null) return;
  applyExWho(board, who, vpIdx, give.id);
}

function finishFromExchangeRound(
  board: SampledBoard,
  startRound: number,
  skipMyEarlyThisRound: boolean,
): number {
  for (let r = startRound; r <= 3; r++) {
    const skipMe = r === startRound && skipMyEarlyThisRound;
    if (r >= 3) {
      dumpAll(board, 'my');
      dumpAll(board, 'opp');
    } else {
      if (!skipMe) maybeEarlyDump(board, 'my');
      maybeEarlyDump(board, 'opp');
    }
    const nextOpen = Math.min(4, r + 1);
    openUntil(board, 'my', nextOpen);
    openUntil(board, 'opp', nextOpen);
  }
  openUntil(board, 'my', 4);
  openUntil(board, 'opp', 4);
  return outcome(board.myHand, board.oppHand);
}

function playout(board: SampledBoard, view: QuatroDummyView, skipMyEarlyThisRound: boolean): number {
  if (view.phase === 'mulligan') {
    openUntil(board, 'my', 1);
    openUntil(board, 'opp', 1);
    return finishFromExchangeRound(board, 1, false);
  }
  if (view.phase === 'open') {
    const r = Math.max(1, view.round);
    openUntil(board, 'my', r);
    openUntil(board, 'opp', r);
    if (r >= 4) return outcome(board.myHand, board.oppHand);
    return finishFromExchangeRound(board, r, false);
  }
  if (view.phase === 'exchange') {
    return finishFromExchangeRound(board, Math.max(1, view.round), skipMyEarlyThisRound);
  }
  return outcome(board.myHand, board.oppHand);
}

function applyAction(board: SampledBoard, action: QuatroAction): boolean {
  if (action.type === 'mulligan') return true;
  if (action.type === 'open') {
    if (!board.myHand.some((c) => c.id === action.cardId)) return false;
    board.myOpenIds.add(action.cardId);
    return true;
  }
  if (action.type === 'stop') return true;
  if (action.type === 'exchange') {
    applyExWho(board, 'my', action.vpIndex, action.giveCardId);
    return true;
  }
  return false;
}

function evalActionOnBoard(board: SampledBoard, view: QuatroDummyView, action: QuatroAction): number {
  const b = cloneBoard(board);
  if (!applyAction(b, action)) return 0;
  const skipMyEarly = action.type === 'stop' || action.type === 'exchange';
  return playout(b, view, skipMyEarly);
}

function giboPrior(view: QuatroDummyView, action: QuatroAction): number {
  let n = 1;
  if (action.type === 'mulligan') {
    n = action.use ? GIBO_MULLIGAN.use : GIBO_MULLIGAN.skip;
  } else if (action.type === 'open') {
    const card = view.my.hand.find((c) => c.id === action.cardId);
    const round = Math.min(4, Math.max(1, view.round));
    n = GIBO_OPEN_NUM[round]?.[card?.num ?? -1] ?? 1;
  } else if (action.type === 'stop') {
    const r = view.round === 2 ? 2 : 1;
    n = GIBO_STOP[r];
  } else if (action.type === 'exchange') {
    const r = view.round >= 3 ? 3 : view.round === 2 ? 2 : 1;
    n = GIBO_EXCHANGE[r];
  }
  return GIBO_PRIOR * Math.log(1 + n);
}

function tierKnobs(tier: DummyAiTier): { softmaxTemp: number } {
  if (tier === '하') return { softmaxTemp: 0.08 };
  if (tier === '중') return { softmaxTemp: 0.03 };
  return { softmaxTemp: 0.012 };
}

function pickSoftmax<T>(scored: Array<{ cand: T; score: number }>, tier: DummyAiTier, temp: number): T {
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) throw new Error('pickSoftmax empty');
  const best = scored[0]!.score;
  const near = scored.filter((x) => x.score >= best - (tier === '하' ? 0.04 : tier === '중' ? 0.02 : 0.008));
  const pool = near.length > 0 ? near : scored.slice(0, 1);
  if (tier === '상' || pool.length === 1) return pool[0]!.cand;
  const t = Math.max(0.008, temp);
  const maxS = pool[0]!.score;
  const weights = pool.map((x) => Math.exp((x.score - maxS) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!.cand;
  }
  return pool[pool.length - 1]!.cand;
}

type Cand = { action: QuatroAction; key: string };

export function candidates(view: QuatroDummyView): Cand[] {
  if (view.phase === 'mulligan') {
    const out: Cand[] = [{ action: { type: 'mulligan', use: false }, key: 'mulligan:0' }];
    if (view.my.mulligansUsed < QUATRO_MAX_MULLIGANS) {
      out.push({ action: { type: 'mulligan', use: true }, key: 'mulligan:1' });
    }
    return out;
  }

  if (view.phase === 'open') {
    return myClosed(view).map((c) => ({
      action: { type: 'open', cardId: c.id },
      key: `open:${c.id}`,
    }));
  }

  if (view.phase === 'exchange') {
    const must = view.round >= 3 && view.my.vpUsedCount < QUATRO_VP_COUNT;
    const out: Cand[] = [];
    if (!must) out.push({ action: { type: 'stop' }, key: 'stop' });
    const closed = myClosed(view);
    for (const vp of view.vps) {
      if (vp.usedByMe) continue;
      for (const give of closed) {
        out.push({
          action: { type: 'exchange', vpIndex: vp.index, giveCardId: give.id },
          key: `ex:${vp.index}:${give.id}`,
        });
      }
    }
    if (out.length === 0) return [{ action: { type: 'stop' }, key: 'stop' }];
    return out;
  }

  return [];
}

export async function pickQuatroActionAsync(
  view: QuatroDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<QuatroAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  if (view.phase === 'reveal' || view.phase === 'finished') return null;

  if (view.phase === 'mulligan') {
    if (view.currentTurnId !== dummyId) return null;
  } else if (view.phase === 'open') {
    if (view.iOpened) return null;
  } else if (view.phase === 'exchange') {
    if (view.currentTurnId !== dummyId || view.my.stopped) return null;
  } else {
    return null;
  }

  const knobs = tierKnobs(tier);
  const cands = candidates(view);
  if (cands.length === 0) return null;

  const acc = new Map<string, { cand: Cand; sum: number; n: number }>();
  for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });

  await runPsychologySearch(budgetMs, () => {
    if (view.phase === 'mulligan') {
      const keep = sampleKeepWorld(view);
      const redraw = sampleMulliganWorld(view);
      for (const c of cands) {
        if (c.action.type !== 'mulligan') continue;
        const board = c.action.use ? redraw : keep;
        const sc = board ? evalActionOnBoard(board, view, c.action) : 0;
        const a = acc.get(c.key)!;
        a.sum += sc;
        a.n += 1;
      }
      return;
    }

    const world = sampleKeepWorld(view);
    for (const c of cands) {
      const sc = evalActionOnBoard(world, view, c.action);
      const a = acc.get(c.key)!;
      a.sum += sc;
      a.n += 1;
    }
  }, { batchSize: 4 });

  const scored = [...acc.values()]
    .filter((a) => a.n > 0)
    .map((a) => ({
      cand: a.cand,
      score: a.sum / a.n + giboPrior(view, a.cand.action),
    }));
  if (scored.length === 0) return cands[0]!.action;

  return pickSoftmax(scored, tier, knobs.softmaxTemp).action;
}
