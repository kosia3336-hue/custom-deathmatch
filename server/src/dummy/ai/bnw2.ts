import type { DummyAiTier } from '@shared/dummy.js';
import type {
  BNW2Action,
  BNW2Color,
  BNW2Phase,
} from '@shared/types/bnw2.js';
import {
  BNW2_INITIAL_POINTS,
  BNW2_MAX_SCORE,
  calcBNW2Color,
  calcBNW2Stage,
} from '@shared/types/bnw2.js';
import { runPsychologySearch } from '../psychologySearch.js';

/** 기록에서 숫자(points)를 뺀 공개 로그만. */
export interface Bnw2DummyRoundRecord {
  round: number;
  firstPlayerId: string;
  winnerId: string | null;
  players: Record<
    string,
    {
      color: BNW2Color;
      scoreChange: number;
      scoreBefore: number;
      scoreAfter: number;
      stageBefore: number;
      stageAfter: number;
    }
  >;
}

export interface Bnw2DummyView {
  gameOver: boolean;
  phase: BNW2Phase;
  round: number;
  myId: string;
  oppId: string;
  firstPlayerId: string;
  my: {
    score: number;
    remainingPoints: number;
    stage: number;
    submitted: boolean;
  };
  opp: {
    score: number;
    stage: number;
    submitted: boolean;
  };
  prevFirstStage: number | null;
  firstPlayerColor: BNW2Color | null;
  roundHistory: Bnw2DummyRoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

/** 선 제시 사후: 숨은 정수 하나가 아니라 (제시, 제시 전 잔여, 확률). */
export interface FirstBidAtom {
  bid: number;
  remBefore: number;
  p: number;
}

const MAX_REM = BNW2_INITIAL_POINTS;
const CHEAP_PRIOR = 0.66;

function tierKnobs(tier: DummyAiTier): {
  uniformMix: number;
  styleSigma: number;
  softmaxTemp: number;
  remSupport: number;
} {
  if (tier === '하') {
    return { uniformMix: 0.38, styleSigma: 0.18, softmaxTemp: 0.06, remSupport: 4 };
  }
  if (tier === '중') {
    return { uniformMix: 0.07, styleSigma: 0.05, softmaxTemp: 0.018, remSupport: 8 };
  }
  return { uniformMix: 0.025, styleSigma: 0.02, softmaxTemp: 0.01, remSupport: 12 };
}

export function stageRange(stage: number): { lo: number; hi: number } {
  if (stage <= 0) return { lo: 0, hi: 0 };
  const s = Math.min(10, stage);
  return { lo: (s - 1) * 20 + 1, hi: s * 20 };
}

/**
 * 표시등 전후 + 색으로 제시 구간. 숨은 정수가 아니라 화면이 주는 범위.
 */
export function inferSpendRange(
  stageBefore: number,
  stageAfter: number,
  color: BNW2Color,
): { lo: number; hi: number } {
  const before = stageRange(stageBefore);
  const after = stageRange(stageAfter);
  let lo = Math.max(0, before.lo - after.hi);
  let hi = Math.max(lo, before.hi - after.lo);

  if (color === 'black') hi = Math.min(hi, 9);
  else lo = Math.max(lo, 10);

  if (lo > hi) {
    return color === 'black' ? { lo: 0, hi: 9 } : { lo: 10, hi: Math.max(10, hi) };
  }
  return { lo, hi };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function emptyBelief(): Float64Array {
  return new Float64Array(MAX_REM + 1);
}

function deltaBelief(rem: number): Float64Array {
  const b = emptyBelief();
  b[clamp(Math.round(rem), 0, MAX_REM)] = 1;
  return b;
}

function normalizeBelief(b: Float64Array): Float64Array {
  let s = 0;
  for (let i = 0; i < b.length; i++) s += b[i]!;
  if (s <= 0) return b;
  const out = emptyBelief();
  for (let i = 0; i < b.length; i++) out[i] = b[i]! / s;
  return out;
}

function clipBeliefToStage(b: Float64Array, stage: number): Float64Array {
  const { lo, hi } = stageRange(stage);
  const out = emptyBelief();
  let s = 0;
  for (let i = lo; i <= hi; i++) {
    out[i] = b[i]!;
    s += b[i]!;
  }
  if (s <= 1e-15) {
    const u = 1 / (hi - lo + 1);
    for (let i = lo; i <= hi; i++) out[i] = u;
    return out;
  }
  return normalizeBelief(out);
}

function meanBelief(b: Float64Array): number {
  let e = 0;
  for (let i = 0; i < b.length; i++) e += i * b[i]!;
  return e;
}

function topMasses(b: Float64Array, k: number): Array<{ rem: number; p: number }> {
  const items: Array<{ rem: number; p: number }> = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i]! > 1e-12) items.push({ rem: i, p: b[i]! });
  }
  items.sort((a, c) => c.p - a.p);
  const top = items.slice(0, Math.max(1, k));
  const s = top.reduce((a, x) => a + x.p, 0);
  if (s <= 0) return [{ rem: MAX_REM, p: 1 }];
  return top.map((x) => ({ rem: x.rem, p: x.p / s }));
}

