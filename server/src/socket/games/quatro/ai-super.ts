/* 콰트로 슈퍼 자문: 상대 미오픈·VP 숨은 패 금지. 한 수 EV 금지. COM ai.ts 안 씀. */
import type { QuatroAction, QuatroCard } from '@shared/types/quatro.js';
import {
  QUATRO_HAND_SIZE,
  QUATRO_VP_COUNT,
  cloneQuatroCard,
  quatroDistinctSize,
  quatroFullDeck,
  quatroIsQuatro,
  quatroOpenScore,
  quatroPickOpenCard,
  quatroShouldMulligan,
  quatroShouldStopEarly,
  quatroSuitPri,
  quatroVpPickFrom,
} from '@shared/types/quatro.js';
import {
  quatroAdvisorAsk,
  quatroAdvisorPlyLegal,
  quatroAdvisorSnapshot,
  quatroParseAdvisorPly,
  type QuatroAdvisorPly,
  type QuatroAdvisorSnapshot,
  type QuatroAdvisorVp,
} from '@shared/types/quatro-advisor.js';

export const QUATRO_SUPER_THINK_MS = 90_000;
const MIX = 0.5;

export type QuatroAdvisorPick = { action: QuatroAction; winRate: number };

interface EngineView {
  phase: QuatroAdvisorSnapshot['phase'];
  round: number;
  my: {
    hand: QuatroCard[];
    openIds: string[];
    usedVps: number[];
  };
  opp: {
    openCards: QuatroCard[];
    closedCount: number;
  };
  vps: QuatroAdvisorVp[];
}

function viewFromSnap(snap: QuatroAdvisorSnapshot): EngineView {
  return {
    phase: snap.phase,
    round: snap.round,
    my: {
      hand: snap.my.hand.map(cloneQuatroCard),
      openIds: [...snap.my.openIds],
      usedVps: [...snap.my.usedVps],
    },
    opp: {
      openCards: snap.opp.openCards.map(cloneQuatroCard),
      closedCount: snap.opp.closedCount,
    },
    vps: snap.vps.map((vp) => ({
      index: vp.index,
      receivedOpen: vp.receivedOpen.map(cloneQuatroCard),
      hiddenCount: vp.hiddenCount,
      usedByMe: vp.usedByMe,
      usedByOpp: vp.usedByOpp,
    })),
  };
}

function myClosed(view: EngineView): QuatroCard[] {
  const ids = new Set(view.my.openIds);
  return view.my.hand.filter((c) => !ids.has(c.id));
}

function myOpenCards(view: EngineView): QuatroCard[] {
  const ids = new Set(view.my.openIds);
  return view.my.hand.filter((c) => ids.has(c.id));
}

function knownIds(view: EngineView): Set<string> {
  const ids = new Set<string>();
  for (const c of view.my.hand) ids.add(c.id);
  for (const c of view.opp.openCards) ids.add(c.id);
  for (const vp of view.vps) {
    for (const c of vp.receivedOpen) ids.add(c.id);
  }
  return ids;
}

function unknownPool(view: EngineView): QuatroCard[] {
  const known = knownIds(view);
  return quatroFullDeck().filter((c) => !known.has(c.id)).map(cloneQuatroCard);
}

function shuffleInPlace<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function blackCount(hand: QuatroCard[]): number {
  return hand.filter((c) => c.suit === 'black').length;
}

function outcome(my: QuatroCard[], opp: QuatroCard[]): number {
  const mq = quatroIsQuatro(my);
  const oq = quatroIsQuatro(opp);
  if (mq !== oq) return mq ? 1 : 0;
  const ms = my.reduce((a, c) => a + c.num, 0);
  const os = opp.reduce((a, c) => a + c.num, 0);
  if (ms !== os) return ms > os ? 1 : 0;
  const key = (h: QuatroCard[]) =>
    [...h].sort((x, y) => (y.num - x.num) || (quatroSuitPri(y) - quatroSuitPri(x)));
  const ka = key(my);
  const kb = key(opp);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const ca = ka[i];
    const cb = kb[i];
    if (!ca || !cb) return ca ? 1 : cb ? 0 : 0.5;
    if (ca.num !== cb.num) return ca.num > cb.num ? 1 : 0;
    if (quatroSuitPri(ca) !== quatroSuitPri(cb)) return quatroSuitPri(ca) > quatroSuitPri(cb) ? 1 : 0;
  }
  return 0.5;
}

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
    myHand: b.myHand.map(cloneQuatroCard),
    myOpenIds: new Set(b.myOpenIds),
    oppHand: b.oppHand.map(cloneQuatroCard),
    oppOpenIds: new Set(b.oppOpenIds),
    vpCards: b.vpCards.map((vp) => vp.map(cloneQuatroCard)),
    myUsed: new Set(b.myUsed),
    oppUsed: new Set(b.oppUsed),
  };
}

