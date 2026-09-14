/* 흑과백2 슈퍼: 기보 상대 모형 + 수계산 + 90초 롤아웃. COM firstPoints+1 안 씀. */
import type {
  BNW2Color,
  Bnw2AdvisorPending,
  Bnw2AdvisorRound,
  Bnw2AdvisorSnapshot,
} from '@shared/types/bnw2.js';
import {
  BNW2_INITIAL_POINTS,
  BNW2_MAX_SCORE,
  BNW2_TOTAL_STAGES,
  bnw2AdvisorAsk,
  bnw2AdvisorHopeless,
  bnw2AdvisorSnapshot,
  bnw2AtomsFromBelief,
  bnw2BeliefFromHistory,
  bnw2InferSpendRange,
  bnw2LegalSecondBids,
  bnw2LegalSpends,
  bnw2PWinGame,
  bnw2SampleBelief,
  bnw2StageRange,
  calcBNW2Color,
  calcBNW2Stage,
} from '@shared/types/bnw2.js';
import {
  kifuDrops,
  kifuFirstWeight,
  kifuOpenWeight,
  kifuPhase,
  kifuSecondWeight,
  sampleKifuLeak,
  sampleWeighted,
} from './kifu-prior.js';

export const BNW2_SUPER_THINK_MS = 90_000;
const MIX = 0.5;
const KIFU_OPP = 0.45;
const CLOCK_MASK = 255;
const ROLLOUT_ROUNDS = 22;
const PLY_PRIOR = 8;

export type Bnw2AdvisorPick = { points: number; winRate: number };

interface Atom {
  bid: number;
  remBefore: number;
  p: number;
}

interface SuperStats {
  nodes: number;
  sims: number;
  usedMs: number;
}