function styleWeight(spend: number, lo: number, hi: number, cheapness: number): number {
  if (hi <= lo) return 1;
  const pos = (spend - lo) / (hi - lo);
  const lambda = (cheapness - 0.5) * 8;
  return Math.exp(-lambda * pos);
}

/**
 * 공개 이력만으로 상대가 구간 안에서 싼 쪽을 쓰는지.
 * 1에 가까울수록 최소 하락(흑 유지, 접기). 낮을수록 불 2칸·꽉 채움.
 */
export function estimateCheapness(history: Bnw2DummyRoundRecord[], playerId: string): number {
  let c = CHEAP_PRIOR;
  for (const r of history) {
    const pd = r.players[playerId];
    if (!pd) continue;
    const drops = pd.stageBefore - pd.stageAfter;
    if (r.firstPlayerId === playerId) {
      if (drops <= 0 && pd.color === 'black') c += 0.07;
      else if (drops <= 0 && pd.color === 'white') c += 0.02;
      else if (drops === 1) c -= 0.015;
      else c -= 0.11;
    } else {
      if (drops <= 0 && pd.color === 'black' && pd.scoreChange <= 0) c += 0.045;
      else if (drops >= 2) c -= 0.09;
      else if (drops === 1 && pd.scoreChange > 0) c -= 0.02;
    }
  }
  return clamp(c, 0.18, 0.9);
}

function legalSpends(remBefore: number, stageAfter: number, color: BNW2Color): number[] {
  const stageBefore = calcBNW2Stage(remBefore);
  const { lo, hi } = inferSpendRange(stageBefore, stageAfter, color);
  const out: number[] = [];
  const maxS = Math.min(hi, remBefore);
  for (let s = lo; s <= maxS; s++) {
    if (calcBNW2Color(s) !== color) continue;
    if (calcBNW2Stage(remBefore - s) !== stageAfter) continue;
    out.push(s);
  }
  return out;
}

function weightedSpends(
  spends: number[],
  cheapness: number,
  uniformMix: number,
): number[] {
  if (spends.length === 0) return [];
  const lo = spends[0]!;
  const hi = spends[spends.length - 1]!;
  const style = spends.map((s) => styleWeight(s, lo, hi, cheapness));
  let styleSum = 0;
  for (const w of style) styleSum += w;
  const uni = 1 / spends.length;
  const mix = clamp(uniformMix, 0, 1);
  return spends.map((_, i) => {
    const st = styleSum > 0 ? style[i]! / styleSum : uni;
    return (1 - mix) * st + mix * uni;
  });
}

function applySpendObservation(
  belief: Float64Array,
  stageAfter: number,
  color: BNW2Color,
  cheapness: number,
  uniformMix: number,
): Float64Array {
  const next = emptyBelief();
  let mass = 0;
  for (let rem = 0; rem <= MAX_REM; rem++) {
    const pRem = belief[rem]!;
    if (pRem <= 0) continue;
    const spends = legalSpends(rem, stageAfter, color);
    if (spends.length === 0) continue;
    const ws = weightedSpends(spends, cheapness, uniformMix);
    for (let i = 0; i < spends.length; i++) {
      const after = rem - spends[i]!;
      next[after] += pRem * ws[i]!;
      mass += pRem * ws[i]!;
    }
  }
  if (mass <= 1e-15) return clipBeliefToStage(deltaBelief(stageRange(stageAfter).hi), stageAfter);
  return normalizeBelief(next);
}

