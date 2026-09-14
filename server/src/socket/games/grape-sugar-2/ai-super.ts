/* 포도설탕2 슈퍼 자문: 잔여는 공개. 이번 pending 금지. 한 라운드 EV 금지. 남은 판 재귀. COM ai.ts 안 씀. */
import type {
  GS2CardId,
  Gs2AdvisorRound,
  Gs2AdvisorSnapshot,
} from '@shared/types/grape-sugar-2.js';
import {
  CARD_IDS,
  GS2_CHEAP_CARDS,
  GS2_EXTENDED_ROUNDS,
  GS2_HR_PENALTY,
  gs2DiceEffective,
  gs2IsDiceFace,
  gs2IsFatalChicken,
  gs2IsInstantExecute,
  gs2SugarCandidates,
} from '@shared/types/grape-sugar-2.js';
import { gs2AdvisorSnapshot } from '@shared/types/grape-sugar-2-advisor.js';

export const GS2_SUPER_THINK_MS = 90_000;
const MIX = 0.5;
const CLOCK_MASK = 255;

const BIT: Record<GS2CardId, number> = {
  minus3: 1 << 0,
  plus5: 1 << 1,
  copy: 1 << 2,
  grapeBless: 1 << 3,
  earthCrush: 1 << 4,
  dice: 1 << 5,
  breath: 1 << 6,
  highRisk: 1 << 7,
  spaceCrush: 1 << 8,
  noAction: 1 << 9,
};

const CARD_COST: Record<GS2CardId, number> = {
  noAction: 0,
  spaceCrush: 1,
  breath: 2,
  minus3: 3,
  plus5: 4,
  earthCrush: 5,
  grapeBless: 6,
  dice: 7,
  copy: 8,
  highRisk: 9,
};

export type Gs2AdvisorPick = { card: GS2CardId; sugar: number; winRate: number };

type Cand = { card: GS2CardId; sugar: number; bit: number };

interface St {
  myBits: number;
  oppBits: number;
  mySugar: number;
  oppSugar: number;
  myScore: number;
  oppScore: number;
  left: number;
  breath: boolean;
}

let _deadline = 0;
let _timedOut = false;
let _allowTimeout = true;
let _nodes = 0;
const _memo = new Map<string, number>();

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

function has(bits: number, card: GS2CardId): boolean {
  return (bits & BIT[card]) !== 0;
}

function pop(bits: number): number {
  let n = 0;
  let x = bits;
  while (x) {
    n += x & 1;
    x >>>= 1;
  }
  return n;
}

function bitsOf(hand: GS2CardId[]): number {
  let b = 0;
  for (const c of hand) b |= BIT[c];
  return b;
}

function fromSnap(snap: Gs2AdvisorSnapshot): St {
  return {
    myBits: bitsOf(snap.my.hand),
    oppBits: bitsOf(snap.opp.hand),
    mySugar: snap.my.sugarRemain,
    oppSugar: snap.opp.sugarRemain,
    myScore: snap.my.score,
    oppScore: snap.opp.score,
    left: Math.max(0, snap.maxRound - snap.round + 1),
    breath: snap.breathAvailable,
  };
}

function scoreCmp(my: number, opp: number): number {
  if (my > opp) return 1;
  if (my < opp) return 0;
  return 0.5;
}

function maxCatch(st: St, who: 'me' | 'opp'): number {
  const theirs = who === 'opp' ? st.oppBits : st.myBits;
  const mine = who === 'opp' ? st.myBits : st.oppBits;
  let rounds = st.left;
  if (st.breath && has(theirs, 'breath')) rounds += 1;
  let pts = rounds;
  if (has(theirs, 'grapeBless')) pts += 1;
  if (has(mine, 'dice')) pts += 2;
  return pts;
}

function lockValue(st: St): number | null {
  if (st.left <= 0) return scoreCmp(st.myScore, st.oppScore);
  if (st.myScore > st.oppScore + maxCatch(st, 'opp')) return 1;
  if (st.oppScore > st.myScore + maxCatch(st, 'me')) return 0;
  return null;
}

function cardPower(bits: number, sugar: number): number {
  let p = 0;
  if (has(bits, 'copy') && sugar >= 4) p += 0.45;
  if (has(bits, 'highRisk') && sugar >= 4) p += 0.4;
  if (has(bits, 'grapeBless')) p += 0.22;
  if (has(bits, 'plus5')) p += 0.12;
  if (has(bits, 'earthCrush')) p += 0.1;
  if (has(bits, 'noAction') && has(bits, 'spaceCrush') === false) p += 0.05;
  return p;
}