let _deadline = 0;
let _timedOut = false;
let _allowTimeout = true;
let _nodes = 0;
let _sims = 0;
let _rng = (): number => Math.random();
let _stats: SuperStats = { nodes: 0, sims: 0, usedMs: 0 };

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function uniqueSorted(nums: number[]): number[] {
  return [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function fairPace(rem: number, score: number): number {
  return rem / Math.max(1, BNW2_MAX_SCORE - score);
}

function canFarmToTen(bid: number, score: number, rem: number): boolean {
  if (bid <= 0) return false;
  return Math.floor(rem / bid) >= BNW2_MAX_SCORE - score;
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

  let p = bnw2PWinGame(myS, oppS, myR, oppR, nextFirst);
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
    if (myDrops >= 2 && BNW2_MAX_SCORE - myScore > 1) p -= 0.12 * (myDrops - 1);
  }

  return clamp01(p);
}

function applyRound(
  myBid: number,
  oppBid: number,
  myScore: number,
  oppScore: number,
  myRem: number,
  oppRem: number,
  iAmFirst: boolean,
): { myS: number; oppS: number; myR: number; oppR: number; next: boolean } {
  const myR = Math.max(0, myRem - myBid);
  const oppR = Math.max(0, oppRem - oppBid);
  let myS = myScore;
  let oppS = oppScore;
  let next = iAmFirst;
  if (myBid > oppBid) {
    myS += 1;
    next = true;
  } else if (oppBid > myBid) {
    oppS += 1;
    next = false;
  }
  return { myS, oppS, myR, oppR, next };
}

function atomsFromKnownRem(
  remBefore: number,
  stageAfter: number,
  color: BNW2Color,
  round: number,
  myScore: number,
  oppScore: number,
): Atom[] {
  const drops = kifuDrops(calcBNW2Stage(remBefore), stageAfter);
  const spends = bnw2LegalSpends(remBefore, stageAfter, color);
  const scored =
    spends.length > 0
      ? spends
      : (() => {
          const range = bnw2InferSpendRange(calcBNW2Stage(remBefore), stageAfter, color);
          const out: number[] = [];
          for (let bid = Math.max(0, range.lo); bid <= Math.min(remBefore, range.hi); bid++) {
            if (calcBNW2Color(bid) === color) out.push(bid);
          }
          return out.length > 0 ? out : [Math.min(remBefore, color === 'white' ? 10 : 0)];
        })();

  const weights = scored.map((bid) =>
    Math.max(0.01, kifuFirstWeight(round, myScore, oppScore, color, drops, bid)),
  );
  let z = 0;
  for (const w of weights) z += w;
  return scored.map((bid, i) => ({ bid, remBefore, p: weights[i]! / z }));
}

function atomsFromOppLeak(
  belief: Float64Array,
  prevStage: number,
  stageAfter: number,
  color: BNW2Color,
  round: number,
  myScore: number,
  oppScore: number,
): Atom[] {
  const raw = bnw2AtomsFromBelief(belief, prevStage, stageAfter, color);
  const drops = kifuDrops(prevStage, stageAfter);
  const weights = raw.map((a) =>
    a.p * Math.max(0.01, kifuFirstWeight(round, myScore, oppScore, color, drops, a.bid)),
  );
  let z = 0;
  for (const w of weights) z += w;
  if (z <= 0) return raw;
  return raw.map((a, i) => ({ ...a, p: weights[i]! / z }));
}

function secondCandidates(remaining: number, atoms: Atom[], firstColor: BNW2Color): number[] {
  if (remaining <= 0) return [0];
  let hi = 0;
  let lo = Infinity;
  for (const a of atoms) {
    if (a.bid > hi) hi = a.bid;
    if (a.bid < lo) lo = a.bid;
  }
  if (!Number.isFinite(lo)) {
    return bnw2LegalSecondBids(
      remaining,
      firstColor,
      firstColor === 'white' ? { lo: 10, hi: 19 } : { lo: 0, hi: 9 },
    );
  }
  return bnw2LegalSecondBids(remaining, firstColor, { lo, hi });
}

function evAgainstAtoms(
  myBid: number,
  atoms: Atom[],
  myScore: number,
  oppScore: number,
  myRem: number,
  iAmFirst: boolean,
): { mix: number; worst: number } {
  let mix = 0;
  let worst = 1;
  for (const a of atoms) {
    const v = pAfterRound(myBid, a.bid, myScore, oppScore, myRem, a.remBefore, iAmFirst);
    mix += a.p * v;
    if (v < worst) worst = v;
  }
  return { mix, worst };
}

function blended(mix: number, worst: number): number {
  if (worst >= 0.999) return 1;
  return MIX * mix + (1 - MIX) * worst;
}

function publicLeak(bid: number, remainingBefore: number): {
  color: BNW2Color;
  afterStage: number;
} {
  return {
    color: calcBNW2Color(bid),
    afterStage: calcBNW2Stage(remainingBefore - bid),
  };
}

function firstCandidates(remaining: number, myNeed: number, oppNeed: number, wide: boolean, round: number): number[] {
  if (remaining <= 0) return [0];
  const urgent = myNeed === 1 || oppNeed === 1;
  const cap = urgent || wide ? remaining : Math.min(remaining, round <= 1 ? 22 : 48);
  const out: number[] = [];
  for (let i = 0; i <= cap; i++) out.push(i);
  if (remaining > cap) out.push(remaining);
  const extras = [0, 1, 9, 10, 11, 13, 15, 16, 19, 20, 21, Math.round(remaining / Math.max(1, myNeed))];
  for (const x of extras) {
    if (x >= 0 && x <= remaining) out.push(x);
  }
  return uniqueSorted(out);
}

function thinSecond(cands: number[], remaining: number, wide: boolean): number[] {
  if (wide || cands.length <= 40) return cands;
  const keep = new Set<number>([0, remaining]);
  const last = cands[cands.length - 1] ?? 0;
  for (const x of [1, 9, 10, 11, 15, 20, 21, last, last - 1, Math.floor(last / 2)]) {
    if (x >= 0 && x <= remaining) keep.add(x);
  }
  const step = Math.max(1, Math.floor(cands.length / 28));
  for (let i = 0; i < cands.length; i += step) keep.add(cands[i]!);
  keep.add(cands[cands.length - 1]!);
  return uniqueSorted([...keep].filter((x) => cands.includes(x) || x === 0));
}

function filterFirstCands(cands: number[], remaining: number, myNeed: number, oppNeed: number, round: number): number[] {
  const urgent = myNeed === 1 || oppNeed === 1;
  if (urgent || round > 3) return cands;
  const slim = cands.filter((b) => b < 40 || b === remaining);
  return slim.length > 0 ? slim : cands;
}

function filterSecondCands(
  cands: number[],
  remaining: number,
  color: BNW2Color,
  drops: number,
  myNeed: number,
  oppNeed: number,
): number[] {
  let out = cands.filter((b) => !(color === 'white' && b > 0 && b < 10));
  if (color === 'white' && drops >= 2 && myNeed > 1 && oppNeed > 1) {
    out = out.filter((b) => b === 0);
  }
  if (out.length === 0) return remaining > 0 && (myNeed === 1 || oppNeed === 1) ? [Math.min(remaining, color === 'white' ? 10 : 1)] : [0];
  return out;
}

function oppBestVsAtoms(
  atoms: Atom[],
  oppRem: number,
  myScore: number,
  oppScore: number,
  firstColor: BNW2Color,
): number {
  const cands = secondCandidates(oppRem, atoms, firstColor);
  let bestBid = cands[0] ?? 0;
  let bestTheir = -Infinity;
  for (const bid of cands) {
    let their = 0;
    for (const a of atoms) {
      const our = pAfterRound(a.bid, bid, myScore, oppScore, a.remBefore, oppRem, true);
      their += a.p * (1 - our);
    }
    if (their > bestTheir + 1e-12 || (Math.abs(their - bestTheir) <= 1e-12 && bid < bestBid)) {
      bestTheir = their;
      bestBid = bid;
    }
  }
  return bestBid;
}

function oppWorstForUs(
  myBid: number,
  atoms: Atom[],
  oppRem: number,
  myScore: number,
  oppScore: number,
  myRem: number,
  firstColor: BNW2Color,
): number {
  const cands = secondCandidates(oppRem, atoms, firstColor);
  let worstBid = cands[0] ?? 0;
  let worst = 1;
  for (const bid of cands) {
    const v = pAfterRound(myBid, bid, myScore, oppScore, myRem, oppRem, true);
    if (v < worst - 1e-12 || (Math.abs(v - worst) <= 1e-12 && bid < worstBid)) {
      worst = v;
      worstBid = bid;
    }
  }
  return worstBid;
}

function scoreFirstBid(myBid: number, snap: Bnw2AdvisorSnapshot): number {
  tick();
  const leak = publicLeak(myBid, snap.my.remaining);
  const atoms = atomsFromKnownRem(
    snap.my.remaining,
    leak.afterStage,
    leak.color,
    snap.round,
    snap.my.score,
    snap.opp.score,
  );
  const mixBid = oppBestVsAtoms(atoms, snap.opp.remaining, snap.my.score, snap.opp.score, leak.color);
  const worstBid = oppWorstForUs(
    myBid,
    atoms,
    snap.opp.remaining,
    snap.my.score,
    snap.opp.score,
    snap.my.remaining,
    leak.color,
  );
  const mix = pAfterRound(
    myBid,
    mixBid,
    snap.my.score,
    snap.opp.score,
    snap.my.remaining,
    snap.opp.remaining,
    true,
  );
  const worst = pAfterRound(
    myBid,
    worstBid,
    snap.my.score,
    snap.opp.score,
    snap.my.remaining,
    snap.opp.remaining,
    true,
  );
  let ev = blended(mix, worst);
  if (snap.round <= 1) ev += 0.012 * Math.log(1 + kifuOpenWeight(myBid));
  return ev;
}

function scoreSecondBid(
  myBid: number,
  atoms: Atom[],
  myScore: number,
  oppScore: number,
  myRem: number,
  color: BNW2Color,
  drops: number,
): number {
  tick();
  const { mix, worst } = evAgainstAtoms(myBid, atoms, myScore, oppScore, myRem, false);
  let ev = blended(mix, worst);
  ev += 0.004 * Math.log(kifuSecondWeight(color, drops, myBid));
  return ev;
}

function pickFromScored(
  scored: Array<{ bid: number; ev: number }>,
  remaining: number,
  forceNonZero: boolean,
): Bnw2AdvisorPick {
  let pool = scored;
  if (forceNonZero && remaining > 0) {
    const nz = pool.filter((x) => x.bid > 0);
    if (nz.length > 0) pool = nz;
  }
  if (pool.length === 0) return { points: 0, winRate: 0.5 };
  let best = pool[0]!;
  for (const s of pool) {
    if (s.ev > best.ev + 1e-9 || (Math.abs(s.ev - best.ev) <= 1e-9 && s.bid < best.bid)) {
      best = s;
    }
  }
  return { points: best.bid, winRate: clamp01(best.ev) };
}

function tinyFirstCands(remaining: number, myNeed: number): number[] {
  const extras = [0, 1, 9, 10, 13, 15, 19, Math.min(remaining, Math.round(remaining / Math.max(1, myNeed)))];
  return uniqueSorted(extras.filter((x) => x >= 0 && x <= remaining));
}

function greedyFirst(
  myS: number,
  oppS: number,
  myR: number,
  oppR: number,
  round: number,
): number {
  if (myR <= 0) return 0;
  const myNeed = BNW2_MAX_SCORE - myS;
  const oppNeed = BNW2_MAX_SCORE - oppS;
  const cands = tinyFirstCands(myR, myNeed);
  let best = cands[0] ?? 0;
  let bestEv = -Infinity;
  for (const bid of cands) {
    const fake = {
      round,
      iAmFirst: true,
      my: { remaining: myR, score: myS, stage: calcBNW2Stage(myR) },
      opp: { remaining: oppR, score: oppS, stage: calcBNW2Stage(oppR) },
      result: { kind: 'playing' as const },
      winType: null,
    };
    const ev = scoreFirstBid(bid, fake as Bnw2AdvisorSnapshot);
    if (ev > bestEv + 1e-12 || (Math.abs(ev - bestEv) <= 1e-12 && bid < best)) {
      bestEv = ev;
      best = bid;
    }
  }
  if ((myNeed === 1 || oppNeed === 1) && best === 0 && myR > 0) return Math.min(myR, 10);
  return best;
}

function greedySecond(
  myR: number,
  atoms: Atom[],
  color: BNW2Color,
  myS: number,
  oppS: number,
  drops: number,
): number {
  if (myR <= 0) return 0;
  const cands = filterSecondCands(
    thinSecond(secondCandidates(myR, atoms, color), myR, false),
    myR,
    color,
    drops,
    BNW2_MAX_SCORE - myS,
    BNW2_MAX_SCORE - oppS,
  );
  let best = cands[0] ?? 0;
  let bestEv = -Infinity;
  for (const bid of cands) {
    const ev = scoreSecondBid(bid, atoms, myS, oppS, myR, color, drops);
    if (ev > bestEv + 1e-12 || (Math.abs(ev - bestEv) <= 1e-12 && bid < best)) {
      bestEv = ev;
      best = bid;
    }
  }
  return best;
}

function sampleOppFirst(rem: number, myS: number, oppS: number, round: number): number {
  if (rem <= 0) return 0;
  const leak = sampleKifuLeak(kifuPhase(myS, oppS), _rng);
  const after = Math.max(0, calcBNW2Stage(rem) - leak.drops);
  const atoms = atomsFromKnownRem(rem, after, leak.color, round, myS, oppS);
  if (atoms.length === 0) return Math.min(rem, leak.color === 'white' ? 10 : 0);
  return sampleWeighted(
    atoms.map((a) => ({ item: a.bid, w: a.p })),
    _rng,
  );
}

function sampleOppSecond(rem: number, firstBid: number, remBefore: number): number {
  if (rem <= 0) return 0;
  const color = calcBNW2Color(firstBid);
  const drops = kifuDrops(calcBNW2Stage(remBefore), calcBNW2Stage(remBefore - firstBid));
  const atoms = atomsFromKnownRem(
    remBefore,
    calcBNW2Stage(remBefore - firstBid),
    color,
    2,
    0,
    0,
  );
  const cands = filterSecondCands(
    secondCandidates(rem, atoms, color),
    rem,
    color,
    drops,
    10,
    10,
  );
  return sampleWeighted(
    cands.map((bid) => ({ item: bid, w: kifuSecondWeight(color, drops, bid) })),
    _rng,
  );
}

function playOut(
  myBidLock: number,
  snap: Bnw2AdvisorSnapshot,
  pending: Bnw2AdvisorPending | null,
  iStartFirst: boolean,
  belief: Float64Array,
): number {
  let myS = snap.my.score;
  let oppS = snap.opp.score;
  let myR = snap.my.remaining;
  const band = bnw2StageRange(snap.opp.stage);
  let oppR = Math.min(band.hi, Math.max(band.lo, bnw2SampleBelief(belief, _rng)));
  let first = iStartFirst;
  let used = false;
  let round = snap.round;

  for (let i = 0; i < ROLLOUT_ROUNDS; i++) {
    tick();
    if (_timedOut) break;
    if (myS >= BNW2_MAX_SCORE) return 1;
    if (oppS >= BNW2_MAX_SCORE) return 0;
    if (myR <= 0 && oppR <= 0) {
      if (myS > oppS) return 1;
      if (myS < oppS) return 0;
      return first ? 1 : 0;
    }

    let myBid: number;
    let oppBid: number;
    if (first) {
      myBid = !used ? myBidLock : greedyFirst(myS, oppS, myR, oppR, round);
      used = true;
      myBid = Math.max(0, Math.min(myR, myBid));
      if (_rng() < KIFU_OPP) {
        oppBid = sampleOppSecond(oppR, myBid, myR);
      } else {
        const leak = publicLeak(myBid, myR);
        const atoms = atomsFromKnownRem(myR, leak.afterStage, leak.color, round, myS, oppS);
        const drops = kifuDrops(calcBNW2Stage(myR), leak.afterStage);
        oppBid = greedySecond(oppR, atoms, leak.color, oppS, myS, drops);
      }
      oppBid = Math.max(0, Math.min(oppR, oppBid));
    } else {
      if (_rng() < KIFU_OPP) {
        oppBid = sampleOppFirst(oppR, oppS, myS, round);
      } else {
        oppBid = greedyFirst(oppS, myS, oppR, myR, round);
      }
      oppBid = Math.max(0, Math.min(oppR, oppBid));
      const color = pending && !used && pending.firstColor ? pending.firstColor : calcBNW2Color(oppBid);
      const after =
        pending && !used && pending.firstStageAfter != null
          ? pending.firstStageAfter
          : calcBNW2Stage(oppR - oppBid);
      const atoms = atomsFromKnownRem(oppR, after, color, round, myS, oppS);
      const drops = kifuDrops(calcBNW2Stage(oppR), after);
      myBid = !used ? myBidLock : greedySecond(myR, atoms, color, myS, oppS, drops);
      used = true;
      myBid = Math.max(0, Math.min(myR, myBid));
      if (color === 'white' && myBid > 0 && myBid < 10) myBid = 0;
    }

    const nxt = applyRound(myBid, oppBid, myS, oppS, myR, oppR, first);
    myS = nxt.myS;
    oppS = nxt.oppS;
    myR = nxt.myR;
    oppR = nxt.oppR;
    first = nxt.next;
    round += 1;
    pending = null;
  }

  return bnw2PWinGame(myS, oppS, myR, oppR, first);
}

function pickFirst(snap: Bnw2AdvisorSnapshot, wide: boolean): Array<{ bid: number; ev: number }> {
  const remaining = snap.my.remaining;
  if (remaining <= 0) {
    return [{ bid: 0, ev: bnw2PWinGame(snap.my.score, snap.opp.score, 0, snap.opp.remaining, true) }];
  }
  if (bnw2AdvisorHopeless(snap, 'opp')) {
    return [{ bid: 0, ev: 1 }];
  }
  const myNeed = BNW2_MAX_SCORE - snap.my.score;
  const oppNeed = BNW2_MAX_SCORE - snap.opp.score;
  const raw = firstCandidates(remaining, myNeed, oppNeed, wide, snap.round);
  const cands = filterFirstCands(raw, remaining, myNeed, oppNeed, snap.round);
  const scored: Array<{ bid: number; ev: number }> = [];
  for (const bid of cands) {
    if (_timedOut && scored.length > 0) break;
    scored.push({ bid, ev: scoreFirstBid(bid, snap) });
  }
  return scored;
}

function pickSecond(
  snap: Bnw2AdvisorSnapshot,
  pending: Bnw2AdvisorPending,
  wide: boolean,
  belief: Float64Array,
): Array<{ bid: number; ev: number }> {
  const remaining = snap.my.remaining;
  const color = pending.firstColor ?? 'black';
  const stageAfter = pending.firstStageAfter ?? snap.opp.stage;
  if (remaining <= 0) {
    return [{ bid: 0, ev: bnw2PWinGame(snap.my.score, snap.opp.score, 0, snap.opp.remaining, false) }];
  }
  if (bnw2AdvisorHopeless(snap, 'opp')) {
    return [{ bid: 0, ev: 1 }];
  }
  const drops = kifuDrops(snap.opp.stage, stageAfter);
  const atoms = atomsFromOppLeak(
    belief,
    snap.opp.stage,
    stageAfter,
    color,
    snap.round,
    snap.my.score,
    snap.opp.score,
  );
  const myNeed = BNW2_MAX_SCORE - snap.my.score;
  const oppNeed = BNW2_MAX_SCORE - snap.opp.score;
  const full = filterSecondCands(
    secondCandidates(remaining, atoms, color),
    remaining,
    color,
    drops,
    myNeed,
    oppNeed,
  );
  const cands = thinSecond(full, remaining, wide);
  const scored: Array<{ bid: number; ev: number }> = [];
  for (const bid of cands) {
    if (_timedOut && scored.length > 0) break;
    scored.push({
      bid,
      ev: scoreSecondBid(bid, atoms, snap.my.score, snap.opp.score, remaining, color, drops),
    });
  }
  return scored;
}

function refineWithRollouts(
  scored: Array<{ bid: number; ev: number }>,
  snap: Bnw2AdvisorSnapshot,
  pending: Bnw2AdvisorPending | null,
  iAmFirst: boolean,
  remaining: number,
  forceNonZero: boolean,
  belief: Float64Array,
): Bnw2AdvisorPick {
  const ply = pickFromScored(scored, remaining, forceNonZero);
  let pool = [...scored].sort((a, b) => b.ev - a.ev || a.bid - b.bid);
  if (forceNonZero && remaining > 0) {
    const nz = pool.filter((x) => x.bid > 0);
    if (nz.length > 0) pool = nz;
  }
  pool = pool.slice(0, 16);
  if (!pool.some((x) => x.bid === ply.points)) {
    pool.push({ bid: ply.points, ev: ply.winRate });
  }

  const acc = pool.map((s) => ({ bid: s.bid, sum: s.ev * PLY_PRIOR, n: PLY_PRIOR }));
  _allowTimeout = true;
  _timedOut = false;

  while (Date.now() < _deadline) {
    for (const row of acc) {
      if (Date.now() >= _deadline) break;
      _timedOut = false;
      const v = playOut(row.bid, snap, pending, iAmFirst, belief);
      row.sum += v;
      row.n += 1;
      _sims += 1;
    }
  }

  let best = acc[0] ?? { bid: ply.points, sum: ply.winRate, n: 1 };
  for (const row of acc) {
    const ev = row.sum / row.n;
    const bev = best.sum / best.n;
    if (ev > bev + 1e-9 || (Math.abs(ev - bev) <= 1e-9 && row.bid < best.bid)) {
      best = row;
    }
  }
  if (forceNonZero && remaining > 0 && best.bid === 0) {
    const nz = acc.filter((x) => x.bid > 0);
    if (nz.length > 0) {
      best = nz.reduce((a, b) => (a.sum / a.n >= b.sum / b.n ? a : b));
    }
  }
  return { points: best.bid, winRate: clamp01(best.sum / best.n) };
}

export function pickBnw2Advisor(
  iAmFirstStart: boolean,
  history: Bnw2AdvisorRound[],
  pending: Bnw2AdvisorPending | null | undefined,
  timeLimitMs: number,
): Bnw2AdvisorPick {
  const t0 = Date.now();
  _deadline = t0 + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;
  _sims = 0;
  _rng = mulberry(
    ((history.length + 1) * 131 + (iAmFirstStart ? 17 : 3) + (pending?.firstStageAfter ?? 0) * 11) >>> 0 || 1,
  );

  const snap = bnw2AdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') {
    const winRate = snap.result.kind === 'win' ? 1 : snap.result.kind === 'loss' ? 0 : 0.5;
    _stats = { nodes: _nodes, sims: _sims, usedMs: Date.now() - t0 };
    return { points: 0, winRate };
  }

  const ask = bnw2AdvisorAsk(iAmFirstStart, history, pending);
  const fallbackRate = bnw2AdvisorHopeless(snap, 'my')
    ? 0
    : bnw2AdvisorHopeless(snap, 'opp')
      ? 1
      : bnw2PWinGame(
          snap.my.score,
          snap.opp.score,
          snap.my.remaining,
          snap.opp.remaining,
          snap.iAmFirst,
        );

  if (ask !== 'first-bid' && ask !== 'second-bid') {
    _stats = { nodes: _nodes, sims: _sims, usedMs: Date.now() - t0 };
    return { points: 0, winRate: fallbackRate };
  }

  const belief = bnw2BeliefFromHistory(history);
  const myNeed = BNW2_MAX_SCORE - snap.my.score;
  const oppNeed = BNW2_MAX_SCORE - snap.opp.score;
  const forceNonZero = snap.my.remaining > 0 && (myNeed === 1 || oppNeed === 1);

  let scored = ask === 'first-bid' ? pickFirst(snap, false) : pickSecond(snap, pending ?? {}, false, belief);
  if (Date.now() < _deadline) {
    _timedOut = false;
    const wide = ask === 'first-bid' ? pickFirst(snap, true) : pickSecond(snap, pending ?? {}, true, belief);
    if (wide.length > 0) scored = wide;
  }

  let chosen = pickFromScored(scored, snap.my.remaining, forceNonZero);
  if (ask === 'second-bid' && pending?.firstColor === 'white' && chosen.points > 0 && chosen.points < 10) {
    chosen = { points: 0, winRate: chosen.winRate };
  }

  if (Date.now() < _deadline && scored.length > 0) {
    chosen = refineWithRollouts(
      scored,
      snap,
      pending ?? null,
      snap.iAmFirst,
      snap.my.remaining,
      forceNonZero,
      belief,
    );
  }

  if (ask === 'second-bid') {
    const color = pending?.firstColor ?? 'black';
    const drops = kifuDrops(snap.opp.stage, pending?.firstStageAfter ?? snap.opp.stage);
    if (color === 'white' && chosen.points > 0 && chosen.points < 10) {
      chosen = { ...chosen, points: 0 };
    }
    if (color === 'white' && drops >= 2 && myNeed > 1 && oppNeed > 1) {
      chosen = { ...chosen, points: 0 };
    }
  }

  _stats = { nodes: _nodes, sims: _sims, usedMs: Date.now() - t0 };
  console.info(
    `[BNW2 advisor] round=${snap.round} first=${snap.iAmFirst} pick=${chosen.points} ev=${chosen.winRate.toFixed(3)} nodes=${_nodes} sims=${_sims} ms=${_stats.usedMs}`,
  );
  return chosen;
}