export function beliefFromHistory(
  history: Bnw2DummyRoundRecord[],
  playerId: string,
  cheapness: number,
  uniformMix = 0.08,
): Float64Array {
  let b = deltaBelief(BNW2_INITIAL_POINTS);
  for (const r of history) {
    const pd = r.players[playerId];
    if (!pd) continue;
    b = applySpendObservation(b, pd.stageAfter, pd.color, cheapness, uniformMix);
  }
  return b;
}

function atomsFromBelief(
  beliefBefore: Float64Array,
  prevStage: number,
  stageAfter: number,
  color: BNW2Color,
  cheapness: number,
  uniformMix: number,
): FirstBidAtom[] {
  const raw: FirstBidAtom[] = [];
  let z = 0;
  for (let rem = 0; rem <= MAX_REM; rem++) {
    const pRem = beliefBefore[rem]!;
    if (pRem <= 0) continue;
    if (calcBNW2Stage(rem) !== prevStage) continue;
    const spends = legalSpends(rem, stageAfter, color);
    if (spends.length === 0) continue;
    const ws = weightedSpends(spends, cheapness, uniformMix);
    for (let i = 0; i < spends.length; i++) {
      const p = pRem * ws[i]!;
      if (p <= 0) continue;
      raw.push({ bid: spends[i]!, remBefore: rem, p });
      z += p;
    }
  }
  if (z <= 1e-15) {
    const range = inferSpendRange(prevStage, stageAfter, color);
    const remMid = Math.round((stageRange(prevStage).lo + stageRange(prevStage).hi) / 2);
    const n = range.hi - range.lo + 1;
    const out: FirstBidAtom[] = [];
    for (let bid = range.lo; bid <= range.hi; bid++) {
      out.push({ bid, remBefore: remMid, p: 1 / n });
    }
    return out;
  }
  return raw.map((a) => ({ ...a, p: a.p / z }));
}

export function firstBidAtoms(
  view: Bnw2DummyView,
  cheapness: number,
  uniformMix: number,
): FirstBidAtom[] {
  if (view.prevFirstStage == null || view.firstPlayerColor == null) return [];
  const before = clipBeliefToStage(
    beliefFromHistory(view.roundHistory, view.oppId, cheapness, uniformMix),
    view.prevFirstStage,
  );
  return atomsFromBelief(
    before,
    view.prevFirstStage,
    view.opp.stage,
    view.firstPlayerColor,
    cheapness,
    uniformMix,
  );
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i;
  return r;
}

function binomAtLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let s = 0;
  for (let x = k; x <= n; x++) {
    s += comb(n, x) * p ** x * (1 - p) ** (n - x);
  }
  return s;
}

function pRace(myNeed: number, oppNeed: number, pRound: number): number {
  if (myNeed <= 0) return 1;
  if (oppNeed <= 0) return 0;
  return binomAtLeast(myNeed, myNeed + oppNeed - 1, pRound);
}

/**
 * 이번 수 이후가 아니라, 지금 점수·연료·선권으로 본 게임 승률.
 * 0 잔여 + 상대 연료 = 상대가 1씩 가져가 10점. 4점 들고 소진은 0.
 */
export function pWinGame(
  myScore: number,
  oppScore: number,
  myRem: number,
  oppRem: number,
  nextIAmFirst: boolean,
): number {
  if (myScore >= BNW2_MAX_SCORE) return 1;
  if (oppScore >= BNW2_MAX_SCORE) return 0;

  const mine = Math.max(0, myRem);
  const theirs = Math.max(0, oppRem);
  const myNeed = BNW2_MAX_SCORE - myScore;
  const oppNeed = BNW2_MAX_SCORE - oppScore;

  if (mine <= 0 && theirs <= 0) {
    if (myScore > oppScore) return 1;
    if (myScore < oppScore) return 0;
    return 0.5;
  }

  if (mine <= 0) {
    const theirFinal = oppScore + Math.min(theirs, oppNeed);
    if (theirFinal >= BNW2_MAX_SCORE) return 0;
    if (myScore > theirFinal) return 1;
    if (myScore < theirFinal) return 0;
    return 0.5;
  }

  if (theirs <= 0) {
    const myFinal = myScore + Math.min(mine, myNeed);
    if (myFinal >= BNW2_MAX_SCORE) return 1;
    if (myFinal > oppScore) return 1;
    if (myFinal < oppScore) return 0;
    return 0.5;
  }

  const myCeil = myScore + mine;
  const oppCeil = oppScore + theirs;
  if (myCeil < BNW2_MAX_SCORE && oppCeil >= BNW2_MAX_SCORE) return 0.02;
  if (oppCeil < BNW2_MAX_SCORE && myCeil >= BNW2_MAX_SCORE) return 0.98;
  if (myCeil < BNW2_MAX_SCORE && oppCeil < BNW2_MAX_SCORE) {
    if (myCeil > oppCeil) return 0.85;
    if (myCeil < oppCeil) return 0.15;
    return 0.5;
  }

  const myFuel = mine / myNeed;
  const oppFuel = theirs / oppNeed;
  let p = myFuel / (myFuel + oppFuel);
  p += nextIAmFirst ? -0.07 : 0.07;
  p = clamp(p, 0.08, 0.92);
  return pRace(myNeed, oppNeed, p);
}