function outlook(st: St): number {
  const locked = lockValue(st);
  if (locked !== null) return locked;
  const fuel = (st.mySugar - st.oppSugar) / Math.max(6, st.left * 4);
  const cards = cardPower(st.myBits, st.mySugar) - cardPower(st.oppBits, st.oppSugar);
  const x = (st.myScore - st.oppScore) * 0.55 + fuel * 0.9 + cards;
  if (x > 8) return 1;
  if (x < -8) return 0;
  return 1 / (1 + Math.exp(-x));
}

function legalCards(bits: number, oppBits: number, forMe: boolean): GS2CardId[] {
  const out: GS2CardId[] = [];
  const hand = cardsFromBits(bits);
  const oppHand = cardsFromBits(oppBits);
  for (const card of hand) {
    if (forMe) {
      if (gs2IsFatalChicken(hand, oppHand, card)) continue;
    } else if (card === 'spaceCrush' && has(oppBits, 'noAction') && hand.length > 1) {
      continue;
    }
    out.push(card);
  }
  if (out.length === 0) return hand.length > 0 ? hand : ['noAction'];
  return out;
}

function cardsFromBits(bits: number): GS2CardId[] {
  const out: GS2CardId[] = [];
  for (const card of CARD_IDS) {
    if (has(bits, card)) out.push(card);
  }
  return out;
}

function sugarList(
  card: GS2CardId,
  remain: number,
  left: number,
  scoreDiff: number,
  tight: boolean,
): number[] {
  const last = left <= 1;
  const full = gs2SugarCandidates(card, remain, Math.max(1, left), last, scoreDiff);
  if (!tight || full.length <= 3) return full;
  const keep = new Set<number>();
  keep.add(full[0]!);
  keep.add(full[Math.floor(full.length / 2)]!);
  keep.add(full[full.length - 1]!);
  return [...keep].sort((a, b) => a - b);
}

function breathWasted(st: St, card: GS2CardId): boolean {
  if (card !== 'breath') return false;
  if (pop(st.myBits) <= 1) return false;
  if (!st.breath) return true;
  return st.myScore > st.oppScore && st.left <= 2;
}

function myMoves(st: St, tight: boolean): Cand[] {
  const out: Cand[] = [];
  for (const card of legalCards(st.myBits, st.oppBits, true)) {
    if (breathWasted(st, card)) continue;
    for (const sugar of sugarList(card, st.mySugar, st.left, st.myScore - st.oppScore, tight)) {
      out.push({ card, sugar, bit: BIT[card] });
    }
  }
  if (out.length === 0) {
    const card = cardsFromBits(st.myBits)[0] ?? 'noAction';
    out.push({
      card,
      sugar: Math.min(st.mySugar, GS2_CHEAP_CARDS.has(card) ? 1 : st.mySugar),
      bit: BIT[card],
    });
  }
  return out;
}

function oppMoves(st: St, tight: boolean): Cand[] {
  const out: Cand[] = [];
  const scoreDiff = st.oppScore - st.myScore;
  for (const card of legalCards(st.oppBits, st.myBits, false)) {
    for (const sugar of sugarList(card, st.oppSugar, st.left, scoreDiff, tight)) {
      out.push({ card, sugar, bit: BIT[card] });
    }
  }
  if (out.length === 0) {
    const card = cardsFromBits(st.oppBits)[0] ?? 'noAction';
    out.push({ card, sugar: Math.min(st.oppSugar, 1), bit: BIT[card] });
  }
  return out;
}

interface Settled {
  terminal: number | null;
  next: St;
}

function applyHr(mySugar: number, oppSugar: number, myHr: number, oppHr: number): { my: number; opp: number } {
  if (myHr > 0) {
    const t = Math.min(myHr, mySugar);
    mySugar -= t;
    oppSugar += t;
  }
  if (oppHr > 0) {
    const t = Math.min(oppHr, oppSugar);
    oppSugar -= t;
    mySugar += t;
  }
  return { my: mySugar, opp: oppSugar };
}