export function lastBnw2SuperStats(): SuperStats {
  return { ..._stats };
}

export function parseAdvisorHistory(raw: unknown): Bnw2AdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > 60) return null;
  const out: Bnw2AdvisorRound[] = [];
  let myRem = BNW2_INITIAL_POINTS;
  let oppStage = BNW2_TOTAL_STAGES;
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if (typeof rec.iWasFirst !== 'boolean') return null;
    if (typeof rec.myPoints !== 'number' || !Number.isInteger(rec.myPoints) || rec.myPoints < 0) return null;
    if (rec.myPoints > myRem) return null;
    if (rec.oppColor !== 'black' && rec.oppColor !== 'white') return null;
    if (typeof rec.oppStageAfter !== 'number' || !Number.isInteger(rec.oppStageAfter)) return null;
    if (rec.oppStageAfter < 0 || rec.oppStageAfter > 10) return null;
    if (rec.winner !== 'me' && rec.winner !== 'opp' && rec.winner !== 'draw') return null;
    if (rec.oppStageAfter > oppStage) return null;
    oppStage = rec.oppStageAfter;
    myRem -= rec.myPoints;
    out.push({
      iWasFirst: rec.iWasFirst,
      myPoints: rec.myPoints,
      oppColor: rec.oppColor,
      oppStageAfter: rec.oppStageAfter,
      winner: rec.winner,
    });
  }
  return out;
}