function fairPace(rem: number, score: number): number {
  return rem / Math.max(1, BNW2_MAX_SCORE - score);
}

/**
 * 라운드 뒤 게임 승률 + 점수를 얼마에 샀는지.
 * 싸게 실점하면 게임이 끝나고, 비싸게 사면 연료가 죽는다.
 */
function canFarmToTen(bid: number, score: number, rem: number): boolean {
  if (bid <= 0) return false;
  const need = BNW2_MAX_SCORE - score;
  return Math.floor(rem / bid) >= need;
}

function pAfterRound(
  myBid: number,
  oppBid: number,
  myScore: number,
  oppScore: number,
  myRem: number,
  oppRem: number,
  iAmFirst: boolean,
): number {
  const myR = myRem - myBid;
  const oppR = oppRem - oppBid;
  let myS = myScore;
  let oppS = oppScore;
  let nextFirst = iAmFirst;
  if (myBid > oppBid) {
    myS += 1;
    nextFirst = true;
  } else if (oppBid > myBid) {
    oppS += 1;
    nextFirst = false;
  }

  let p = pWinGame(myS, oppS, myR, oppR, nextFirst);

  const myFair = fairPace(myRem, myScore);
  const oppFair = fairPace(oppRem, oppScore);

  if (oppBid > myBid) {
    if (canFarmToTen(oppBid, oppScore, oppRem)) p -= 0.32;
    else {
      const eff = oppBid / Math.max(1, oppFair);
      if (eff < 0.7) p -= 0.08;
      else if (eff > 1.5) p += 0.05;
    }
  } else if (myBid > oppBid) {
    const eff = myBid / Math.max(1, myFair);
    if (eff > 1.5) p -= 0.09;
    else if (eff < 0.7) p += 0.04;
    const myDrops = calcBNW2Stage(myRem) - calcBNW2Stage(myR);
    if (myDrops >= 2 && BNW2_MAX_SCORE - myScore > 1) p -= 0.1 * (myDrops - 1);
  }

  return clamp(p, 0, 1);
}

/**
 * 후플 후보. 선이 백(≥10)이면 1~9는 무조건 진다 → 0 아니면 10+.
 * 구간 최솟값 미만도 연료만 버린다. 상·중·하 공통.
 */
export function legalSecondBids(
  remaining: number,
  firstColor: BNW2Color,
  range: { lo: number; hi: number },
): number[] {
  if (remaining <= 0) return [0];
  const cap = Math.min(remaining, range.hi + 1);
  const minPositive = firstColor === 'white' ? Math.max(10, range.lo) : 1;
  const out = [0];
  if (minPositive <= cap) {
    for (let i = minPositive; i <= cap; i++) out.push(i);
  }
  return out;
}

function evAgainstAtoms(
  myBid: number,
  atoms: FirstBidAtom[],
  myScore: number,
  oppScore: number,
  myRem: number,
  iAmFirst: boolean,
): number {
  let e = 0;
  for (const a of atoms) {
    e += a.p * pAfterRound(myBid, a.bid, myScore, oppScore, myRem, a.remBefore, iAmFirst);
  }
  return e;
}

function secondCandidates(
  remaining: number,
  atoms: FirstBidAtom[],
  firstColor: BNW2Color,
): number[] {
  if (remaining <= 0) return [0];
  let hi = 0;
  let lo = Infinity;
  for (const a of atoms) {
    if (a.bid > hi) hi = a.bid;
    if (a.bid < lo) lo = a.bid;
  }
  if (!Number.isFinite(lo)) {
    return legalSecondBids(
      remaining,
      firstColor,
      firstColor === 'white' ? { lo: 10, hi: 19 } : { lo: 0, hi: 9 },
    );
  }
  return legalSecondBids(remaining, firstColor, { lo, hi });
}