function settle(
  st: St,
  mine: Cand,
  opp: Cand,
  myDice: number,
  oppDice: number,
): Settled {
  const myCard = mine.card;
  const oppCard = opp.card;

  if (myCard === 'noAction' && oppCard === 'spaceCrush') {
    return { terminal: 1, next: st };
  }
  if (oppCard === 'noAction' && myCard === 'spaceCrush') {
    return { terminal: 0, next: st };
  }

  const isFinal = st.left <= 1;
  let myRound = mine.sugar;
  let oppRound = opp.sugar;
  let myEff = true;
  let oppEff = true;

  if (myCard === 'spaceCrush' && oppCard === 'spaceCrush') {
    myRound = 0;
    oppRound = 0;
    myEff = false;
    oppEff = false;
  } else {
    if (myCard === 'spaceCrush') {
      oppEff = false;
      oppRound = 0;
    }
    if (oppCard === 'spaceCrush') {
      myEff = false;
      myRound = 0;
    }
  }

  let blessMe = false;
  let blessOpp = false;
  let diceBonusTo: 'me' | 'opp' | null = null;
  let breathExtended = false;
  let breathUsed = !st.breath;

  const applySelf = (who: 'me' | 'opp') => {
    const card = who === 'me' ? myCard : oppCard;
    const eff = who === 'me' ? myEff : oppEff;
    if (!eff) return;
    if (card === 'plus5') {
      if (who === 'me') myRound += 5;
      else oppRound += 5;
    } else if (card === 'copy') {
      if (who === 'me') myRound *= 2;
      else oppRound *= 2;
    } else if (card === 'highRisk') {
      if (who === 'me') myRound *= 3;
      else oppRound *= 3;
    } else if (card === 'grapeBless') {
      if (who === 'me') blessMe = true;
      else blessOpp = true;
    } else if (card === 'breath') {
      if (!breathUsed) {
        breathUsed = true;
        breathExtended = true;
      }
    }
  };
  applySelf('me');
  applySelf('opp');

  const applyDice = (who: 'me' | 'opp', face: number) => {
    const card = who === 'me' ? myCard : oppCard;
    const eff = who === 'me' ? myEff : oppEff;
    if (!eff || card !== 'dice') return;
    if (face <= 2) {
      if (who === 'me') oppRound -= 3;
      else myRound -= 3;
    } else if (face <= 4) {
      if (who === 'me') myRound -= 5;
      else oppRound -= 5;
    } else {
      diceBonusTo = who;
    }
  };
  applyDice('me', myDice);
  applyDice('opp', oppDice);

  if (myEff && myCard === 'minus3') oppRound -= 3;
  if (oppEff && oppCard === 'minus3') myRound -= 3;
  if (myEff && myCard === 'earthCrush') oppRound = Math.ceil(oppRound / 2);
  if (oppEff && oppCard === 'earthCrush') myRound = Math.ceil(myRound / 2);

  myRound = Math.ceil(Math.max(0, myRound));
  oppRound = Math.ceil(Math.max(0, oppRound));

  let myDelta = 0;
  let oppDelta = 0;
  let winner: 'me' | 'opp' | 'tie' = 'tie';
  if (myRound > oppRound) winner = 'me';
  else if (oppRound > myRound) winner = 'opp';
  if (winner === 'me') myDelta += 1;
  else if (winner === 'opp') oppDelta += 1;

  if (blessMe) {
    if (winner === 'me') myDelta += 1;
    else if (winner === 'opp') myDelta -= 1;
  }
  if (blessOpp) {
    if (winner === 'opp') oppDelta += 1;
    else if (winner === 'me') oppDelta -= 1;
  }

  if (diceBonusTo === 'me' && winner !== 'me') {
    oppDelta += winner === 'tie' ? 2 : 1;
  }
  if (diceBonusTo === 'opp' && winner !== 'opp') {
    myDelta += winner === 'tie' ? 2 : 1;
  }

  let myHr = 0;
  let oppHr = 0;
  if (!isFinal) {
    if (myEff && myCard === 'highRisk' && winner === 'opp') myHr = GS2_HR_PENALTY;
    if (oppEff && oppCard === 'highRisk' && winner === 'me') oppHr = GS2_HR_PENALTY;
  }

  let mySugar = Math.max(0, st.mySugar - mine.sugar);
  let oppSugar = Math.max(0, st.oppSugar - opp.sugar);
  const hr = applyHr(mySugar, oppSugar, myHr, oppHr);
  mySugar = hr.my;
  oppSugar = hr.opp;

  const next: St = {
    myBits: st.myBits & ~mine.bit,
    oppBits: st.oppBits & ~opp.bit,
    mySugar,
    oppSugar,
    myScore: st.myScore + myDelta,
    oppScore: st.oppScore + oppDelta,
    left: breathExtended ? st.left : st.left - 1,
    breath: breathExtended ? false : st.breath,
  };

  if (next.left <= 0) {
    return { terminal: scoreCmp(next.myScore, next.oppScore), next };
  }
  return { terminal: null, next };
}