function dealFromPool(view: EngineView, myHand: QuatroCard[], pool: QuatroCard[]): SampledBoard {
  const rest = shuffleInPlace(pool.map(cloneQuatroCard));
  let i = 0;
  const oppClosed = rest.slice(i, i + view.opp.closedCount);
  i += view.opp.closedCount;
  const vpSource = view.vps.length > 0
    ? view.vps
    : Array.from({ length: QUATRO_VP_COUNT }, (_, index) => ({
      index,
      receivedOpen: [] as QuatroCard[],
      hiddenCount: 3,
      usedByMe: false,
      usedByOpp: false,
    }));
  const vpCards: QuatroCard[][] = vpSource.map((vp) => {
    const hidden = rest.slice(i, i + vp.hiddenCount);
    i += vp.hiddenCount;
    return [...vp.receivedOpen.map(cloneQuatroCard), ...hidden];
  });
  return {
    myHand: myHand.map(cloneQuatroCard),
    myOpenIds: new Set(view.my.openIds),
    oppHand: [...view.opp.openCards.map(cloneQuatroCard), ...oppClosed],
    oppOpenIds: new Set(view.opp.openCards.map((c) => c.id)),
    vpCards,
    myUsed: new Set(view.my.usedVps),
    oppUsed: new Set(view.vps.filter((v) => v.usedByOpp).map((v) => v.index)),
  };
}

function sampleKeepWorld(view: EngineView): SampledBoard {
  return dealFromPool(view, view.my.hand, unknownPool(view));
}