export function evaluateSecondBids(
  view: Bnw2DummyView,
  cheapness: number,
  uniformMix: number,
): Array<{ bid: number; ev: number }> {
  const atoms = firstBidAtoms(view, cheapness, uniformMix);
  const color = view.firstPlayerColor ?? 'black';
  const cands = secondCandidates(view.my.remainingPoints, atoms, color);
  return cands.map((bid) => ({
    bid,
    ev: evAgainstAtoms(
      bid,
      atoms,
      view.my.score,
      view.opp.score,
      view.my.remainingPoints,
      false,
    ),
  }));
}

function argmaxBid(scored: Array<{ bid: number; ev: number }>): number {
  if (scored.length === 0) return 0;
  let best = scored[0]!;
  for (const s of scored) {
    if (s.ev > best.ev + 1e-12 || (Math.abs(s.ev - best.ev) <= 1e-12 && s.bid < best.bid)) {
      best = s;
    }
  }
  return best.bid;
}

function bestSecondBid(
  atoms: FirstBidAtom[],
  secondRem: number,
  secondScore: number,
  firstScore: number,
  firstColor: BNW2Color,
): number {
  const cands = secondCandidates(secondRem, atoms, firstColor);
  const scored = cands.map((bid) => ({
    bid,
    ev: evAgainstAtoms(bid, atoms, secondScore, firstScore, secondRem, false),
  }));
  return argmaxBid(scored);
}

function publicLeak(bid: number, remainingBefore: number): {
  color: BNW2Color;
  afterStage: number;
  prevStage: number;
} {
  const prevStage = calcBNW2Stage(remainingBefore);
  const afterStage = calcBNW2Stage(remainingBefore - bid);
  return { color: calcBNW2Color(bid), afterStage, prevStage };
}

function firstCandidates(remaining: number, myNeed: number, oppNeed: number): number[] {
  if (remaining <= 0) return [0];
  const urgent = myNeed === 1 || oppNeed === 1;
  const hard = urgent ? remaining : Math.min(remaining, 48);
  const out: number[] = [];
  for (let i = 0; i <= hard; i++) out.push(i);
  return out;
}