export function parsePending(raw: unknown): Bnw2AdvisorPending {
  if (raw == null || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: Bnw2AdvisorPending = {};
  if (rec.firstColor === 'black' || rec.firstColor === 'white') out.firstColor = rec.firstColor;
  if (typeof rec.firstStageAfter === 'number' && Number.isInteger(rec.firstStageAfter)) {
    if (rec.firstStageAfter >= 0 && rec.firstStageAfter <= 10) {
      out.firstStageAfter = rec.firstStageAfter;
    }
  }
  return out;
}

export interface Bnw2SuperWorkerRequest {
  iAmFirst: boolean;
  history: Bnw2AdvisorRound[];
  pending?: Bnw2AdvisorPending;
  timeLimitMs?: number;
}

export interface Bnw2SuperWorkerResponse extends Bnw2AdvisorPick {}

export function __resetBnw2SuperSearchForTests(): void {
  _timedOut = false;
  _allowTimeout = true;
  _nodes = 0;
  _sims = 0;
}

/** 테스트: COM 후플은 firstPoints+1. 슈퍼 픽은 이 값과 같으면 안 되는 경우가 있다. */
export function bnw2ComSecondCheat(firstPoints: number, remaining: number): number {
  if (remaining <= 0) return 0;
  const winBid = firstPoints + 1;
  if (winBid <= remaining) return winBid;
  return 1;
}