function diceFaces(myCard: GS2CardId, oppCard: GS2CardId, who: 'me' | 'opp'): number[] {
  if (myCard === 'spaceCrush' && oppCard === 'spaceCrush') return [4];
  if (who === 'me' && myCard === 'dice' && oppCard !== 'spaceCrush') return [1, 2, 3, 4, 5, 6];
  if (who === 'opp' && oppCard === 'dice' && myCard !== 'spaceCrush') return [1, 2, 3, 4, 5, 6];
  return [4];
}

function pairValue(st: St, mine: Cand, opp: Cand, horizon: number): number {
  tick();
  if (_timedOut) return outlook(st);
  const myRolls = diceFaces(mine.card, opp.card, 'me');
  const oppRolls = diceFaces(mine.card, opp.card, 'opp');
  let sum = 0;
  let n = 0;
  for (const a of myRolls) {
    for (const b of oppRolls) {
      if (_timedOut) break;
      const done = settle(st, mine, opp, a, b);
      if (done.terminal !== null) {
        sum += done.terminal;
      } else if (horizon <= 1) {
        sum += outlook(done.next);
      } else {
        sum += valueState(done.next, horizon - 1);
      }
      n += 1;
    }
  }
  return n > 0 ? sum / n : outlook(st);
}

function scoreCand(st: St, mine: Cand, oppCands: Cand[], horizon: number): number {
  let mixAcc = 0;
  let worst = 1;
  let n = 0;
  for (const opp of oppCands) {
    if (_timedOut) break;
    const v = pairValue(st, mine, opp, horizon);
    mixAcc += v;
    n += 1;
    if (v < worst) worst = v;
  }
  const mix = n > 0 ? mixAcc / n : outlook(st);
  if (worst >= 0.999) return 1;
  return MIX * mix + (1 - MIX) * worst;
}

function keyOf(st: St, horizon: number): string {
  return `${st.myBits}|${st.oppBits}|${st.mySugar},${st.oppSugar}|${st.myScore},${st.oppScore}|${st.left}${st.breath ? 1 : 0}|${horizon}`;
}

function valueState(st: St, horizon: number): number {
  tick();
  if (_timedOut) return outlook(st);
  const locked = lockValue(st);
  if (locked !== null) return locked;
  if (st.left <= 0) return scoreCmp(st.myScore, st.oppScore);
  if (horizon <= 0) return outlook(st);

  const k = keyOf(st, horizon);
  const hit = _memo.get(k);
  if (hit !== undefined) return hit;

  const tight = st.left > 2 || pop(st.myBits) + pop(st.oppBits) > 6;
  const mine = myMoves(st, tight);
  if (mine.length === 0) return outlook(st);
  const opp = oppMoves(st, tight);
  let best = -1;
  for (const c of mine) {
    if (_timedOut) break;
    const ev = scoreCand(st, c, opp, horizon);
    if (ev > best) best = ev;
  }
  if (best < 0) best = outlook(st);
  if (!_timedOut) _memo.set(k, best);
  return best;
}

function spendCost(c: Cand, lastRound: boolean, lockedWin: boolean): number {
  if (lockedWin) return CARD_COST[c.card] * 1000 + c.sugar;
  const cardPart = CARD_COST[c.card] * 1000;
  if (lastRound && (c.card === 'copy' || c.card === 'highRisk' || c.card === 'dice')) {
    return cardPart - c.sugar;
  }
  return cardPart + c.sugar;
}