function pickFromScores(
  scored: Array<{ bid: number; score: number }>,
  tier: DummyAiTier,
  temp: number,
  remaining: number,
  forceNonZero: boolean,
): number {
  let pool = scored.map((x) => ({ ...x, score: x.score - 0.00035 * x.bid }));
  if (forceNonZero && remaining > 0) {
    const nz = pool.filter((x) => x.bid > 0);
    if (nz.length > 0) pool = nz;
  }
  if (pool.length === 0) return 0;
  pool.sort((a, b) => b.score - a.score || a.bid - b.bid);

  if (tier === '상') {
    if (
      pool.length > 1
      && Math.random() < 0.04
      && pool[0]!.score - pool[1]!.score < 0.02
    ) {
      return pool[1]!.bid;
    }
    return pool[0]!.bid;
  }

  const t = Math.max(0.006, temp);
  const maxS = pool[0]!.score;
  const weights = pool.map((x) => Math.exp((x.score - maxS) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!.bid;
  }
  return pool[pool.length - 1]!.bid;
}

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleCheapness(center: number, sigma: number): number {
  if (sigma <= 0) return center;
  return clamp(center + randn() * sigma, 0.18, 0.9);
}

function mustContest(myNeed: number, oppNeed: number, remaining: number): boolean {
  return remaining > 0 && (myNeed === 1 || oppNeed === 1);
}

/**
 * 공개 뷰만. 구간 난수+1 금지. firstPoints 금지.
 * 후플: 선 제시 사후분포 전체에 대한 기대 게임 승률.
 * 선플: 후가 같은 식으로 반응한다고 보고 게임 승률.
 */
export async function pickBnw2ActionAsync(
  view: Bnw2DummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<BNW2Action | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;

  const remaining = view.my.remainingPoints;
  if (remaining < 0) return null;

  const myNeed = BNW2_MAX_SCORE - view.my.score;
  const oppNeed = BNW2_MAX_SCORE - view.opp.score;
  const forceNonZero = mustContest(myNeed, oppNeed, remaining);
  const knobs = tierKnobs(tier);
  const iAmFirst = view.firstPlayerId === dummyId;
  const oppCheap = estimateCheapness(view.roundHistory, view.oppId);
  const myCheap = estimateCheapness(view.roundHistory, view.myId);

  if (view.phase === 'firstSubmit') {
    if (!iAmFirst || view.my.submitted) return null;
    if (remaining === 0) return { type: 'submitFirst', points: 0 };

    const cands = firstCandidates(remaining, myNeed, oppNeed);
    const acc = new Map<number, { sum: number; n: number }>();
    for (const b of cands) acc.set(b, { sum: 0, n: 0 });

    const oppBelief = clipBeliefToStage(
      beliefFromHistory(view.roundHistory, view.oppId, oppCheap, knobs.uniformMix),
      view.opp.stage,
    );
    const myBeliefPublic = clipBeliefToStage(
      beliefFromHistory(view.roundHistory, view.myId, myCheap, knobs.uniformMix),
      view.my.stage,
    );
    const oppSupport = topMasses(oppBelief, knobs.remSupport);

    await runPsychologySearch(budgetMs, () => {
      const cheap = sampleCheapness(myCheap, knobs.styleSigma);
      for (const bid of cands) {
        const leak = publicLeak(bid, remaining);
        const atoms = atomsFromBelief(
          myBeliefPublic,
          leak.prevStage,
          leak.afterStage,
          leak.color,
          cheap,
          knobs.uniformMix,
        );
        let e = 0;
        for (const o of oppSupport) {
          const oppBid = bestSecondBid(atoms, o.rem, view.opp.score, view.my.score, leak.color);
          e += o.p * pAfterRound(
            bid,
            oppBid,
            view.my.score,
            view.opp.score,
            remaining,
            o.rem,
            true,
          );
        }
        const a = acc.get(bid)!;
        a.sum += e;
        a.n += 1;
      }
    }, { batchSize: 2 });

    const scored = cands.map((bid) => {
      const a = acc.get(bid)!;
      return { bid, score: a.n > 0 ? a.sum / a.n : -1 };
    });
    const points = pickFromScores(scored, tier, knobs.softmaxTemp, remaining, forceNonZero);
    return { type: 'submitFirst', points };
  }

  if (view.phase === 'secondSubmit') {
    if (iAmFirst || view.my.submitted) return null;
    if (view.firstPlayerColor == null || view.prevFirstStage == null) return null;
    if (remaining === 0) return { type: 'submitSecond', points: 0 };

    const range = inferSpendRange(view.prevFirstStage, view.opp.stage, view.firstPlayerColor);
    const cands = legalSecondBids(remaining, view.firstPlayerColor, range);

    const acc = new Map<number, { sum: number; n: number }>();
    for (const b of cands) acc.set(b, { sum: 0, n: 0 });

    await runPsychologySearch(budgetMs, () => {
      const cheap = sampleCheapness(oppCheap, knobs.styleSigma);
      const atoms = firstBidAtoms(view, cheap, knobs.uniformMix);
      for (const bid of cands) {
        const e = evAgainstAtoms(
          bid,
          atoms,
          view.my.score,
          view.opp.score,
          remaining,
          false,
        );
        const a = acc.get(bid)!;
        a.sum += e;
        a.n += 1;
      }
    }, { batchSize: 8 });

    const scored = cands.map((bid) => {
      const a = acc.get(bid)!;
      return { bid, score: a.n > 0 ? a.sum / a.n : -1 };
    });
    let points = pickFromScores(scored, tier, knobs.softmaxTemp, remaining, forceNonZero);
    if (view.firstPlayerColor === 'white' && points > 0 && points < 10) points = 0;
    if (points > 0 && points < range.lo) points = 0;
    return { type: 'submitSecond', points };
  }

  return null;
}

export function expectedOppRemaining(
  view: Bnw2DummyView,
  cheapness?: number,
  uniformMix = 0.08,
): number {
  const c = cheapness ?? estimateCheapness(view.roundHistory, view.oppId);
  const b = clipBeliefToStage(
    beliefFromHistory(view.roundHistory, view.oppId, c, uniformMix),
    view.phase === 'secondSubmit' && view.firstPlayerId === view.oppId
      ? (view.prevFirstStage ?? view.opp.stage)
      : view.opp.stage,
  );
  return meanBelief(b);
}