function sampleMulliganWorld(view: EngineView): SampledBoard | null {
  const fresh = shuffleInPlace(unknownPool(view));
  if (fresh.length < QUATRO_HAND_SIZE) return null;
  const drawn = fresh.slice(0, QUATRO_HAND_SIZE);
  const rest = [...fresh.slice(QUATRO_HAND_SIZE), ...view.my.hand.map(cloneQuatroCard)];
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
  const recv = quatroVpPickFrom(vp, hand.filter((c) => open.has(c.id)));
  if (!recv) return false;
  setHand(board, who, [...hand.filter((c) => c.id !== give.id), cloneQuatroCard(recv)]);
  board.vpCards[vpIdx] = [...vp.filter((c) => c.id !== recv.id), cloneQuatroCard(give)];
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
    const s = quatroOpenScore(c, opened);
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

function worstClosed(hand: QuatroCard[], openIds: Set<string>): QuatroCard | null {
  const closed = hand.filter((c) => !openIds.has(c.id));
  if (closed.length === 0) return null;
  let best: { card: QuatroCard; score: number } | null = null;
  for (const c of closed) {
    const rest = hand.filter((x) => x.id !== c.id);
    const s = (quatroIsQuatro(rest) ? 800 : quatroDistinctSize(rest) * 35)
      + rest.reduce((a, x) => a + x.num, 0) * 0.4
      - c.num;
    if (!best || s > best.score) best = { card: c, score: s };
  }
  return best?.card ?? null;
}

function dumpAll(board: SampledBoard, who: Side): void {
  const used = usedOf(board, who);
  let guard = 0;
  while (used.size < QUATRO_VP_COUNT && guard < QUATRO_VP_COUNT) {
    guard += 1;
    const give = worstClosed(handOf(board, who), openOf(board, who));
    const vpIdx = firstUnusedVp(used);
    if (!give || vpIdx == null) break;
    if (!applyExWho(board, who, vpIdx, give.id)) used.add(vpIdx);
  }
}

function maybeEarlyDump(board: SampledBoard, who: Side): void {
  const hand = handOf(board, who);
  if (quatroIsQuatro(hand)) return;
  if (blackCount(hand) < 2 && quatroDistinctSize(hand) >= 3) return;
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

function playout(board: SampledBoard, view: EngineView, skipMyEarlyThisRound: boolean): number {
  if (view.phase === 'mulligan' || view.phase === 'deal') {
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

function evalActionOnBoard(board: SampledBoard, view: EngineView, action: QuatroAction): number {
  const b = cloneBoard(board);
  if (!applyAction(b, action)) return 0;
  const skipMyEarly = action.type === 'stop' || action.type === 'exchange';
  return playout(b, view, skipMyEarly);
}

function scoreMixWorst(values: number[]): number {
  if (values.length === 0) return 0.5;
  let mix = 0;
  let worst = 1;
  for (const v of values) {
    mix += v;
    if (v < worst) worst = v;
  }
  mix /= values.length;
  if (worst >= 0.999) return 1;
  return MIX * mix + (1 - MIX) * worst;
}

function worldCount(timeLimitMs: number): number {
  if (timeLimitMs >= 20_000) return 80;
  if (timeLimitMs >= 5_000) return 24;
  return 10;
}

function sampleWorlds(view: EngineView, n: number, redraw: boolean): SampledBoard[] {
  const out: SampledBoard[] = [];
  for (let i = 0; i < n; i++) {
    const w = redraw ? sampleMulliganWorld(view) : sampleKeepWorld(view);
    if (w) out.push(w);
  }
  if (out.length === 0) out.push(sampleKeepWorld(view));
  return out;
}

export function quatroAdvisorCandidates(snap: QuatroAdvisorSnapshot): QuatroAction[] {
  if (snap.phase === 'mulligan') {
    const out: QuatroAction[] = [{ type: 'mulligan', use: false }];
    if (snap.my.mulligansUsed < 2) out.push({ type: 'mulligan', use: true });
    return out;
  }
  if (snap.phase === 'open') {
    return myClosed(viewFromSnap(snap)).map((c) => ({ type: 'open' as const, cardId: c.id }));
  }
  if (snap.phase === 'exchange') {
    const view = viewFromSnap(snap);
    const must = snap.round >= 3 && snap.my.usedVps.length < QUATRO_VP_COUNT;
    const out: QuatroAction[] = [];
    if (!must) out.push({ type: 'stop' });
    const closed = myClosed(view);
    for (const vp of view.vps) {
      if (vp.usedByMe) continue;
      for (const give of closed) {
        out.push({ type: 'exchange', vpIndex: vp.index, giveCardId: give.id });
      }
    }
    if (out.length === 0) return [{ type: 'stop' }];
    return out;
  }
  return [];
}

function pickBest(
  cands: QuatroAction[],
  scoreOf: (a: QuatroAction) => number[],
): QuatroAdvisorPick {
  let best = cands[0] ?? { type: 'stop' as const };
  let bestEv = -Infinity;
  for (const c of cands) {
    const ev = scoreMixWorst(scoreOf(c));
    if (ev > bestEv + 1e-6) {
      bestEv = ev;
      best = c;
    }
  }
  return { action: best, winRate: Math.min(1, Math.max(0, bestEv === -Infinity ? 0.5 : bestEv)) };
}

function pickOpen(snap: QuatroAdvisorSnapshot, view: EngineView, n: number): QuatroAdvisorPick {
  const closed = myClosed(view);
  const opened = myOpenCards(view);
  if (snap.round === 1) {
    const keepers = closed.filter((c) => c.num >= 5);
    const pool = keepers.length > 0 ? keepers : closed;
    const card = quatroPickOpenCard(pool, opened) ?? closed[0];
    if (!card) return { action: { type: 'stop' }, winRate: 0.5 };
    const worlds = sampleWorlds(view, n, false);
    const vals = worlds.map((w) => evalActionOnBoard(w, view, { type: 'open', cardId: card.id }));
    return { action: { type: 'open', cardId: card.id }, winRate: scoreMixWorst(vals) };
  }
  const cands: QuatroAction[] = closed.map((c) => ({ type: 'open', cardId: c.id }));
  const worlds = sampleWorlds(view, n, false);
  return pickBest(cands, (a) => worlds.map((w) => evalActionOnBoard(w, view, a)));
}

function pickExchange(snap: QuatroAdvisorSnapshot, view: EngineView, n: number): QuatroAdvisorPick {
  const cands = quatroAdvisorCandidates(snap).filter((a) => a.type === 'stop' || a.type === 'exchange');
  if (quatroShouldStopEarly(snap.round, snap.my.hand)) {
    const stop = cands.find((a) => a.type === 'stop');
    if (stop) {
      const worlds = sampleWorlds(view, n, false);
      const vals = worlds.map((w) => evalActionOnBoard(w, view, stop));
      return { action: stop, winRate: scoreMixWorst(vals) };
    }
  }
  const closed = myClosed(view);
  const junk = [...closed].sort((a, b) => {
    const sa = worstClosed([a, ...closed.filter((x) => x.id !== a.id)], new Set(view.my.openIds));
    void sa;
    return a.num - b.num || quatroSuitPri(a) - quatroSuitPri(b);
  });
  const givePool = junk.slice(0, Math.min(2, junk.length));
  const filtered = cands.filter((a) => {
    if (a.type !== 'exchange') return true;
    return givePool.some((c) => c.id === a.giveCardId);
  });
  const use = filtered.length > 0 ? filtered : cands;
  const worlds = sampleWorlds(view, n, false);
  return pickBest(use, (a) => worlds.map((w) => evalActionOnBoard(w, view, a)));
}

export function pickQuatroAdvisor(
  iAmFirstStart: boolean,
  history: QuatroAdvisorPly[],
  _timeLimitMs: number,
): QuatroAdvisorPick {
  const snap = quatroAdvisorSnapshot(iAmFirstStart, history);
  const ask = quatroAdvisorAsk(iAmFirstStart, history);
  const n = worldCount(_timeLimitMs);
  const view = viewFromSnap(snap);

  if (snap.result.kind !== 'playing') {
    return { action: { type: 'stop' }, winRate: snap.result.kind === 'win' ? 1 : 0 };
  }

  if (ask === 'mulligan') {
    const use = quatroShouldMulligan(snap.my.hand, snap.my.mulligansUsed);
    const keep = sampleWorlds(view, n, false);
    const redraw = use ? sampleWorlds(view, n, true) : keep;
    const action: QuatroAction = { type: 'mulligan', use };
    const worlds = use ? redraw : keep;
    const vals = worlds.map((w) => evalActionOnBoard(w, view, action));
    console.info(`[QUATRO advisor] mulligan use=${use} ev=${scoreMixWorst(vals).toFixed(3)}`);
    return { action, winRate: scoreMixWorst(vals) };
  }

  if (ask === 'open') {
    const pick = pickOpen(snap, view, n);
    console.info(`[QUATRO advisor] r=${snap.round} open=${pick.action.type === 'open' ? pick.action.cardId : '?'} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  if (ask === 'exchange') {
    const pick = pickExchange(snap, view, n);
    console.info(`[QUATRO advisor] r=${snap.round} ${pick.action.type} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  return { action: { type: 'stop' }, winRate: 0.5 };
}

export function parseAdvisorHistory(raw: unknown, iAmFirstStart = true): QuatroAdvisorPly[] | null {
  if (!Array.isArray(raw) || raw.length > 80) return null;
  const out: QuatroAdvisorPly[] = [];
  for (const row of raw) {
    const ply = quatroParseAdvisorPly(row);
    if (!ply) return null;
    if (!quatroAdvisorPlyLegal(iAmFirstStart, out, ply)) return null;
    out.push(ply);
  }
  return out;
}

export interface QuatroSuperWorkerRequest {
  iAmFirst: boolean;
  history: QuatroAdvisorPly[];
  timeLimitMs?: number;
}

export interface QuatroSuperWorkerResponse extends QuatroAdvisorPick {}