function cheapPick(st: St): Gs2AdvisorPick {
  const cands = myMoves(st, false);
  let best = cands[0]!;
  let bestCost = Infinity;
  for (const c of cands) {
    const cost = spendCost(c, st.left <= 1, true);
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  return { card: best.card, sugar: best.sugar, winRate: 1 };
}

function pickAt(
  st: St,
  snap: Gs2AdvisorSnapshot,
  horizon: number,
): Gs2AdvisorPick {
  const locked = lockValue(st);
  if (locked === 1) return cheapPick(st);
  if (gs2IsInstantExecute(snap.my.hand, snap.opp.hand)) {
    return {
      card: 'noAction',
      sugar: Math.min(st.mySugar, 1),
      winRate: 1,
    };
  }

  const tight = horizon <= 1 && st.left > 3;
  const mine = myMoves(st, tight);
  const opp = oppMoves(st, tight || st.left > 3);
  const fallback: Gs2AdvisorPick = {
    card: mine[0]?.card ?? 'noAction',
    sugar: mine[0]?.sugar ?? 0,
    winRate: locked === 0 ? 0 : outlook(st),
  };
  if (mine.length === 1) {
    return {
      card: mine[0]!.card,
      sugar: mine[0]!.sugar,
      winRate: scoreCand(st, mine[0]!, opp, horizon),
    };
  }

  let best = fallback;
  let bestEv = -Infinity;
  let bestCost = Infinity;
  const last = st.left <= 1;
  for (const c of mine) {
    if (_timedOut && bestEv > -Infinity) break;
    const ev = scoreCand(st, c, opp, horizon);
    const cost = spendCost(c, last, false);
    if (ev > bestEv + 1e-6 || (Math.abs(ev - bestEv) <= 1e-6 && cost < bestCost)) {
      bestEv = ev;
      bestCost = cost;
      best = { card: c.card, sugar: c.sugar, winRate: Math.min(1, Math.max(0, ev)) };
    }
  }
  return best;
}

export function pickGrapeSugar2AdvisorSnap(
  snap: Gs2AdvisorSnapshot,
  timeLimitMs: number,
): Gs2AdvisorPick {
  _deadline = Date.now() + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;
  _memo.clear();

  if (snap.result.kind !== 'playing') {
    const wr = snap.result.kind === 'win' ? 1 : snap.result.kind === 'loss' ? 0 : 0.5;
    return { card: snap.my.hand[0] ?? 'noAction', sugar: 0, winRate: wr };
  }

  const st = fromSnap(snap);
  if (gs2IsInstantExecute(snap.my.hand, snap.opp.hand)) {
    return { card: 'noAction', sugar: Math.min(st.mySugar, 1), winRate: 1 };
  }
  if (lockValue(st) === 1) return cheapPick(st);

  const remaining = Math.max(1, st.left);
  const cards = pop(st.myBits) + pop(st.oppBits);
  const maxH = remaining <= 2 || cards <= 5 ? remaining : 1;
  const startH = 1;
  let chosen = pickAt(st, snap, startH);
  let completed = startH;

  for (let h = startH + 1; h <= maxH; h++) {
    if (Date.now() >= _deadline) break;
    _timedOut = false;
    _allowTimeout = true;
    _memo.clear();
    const pick = pickAt(st, snap, h);
    if (!_timedOut) {
      chosen = pick;
      completed = h;
    }
  }

  console.info(
    `[GS2 advisor] round=${snap.round} pick=${chosen.card}:${chosen.sugar} ev=${chosen.winRate.toFixed(3)} h=${completed} nodes=${_nodes}`,
  );
  return chosen;
}

export function pickGrapeSugar2Advisor(
  history: Gs2AdvisorRound[],
  timeLimitMs: number,
): Gs2AdvisorPick {
  return pickGrapeSugar2AdvisorSnap(gs2AdvisorSnapshot(history), timeLimitMs);
}

function isCard(v: unknown): v is GS2CardId {
  return typeof v === 'string' && (CARD_IDS as readonly string[]).includes(v);
}

function isIntSugar(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 35;
}

export function parseAdvisorHistory(raw: unknown): Gs2AdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > GS2_EXTENDED_ROUNDS) return null;
  const out: Gs2AdvisorRound[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if ('pendingCard' in rec || 'pendingSugar' in rec) return null;
    if (!isCard(rec.myCard) || !isCard(rec.oppCard)) return null;
    if (!isIntSugar(rec.mySugar) || !isIntSugar(rec.oppSugar)) return null;

    const snap = gs2AdvisorSnapshot(out);
    if (snap.result.kind !== 'playing') return null;
    if (!snap.my.hand.includes(rec.myCard)) return null;
    if (!snap.opp.hand.includes(rec.oppCard)) return null;
    if (rec.mySugar > snap.my.sugarRemain) return null;
    if (rec.oppSugar > snap.opp.sugarRemain) return null;

    const next: Gs2AdvisorRound = {
      myCard: rec.myCard,
      mySugar: rec.mySugar,
      oppCard: rec.oppCard,
      oppSugar: rec.oppSugar,
    };
    if (gs2DiceEffective(rec.myCard, rec.oppCard, 'me')) {
      if (!gs2IsDiceFace(rec.myDice)) return null;
      next.myDice = rec.myDice;
    }
    if (gs2DiceEffective(rec.myCard, rec.oppCard, 'opp')) {
      if (!gs2IsDiceFace(rec.oppDice)) return null;
      next.oppDice = rec.oppDice;
    }
    out.push(next);
  }
  return out;
}

export interface Gs2SuperWorkerRequest {
  history: Gs2AdvisorRound[];
  timeLimitMs?: number;
}

export interface Gs2SuperWorkerResponse extends Gs2AdvisorPick {}
