/* 베팅 가위바위보 슈퍼 자문: 전판 mix+최악. 받은 시간을 다 씀. COM ai.ts 안 씀. */
import type {
  BRPSResult,
  BrpsAdvisorAsk,
  BrpsAdvisorPending,
  BrpsAdvisorRound,
} from '@shared/types/betting-rps.js';
import {
  BRPS_RESULTS,
  BRPS_TOTAL_ROUNDS,
  brpsAdvisorAsk,
  brpsAdvisorSnapshot,
  brpsApplyRound,
  brpsHasChoiceRight,
  brpsMatchWinBonus,
} from '@shared/types/betting-rps.js';
import {
  MATCH_OPEN_PRIOR,
  denyMatchOf,
  gapBucket,
  kifuBetFraction,
  lastRevealedOppMatch,
  lastRevealedOppPred,
  obsWeightSum,
  observedOppBet,
  observedOppMatch,
} from './kifu-prior.js';

export const BRPS_SUPER_THINK_MS = 90_000;
const MAX_CHIP = 48;
const LOSS = 0.08;
const ALIVE = 0.35;
const CLOCK_MASK = 1023;

export type BrpsAdvisorPick =
  | { kind: 'role'; role: 'match' | 'bet'; winRate: number }
  | { kind: 'match'; result: BRPSResult; winRate: number }
  | { kind: 'bet'; prediction: BRPSResult; chips: number; winRate: number };

interface Sig {
  lastM: number;
  lastP: number;
  lastHit: number;
}

let _nodes = 0;
let _deadline = 0;
let _timedOut = false;
let _allowTimeout = false;
const _memo = new Map<string, number>();
let _obsMatch: Record<BRPSResult, number> = { win: 0, draw: 0, lose: 0 };
let _obsBetPred: Record<BRPSResult, number> = { win: 0, draw: 0, lose: 0 };
let _obsBetChips: number[] = [];
let _history: BrpsAdvisorRound[] = [];
let _rng = 1;

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

function clipBet(amount: number, chips: number): number {
  if (chips <= 0) return 0;
  if (amount <= 0) return 0;
  return Math.min(chips, Math.max(1, Math.round(amount)));
}

function clampChip(n: number): number {
  if (n < 0) return 0;
  if (n > MAX_CHIP) return MAX_CHIP;
  return n;
}

function remainingBonus(fromRound: number): number {
  let s = 0;
  for (let r = fromRound; r <= BRPS_TOTAL_ROUNDS; r++) s += brpsMatchWinBonus(r);
  return s;
}

function terminalValue(round: number, myC: number, oppC: number): number | null {
  if (round <= BRPS_TOTAL_ROUNDS) return null;
  if (myC > oppC) return 1;
  if (myC < oppC) return 0;
  return 0.5;
}

function cannotCatchMatchBonus(round: number, myC: number, oppC: number): boolean {
  if (myC <= 0) return true;
  return myC + myC <= oppC + brpsMatchWinBonus(round);
}

export function brpsAdvisorLeadLocks(round: number, myC: number, oppC: number): boolean {
  if (round > BRPS_TOTAL_ROUNDS) return myC > oppC;
  return myC - oppC > remainingBonus(round);
}

function deadPosition(round: number, myC: number, oppC: number): boolean {
  if (myC > oppC) return false;
  if (round > BRPS_TOTAL_ROUNDS) return myC < oppC;
  return oppC - myC > remainingBonus(round);
}

function codeRes(r: BRPSResult | null | undefined): number {
  if (r === 'win') return 1;
  if (r === 'draw') return 2;
  if (r === 'lose') return 3;
  return 0;
}

function fromCode(n: number): BRPSResult | null {
  if (n === 1) return 'win';
  if (n === 2) return 'draw';
  if (n === 3) return 'lose';
  return null;
}

function sigFromHistory(history: BrpsAdvisorRound[]): Sig {
  const lastM = lastRevealedOppMatch(history);
  const lastP = lastRevealedOppPred(history);
  let lastHit = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const rec = history[i]!;
    if (rec.myRole !== 'bet') continue;
    lastHit = rec.prediction === rec.matchResult ? 1 : 2;
    break;
  }
  return { lastM: codeRes(lastM), lastP: codeRes(lastP), lastHit };
}

function afterMatchSig(sig: Sig, pred: BRPSResult): Sig {
  return { lastM: sig.lastM, lastP: codeRes(pred), lastHit: sig.lastHit };
}

function afterBetSig(sig: Sig, oppMatch: BRPSResult, pred: BRPSResult): Sig {
  return {
    lastM: codeRes(oppMatch),
    lastP: sig.lastP,
    lastHit: pred === oppMatch ? 1 : 2,
  };
}

function applyHistoryContext(history: BrpsAdvisorRound[]): void {
  _history = history;
  _obsMatch = observedOppMatch(history);
  const obsBet = observedOppBet(history);
  _obsBetPred = obsBet.pred;
  _obsBetChips = obsBet.chips;
}

function typicalOppBet(oppChips: number, round: number): number {
  if (oppChips <= 0) return 0;
  const shown = _obsBetChips.filter((c) => c > 0);
  if (shown.length > 0) {
    const avg = Math.round(shown.reduce((a, b) => a + b, 0) / shown.length);
    return clipBet(avg, oppChips);
  }
  if (round <= 6) {
    const frac = kifuBetFraction(round, 2);
    return clipBet(Math.round(oppChips * frac), oppChips);
  }
  return clipBet(Math.max(1, Math.round(oppChips * 0.35)), oppChips);
}

function threatBetSizes(oppC: number, round: number, width: number): number[] {
  if (oppC <= 0) return [0];
  const set = new Set<number>();
  const typical = typicalOppBet(oppC, round);
  if (typical > 0) set.add(typical);
  set.add(clipBet(Math.max(1, Math.round(oppC * 0.5)), oppC));
  set.add(oppC);
  for (const c of _obsBetChips) {
    const n = clipBet(c, oppC);
    if (n > 0) set.add(n);
  }
  if (width >= 1) {
    set.add(clipBet(1, oppC));
    set.add(clipBet(Math.round(oppC * 0.25), oppC));
    set.add(clipBet(Math.round(oppC * 0.75), oppC));
  }
  if (width >= 2) {
    const cap = Math.min(oppC, 14);
    for (let c = 1; c <= cap; c++) set.add(c);
    set.add(oppC);
  }
  return [...set];
}

function threatPreds(sig: Sig): BRPSResult[] {
  const set = new Set<BRPSResult>(['win']);
  const last = fromCode(sig.lastP);
  if (last) set.add(last);
  else set.add('lose');
  return [...set];
}

function threatMatches(sig: Sig, round: number): BRPSResult[] {
  const set = new Set<BRPSResult>(['win']);
  const last = fromCode(sig.lastM);
  if (last) set.add(last);
  if (round < 7 && !last) set.add('lose');
  return [...set];
}

function mixWeight(): number {
  return 0.52;
}

function lateBonus(round: number): number {
  if (round >= 8) return 4.2;
  if (round >= 7) return 3.2;
  if (round >= 4) return 1.1;
  return 0;
}

function oppMatchWeights(round: number, sig: Sig): Record<BRPSResult, number> {
  const w: Record<BRPSResult, number> = {
    win: MATCH_OPEN_PRIOR.win,
    draw: MATCH_OPEN_PRIOR.draw,
    lose: MATCH_OPEN_PRIOR.lose,
  };
  w.win += lateBonus(round);
  const obs = _obsMatch;
  const sum = obsWeightSum(obs);
  if (sum > 0) {
    for (const r of BRPS_RESULTS) w[r] += 6 * (obs[r] ?? 0);
  }
  const last = fromCode(sig.lastM);
  if (last) w[last] += 2.6;
  if (sig.lastHit === 1 && last) {
    w[last] -= 2.2;
    w[denyMatchOf(last)] += 1.8;
  }
  for (const r of BRPS_RESULTS) if (w[r] < 0.15) w[r] = 0.15;
  return w;
}

function oppPredWeights(sig: Sig): Record<BRPSResult, number> {
  const w: Record<BRPSResult, number> = { win: 4.0, draw: 0.7, lose: 3.2 };
  const last = fromCode(sig.lastP);
  if (last) w[last] += 2.8;
  else w.lose += 1.6;
  const obs = _obsBetPred;
  const sum = obsWeightSum(obs);
  if (sum > 0) {
    for (const r of BRPS_RESULTS) w[r] += 6 * (obs[r] ?? 0);
  }
  for (const r of BRPS_RESULTS) if (w[r] < 0.15) w[r] = 0.15;
  return w;
}

function norm(w: Record<BRPSResult, number>): Array<{ r: BRPSResult; p: number }> {
  let s = 0;
  for (const r of BRPS_RESULTS) s += w[r];
  if (s <= 0) return BRPS_RESULTS.map((r) => ({ r, p: 1 / 3 }));
  return BRPS_RESULTS.map((r) => ({ r, p: w[r] / s }));
}

function greedyOppMatch(round: number, sig: Sig): BRPSResult {
  if (round >= 7) return 'win';
  return fromCode(sig.lastM) ?? 'win';
}

function greedyOppPred(sig: Sig): BRPSResult {
  return fromCode(sig.lastP) ?? 'win';
}

function hitProb(round: number, pred: BRPSResult, sig: Sig): number {
  const lastM = fromCode(sig.lastM);
  if (lastM) {
    if (round >= 7 && pred === 'win') return lastM === 'win' ? 0.7 : 0.48;
    return lastM === pred ? 0.7 : 0.15;
  }
  const obs = _obsMatch;
  const sum = obsWeightSum(obs);
  if (sum > 0) return Math.max(0.08, (MATCH_OPEN_PRIOR[pred] + 8 * (obs[pred] ?? 0)) / (8.5 + 8 * sum));
  if (pred === 'win') return 0.48;
  if (pred === 'lose') return 0.38;
  return 0.14;
}

export function brpsAdvisorTargetBet(
  round: number,
  myC: number,
  oppC: number,
  pred: BRPSResult = 'win',
  history?: BrpsAdvisorRound[],
): number {
  if (history) applyHistoryContext(history);
  const sig = sigFromHistory(history ?? _history);
  if (myC <= 0) return 0;
  if (brpsAdvisorLeadLocks(round, myC, oppC)) return clipBet(1, myC);
  if (deadPosition(round, myC, oppC) && pred === 'win') {
    const theyWin = oppC + brpsMatchWinBonus(round);
    if (myC + myC <= theyWin) return clipBet(1, myC);
  }
  const left = BRPS_TOTAL_ROUNDS - round + 1;
  const p = hitProb(round, pred, sig);
  const kelly = pred === 'draw' ? Math.max(0, (3 * p - 1) / 2) : Math.max(0, 2 * p - 1);
  if (kelly <= 0) return clipBet(1, myC);

  let frac = kelly * 0.7;
  if (round <= 6) {
    const kf = kifuBetFraction(round, gapBucket(myC, oppC));
    if (kf < 0.9) frac = Math.max(frac, Math.min(kf * 0.5, 0.5));
  }
  let t = myC * frac;
  const lastM = fromCode(sig.lastM);
  if (lastM === pred && kelly >= 0.2) t = Math.max(t, myC * 0.4);
  if (round >= 7 && pred === 'win' && kelly >= 0.15) t = Math.max(t, myC * 0.35);
  const trail = oppC - myC;
  if (trail > 0) {
    if (left <= 1 && myC + myC > oppC + brpsMatchWinBonus(round) && kelly >= 0.2) t = myC;
    else t = Math.min(t, Math.max(1, myC * 0.45));
  }
  if (trail <= -4 && left <= 2) t = Math.min(t, Math.max(1, myC * 0.3));
  return clipBet(t, myC);
}

function betChipCandidates(myC: number, oppC: number, round: number, width: number): number[] {
  if (myC <= 0) return [0];
  if (brpsAdvisorLeadLocks(round, myC, oppC)) return [clipBet(1, myC)];
  const set = new Set<number>();
  const allInt = myC <= 8 || width >= 2;
  if (allInt) {
    const cap = Math.min(myC, width >= 2 ? 16 : myC);
    for (let c = 1; c <= cap; c++) set.add(c);
    set.add(myC);
  } else {
    for (const pred of BRPS_RESULTS) set.add(brpsAdvisorTargetBet(round, myC, oppC, pred));
    set.add(1);
    set.add(clipBet(Math.round(myC * 0.25), myC));
    set.add(clipBet(Math.round(myC * 0.5), myC));
    set.add(clipBet(Math.round(myC * 0.75), myC));
    if (oppC > myC) set.add(myC);
  }
  return [...set].filter((c) => c >= 1 && c <= myC).sort((a, b) => a - b);
}

function raceEval(round: number, myC: number, oppC: number): number {
  if (myC > oppC && brpsAdvisorLeadLocks(round, myC, oppC)) return 0.97;
  if (deadPosition(round, myC, oppC)) return 0.03;
  const rem = remainingBonus(round);
  const gap = myC - oppC;
  if (rem <= 0) {
    if (gap > 0) return 0.97;
    if (gap < 0) return 0.03;
    return 0.5;
  }
  return 1 / (1 + Math.exp(-gap / Math.max(1.6, rem * 0.28)));
}

function afterValue(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  horizon: number,
  width: number,
): number {
  const next = round + 1;
  const done = terminalValue(next, myC, oppC);
  if (done !== null) return done;
  if (deadPosition(next, myC, oppC)) return 0.03;
  if (brpsAdvisorLeadLocks(next, myC, oppC) && brpsHasChoiceRight(iAmFirst, next)) return 0.97;
  if (horizon <= 0) return raceEval(next, myC, oppC);
  return valueState(next, myC, oppC, iAmFirst, sig, horizon - 1, width);
}

function lineMatch(
  round: number,
  result: BRPSResult,
  pred: BRPSResult,
  chips: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  horizon: number,
  width: number,
): number {
  const next = brpsApplyRound(round, 'match', result, pred, chips, myC, oppC);
  return afterValue(round, next.myChips, next.oppChips, iAmFirst, afterMatchSig(sig, pred), horizon, width);
}

function lineBet(
  round: number,
  pred: BRPSResult,
  chips: number,
  oppMatch: BRPSResult,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  horizon: number,
  width: number,
): number {
  const next = brpsApplyRound(round, 'bet', oppMatch, pred, chips, myC, oppC);
  return afterValue(round, next.myChips, next.oppChips, iAmFirst, afterBetSig(sig, oppMatch, pred), horizon, width);
}

function mixChips(oppC: number, round: number, width: number): Array<{ chips: number; p: number }> {
  const sizes = threatBetSizes(oppC, round, width);
  if (sizes.length === 0) return [{ chips: 0, p: 1 }];
  const typical = typicalOppBet(oppC, round);
  const w = sizes.map((c) => {
    if (c === oppC) return 2.2;
    if (c === typical) return 3;
    if (c === clipBet(Math.round(oppC * 0.5), oppC)) return 2;
    return 1;
  });
  const s = w.reduce((a, b) => a + b, 0);
  return sizes.map((chips, i) => ({ chips, p: w[i]! / s }));
}

function worstMatchValue(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  result: BRPSResult,
  horizon: number,
  width: number,
): number {
  let worst = 1;
  for (const pred of threatPreds(sig)) {
    for (const chips of threatBetSizes(oppC, round, width)) {
      worst = Math.min(worst, lineMatch(round, result, pred, chips, myC, oppC, iAmFirst, sig, horizon, width));
      if (_timedOut) return worst;
    }
  }
  return worst;
}

function mixMatchValue(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  result: BRPSResult,
  horizon: number,
  width: number,
): number {
  const preds = norm(oppPredWeights(sig));
  const chips = mixChips(oppC, round, width);
  let acc = 0;
  for (const pr of preds) {
    for (const ch of chips) {
      acc += pr.p * ch.p * lineMatch(round, result, pr.r, ch.chips, myC, oppC, iAmFirst, sig, horizon, width);
      if (_timedOut) return acc;
    }
  }
  return acc;
}

function scoreMatch(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  result: BRPSResult,
  horizon: number,
  width: number,
): { tree: number; worst: number } {
  if (horizon <= 0) {
    const pred = greedyOppPred(sig);
    let worst = 1;
    let mix = 0;
    const sizes = threatBetSizes(oppC, round, Math.max(0, width));
    for (const chips of sizes) {
      const v = lineMatch(round, result, pred, chips, myC, oppC, iAmFirst, sig, 0, width);
      worst = Math.min(worst, v);
      mix += v;
    }
    mix = sizes.length > 0 ? mix / sizes.length : 0.5;
    return { tree: 0.5 * mix + 0.5 * worst, worst };
  }
  const mix = mixMatchValue(round, myC, oppC, iAmFirst, sig, result, horizon, width);
  const worst = worstMatchValue(round, myC, oppC, iAmFirst, sig, result, horizon, width);
  const mw = round >= 7 ? 0.4 : mixWeight();
  return { tree: mw * mix + (1 - mw) * worst, worst };
}

function worstBetValue(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  pred: BRPSResult,
  chips: number,
  horizon: number,
  width: number,
): number {
  let worst = 1;
  for (const m of threatMatches(sig, round)) {
    worst = Math.min(worst, lineBet(round, pred, chips, m, myC, oppC, iAmFirst, sig, horizon, width));
    if (_timedOut) return worst;
  }
  return worst;
}

function mixBetValue(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  pred: BRPSResult,
  chips: number,
  horizon: number,
  width: number,
): number {
  const ms = norm(oppMatchWeights(round, sig));
  let acc = 0;
  for (const row of ms) {
    acc += row.p * lineBet(round, pred, chips, row.r, myC, oppC, iAmFirst, sig, horizon, width);
    if (_timedOut) return acc;
  }
  return acc;
}

function scoreBet(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  pred: BRPSResult,
  chips: number,
  horizon: number,
  width: number,
): { tree: number; worst: number } {
  if (horizon <= 0) {
    const m = greedyOppMatch(round, sig);
    const v = lineBet(round, pred, chips, m, myC, oppC, iAmFirst, sig, 0, width);
    let worst = v;
    for (const extra of threatMatches(sig, round)) {
      worst = Math.min(worst, lineBet(round, pred, chips, extra, myC, oppC, iAmFirst, sig, 0, width));
    }
    return { tree: 0.5 * v + 0.5 * worst, worst };
  }
  const mix = mixBetValue(round, myC, oppC, iAmFirst, sig, pred, chips, horizon, width);
  const worst = worstBetValue(round, myC, oppC, iAmFirst, sig, pred, chips, horizon, width);
  const mw = round >= 7 ? 0.38 : mixWeight();
  return { tree: mw * mix + (1 - mw) * worst, worst };
}

function bestMatch(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  horizon: number,
  width: number,
): number {
  let best = -1;
  for (const result of BRPS_RESULTS) {
    best = Math.max(best, scoreMatch(round, myC, oppC, iAmFirst, sig, result, horizon, width).tree);
    if (_timedOut) break;
  }
  return best < 0 ? 0.5 : best;
}

function bestBet(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  horizon: number,
  width: number,
): number {
  if (myC <= 0) return scoreBet(round, myC, oppC, iAmFirst, sig, 'win', 0, horizon, width).tree;
  const amts = betChipCandidates(myC, oppC, round, width);
  let best = -1;
  for (const pred of BRPS_RESULTS) {
    for (const chips of amts) {
      best = Math.max(best, scoreBet(round, myC, oppC, iAmFirst, sig, pred, chips, horizon, width).tree);
      if (_timedOut) return best < 0 ? 0.5 : best;
    }
  }
  return best < 0 ? 0.5 : best;
}

function scoreRole(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  role: 'match' | 'bet',
  horizon: number,
  width: number,
): number {
  if (role === 'match') return bestMatch(round, myC, oppC, iAmFirst, sig, horizon, width);
  return bestBet(round, myC, oppC, iAmFirst, sig, horizon, width);
}

function valueState(
  round: number,
  myC: number,
  oppC: number,
  iAmFirst: boolean,
  sig: Sig,
  horizon: number,
  width: number,
): number {
  tick();
  if (_timedOut) return 0.5;
  myC = clampChip(myC);
  oppC = clampChip(oppC);
  const done = terminalValue(round, myC, oppC);
  if (done !== null) return done;
  if (deadPosition(round, myC, oppC)) return 0;
  if (brpsAdvisorLeadLocks(round, myC, oppC) && brpsHasChoiceRight(iAmFirst, round)) return 1;

  const k = `${round}|${myC}|${oppC}|${iAmFirst ? 1 : 0}|${sig.lastM}${sig.lastP}${sig.lastHit}|${horizon}|${width}`;
  const hit = _memo.get(k);
  if (hit !== undefined) return hit;

  let v: number;
  if (brpsHasChoiceRight(iAmFirst, round)) {
    if (myC <= 0 || oppC <= 0 || brpsAdvisorLeadLocks(round, myC, oppC) || cannotCatchMatchBonus(round, myC, oppC)) {
      v = scoreRole(round, myC, oppC, iAmFirst, sig, 'match', horizon, width);
    } else {
      v = Math.max(
        scoreRole(round, myC, oppC, iAmFirst, sig, 'match', horizon, width),
        scoreRole(round, myC, oppC, iAmFirst, sig, 'bet', horizon, width),
      );
    }
  } else if (myC <= 0 || oppC <= 0) {
    v = scoreRole(round, myC, oppC, iAmFirst, sig, 'bet', horizon, width);
  } else {
    v = Math.min(
      scoreRole(round, myC, oppC, iAmFirst, sig, 'bet', horizon, width),
      scoreRole(round, myC, oppC, iAmFirst, sig, 'match', horizon, width),
    );
  }
  if (!_timedOut) _memo.set(k, v);
  return v;
}

function isForcedLoss(worst: number, bestOther: number): boolean {
  return worst <= LOSS && bestOther >= ALIVE;
}

function pickAlive<T>(rows: Array<{ item: T; tree: number; worst: number }>): typeof rows {
  if (rows.length === 0) return rows;
  const bestW = Math.max(...rows.map((r) => r.worst));
  const alive = rows.filter((r) => !isForcedLoss(r.worst, bestW));
  return alive.length > 0 ? alive : rows;
}

function isRole(v: unknown): v is 'match' | 'bet' {
  return v === 'match' || v === 'bet';
}

function isResult(v: unknown): v is BRPSResult {
  return v === 'win' || v === 'draw' || v === 'lose';
}

export function parseAdvisorHistory(raw: unknown): BrpsAdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > BRPS_TOTAL_ROUNDS) return null;
  const out: BrpsAdvisorRound[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if (!isRole(rec.myRole) || !isResult(rec.matchResult) || !isResult(rec.prediction)) return null;
    if (typeof rec.betChips !== 'number' || !Number.isInteger(rec.betChips) || rec.betChips < 0) {
      return null;
    }
    out.push({
      myRole: rec.myRole,
      matchResult: rec.matchResult,
      prediction: rec.prediction,
      betChips: rec.betChips,
    });
  }
  return out;
}

export function parsePending(raw: unknown): BrpsAdvisorPending {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: BrpsAdvisorPending = {};
  if (isRole(rec.myRole)) out.myRole = rec.myRole;
  if (isRole(rec.oppRole)) out.oppRole = rec.oppRole;
  return out;
}

function fallbackPick(ask: BrpsAdvisorAsk, round: number, myChips: number, oppChips: number, sig: Sig): BrpsAdvisorPick {
  if (ask === 'bet') {
    const pred = round >= 7 ? 'win' : (fromCode(sig.lastM) ?? 'win');
    return {
      kind: 'bet',
      prediction: pred,
      chips: brpsAdvisorTargetBet(round, myChips, oppChips, pred),
      winRate: 0.5,
    };
  }
  if (ask === 'match') {
    const deny = denyMatchOf(fromCode(sig.lastP) ?? 'win');
    return { kind: 'match', result: round === 1 && !sig.lastP ? 'win' : deny, winRate: 0.5 };
  }
  return { kind: 'role', role: 'match', winRate: 0.5 };
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rows: Array<{ r: BRPSResult; p: number }>, u: number): BRPSResult {
  let acc = 0;
  for (const row of rows) {
    acc += row.p;
    if (u <= acc) return row.r;
  }
  return rows[rows.length - 1]?.r ?? 'win';
}

function hashPos(round: number, myC: number, oppC: number, histLen: number): number {
  return ((round * 131 + myC * 17 + oppC * 31 + histLen * 7) >>> 0) || 1;
}

export function pickBettingRpsAdvisor(
  iAmFirst: boolean,
  history: BrpsAdvisorRound[],
  pending: BrpsAdvisorPending | undefined,
  timeLimitMs: number,
  chipsOverride?: { my: number; opp: number },
): BrpsAdvisorPick {
  _nodes = 0;
  _memo.clear();
  _timedOut = false;
  _allowTimeout = false;
  _deadline = Date.now() + Math.max(40, timeLimitMs);
  applyHistoryContext(history);

  const snap = brpsAdvisorSnapshot(iAmFirst, history);
  const ask = brpsAdvisorAsk(iAmFirst, history, pending);
  const myC = chipsOverride?.my ?? snap.myChips;
  const oppC = chipsOverride?.opp ?? snap.oppChips;
  const round = snap.round;
  const sig = sigFromHistory(history);
  const fallback = fallbackPick(ask, round, myC, oppC, sig);
  if (snap.result.kind !== 'playing' || ask === 'finished' || ask === 'need-opp-role') {
    return fallback;
  }

  const remaining = Math.max(1, BRPS_TOTAL_ROUNDS - round + 1);
  const locks = brpsAdvisorLeadLocks(round, myC, oppC);
  let chosen = fallback;

  const evaluate = (horizon: number, width: number): BrpsAdvisorPick => {
    const rank = (tree: number, worst: number, extra = 0) => 2 * worst + tree + extra;
    if (ask === 'role') {
      const roles: Array<'match' | 'bet'> =
        myC <= 0 || oppC <= 0 || locks || cannotCatchMatchBonus(round, myC, oppC) ? ['match'] : ['match', 'bet'];
      const rows = roles.map((role) => {
        const tree = scoreRole(round, myC, oppC, iAmFirst, sig, role, horizon, width);
        const worst =
          role === 'match'
            ? Math.max(...BRPS_RESULTS.map((r) => scoreMatch(round, myC, oppC, iAmFirst, sig, r, horizon, width).worst))
            : Math.max(
                ...BRPS_RESULTS.map((pred) =>
                  scoreBet(
                    round,
                    myC,
                    oppC,
                    iAmFirst,
                    sig,
                    pred,
                    pred === 'win' ? Math.min(myC, Math.max(1, typicalOppBet(myC, round))) : clipBet(1, myC),
                    horizon,
                    width,
                  ).worst,
                ),
              );
        return { item: role, tree, worst };
      });
      const alive = pickAlive(rows);
      let best = -Infinity;
      let pick: BrpsAdvisorPick = fallback;
      for (const row of alive) {
        const ev = rank(row.tree, row.worst, row.item === 'match' && round <= 6 ? 0.03 : 0);
        if (ev > best) {
          best = ev;
          pick = { kind: 'role', role: row.item, winRate: Math.min(1, Math.max(0, row.tree)) };
        }
      }
      return pick;
    }
    if (ask === 'match') {
      const rows = BRPS_RESULTS.map((result) => {
        const sc = scoreMatch(round, myC, oppC, iAmFirst, sig, result, horizon, width);
        return { item: result, tree: sc.tree, worst: sc.worst };
      });
      const alive = pickAlive(rows);
      let best = -Infinity;
      let pick: BrpsAdvisorPick = fallback;
      for (const row of alive) {
        const ev = rank(row.tree, row.worst);
        if (ev > best) {
          best = ev;
          pick = { kind: 'match', result: row.item, winRate: Math.min(1, Math.max(0, row.tree)) };
        }
      }
      return pick;
    }
    const amts = betChipCandidates(myC, oppC, round, width);
    const rows: Array<{ item: { pred: BRPSResult; chips: number }; tree: number; worst: number }> = [];
    for (const pred of BRPS_RESULTS) {
      for (const chips of amts) {
        const sc = scoreBet(round, myC, oppC, iAmFirst, sig, pred, chips, horizon, width);
        rows.push({ item: { pred, chips }, tree: sc.tree, worst: sc.worst });
      }
    }
    const alive = pickAlive(rows);
    let best = -Infinity;
    let pick: BrpsAdvisorPick = fallback;
    for (const row of alive) {
      const target = brpsAdvisorTargetBet(round, myC, oppC, row.item.pred);
      const sizeFit = target > 0 ? -0.03 * (Math.abs(row.item.chips - target) / target) : 0;
      const ev = rank(row.tree, row.worst, sizeFit);
      if (ev > best) {
        best = ev;
        pick = {
          kind: 'bet',
          prediction: row.item.pred,
          chips: row.item.chips,
          winRate: Math.min(1, Math.max(0, row.tree)),
        };
      }
    }
    return pick;
  };

  let completed = 0;
  for (let h = 1; h <= remaining; h++) {
    if (h > 1 && Date.now() >= _deadline) break;
    _allowTimeout = h > 1;
    _timedOut = false;
    _memo.clear();
    const cand = evaluate(h, 0);
    if (h === 1 || !_timedOut) {
      chosen = cand;
      completed = h;
    }
  }

  for (let width = 1; width <= 2 && Date.now() < _deadline; width++) {
    _allowTimeout = true;
    _timedOut = false;
    _memo.clear();
    const cand = evaluate(Math.max(1, completed), width);
    if (!_timedOut) chosen = cand;
  }

  if (locks && ask === 'match' && chosen.kind === 'match') {
    const deny = denyMatchOf(fromCode(sig.lastP) ?? 'win');
    chosen = { kind: 'match', result: deny, winRate: chosen.winRate };
  }

  const rand = mulberry(hashPos(round, myC, oppC, history.length) ^ (round * 9973));
  _rng = hashPos(round, myC, oppC, history.length);
  let sims = 0;
  let simSum = 0;
  while (Date.now() < _deadline) {
    if (ask === 'match' && chosen.kind === 'match') {
      const pred = pickWeighted(norm(oppPredWeights(sig)), rand());
      const sizes = threatBetSizes(oppC, round, 2);
      const chips = sizes[Math.floor(rand() * sizes.length)] ?? typicalOppBet(oppC, round);
      simSum += lineMatch(round, chosen.result, pred, chips, myC, oppC, iAmFirst, sig, 0, 0);
      sims++;
    } else if (ask === 'bet' && chosen.kind === 'bet') {
      const m = pickWeighted(norm(oppMatchWeights(round, sig)), rand());
      simSum += lineBet(round, chosen.prediction, chosen.chips, m, myC, oppC, iAmFirst, sig, 0, 0);
      sims++;
    } else if (ask === 'role' && chosen.kind === 'role') {
      const v = scoreRole(round, myC, oppC, iAmFirst, sig, chosen.role, 0, 0);
      simSum += v;
      sims++;
      if (rand() < 0.5) valueState(round, myC, oppC, iAmFirst, sig, 1, 0);
    } else {
      valueState(round, myC, oppC, iAmFirst, sig, 1, 0);
      sims++;
    }
    _rng = (_rng + sims) >>> 0;
    if ((sims & 31) === 0 && Date.now() >= _deadline) break;
  }

  if (sims > 24) {
    const roll = simSum / sims;
    chosen = { ...chosen, winRate: Math.min(1, Math.max(0, 0.62 * chosen.winRate + 0.38 * roll)) };
  }

  const label =
    chosen.kind === 'role'
      ? chosen.role
      : chosen.kind === 'match'
        ? chosen.result
        : `${chosen.prediction}:${chosen.chips}`;
  const used = Date.now() - (_deadline - Math.max(40, timeLimitMs));
  console.info(
    `[BRPS advisor] round=${round} ask=${ask} nodes=${_nodes} h=${completed} sims=${sims} ms=${used} pick=${label} ev=${chosen.winRate.toFixed(3)} chips=${myC}/${oppC}`,
  );
  return chosen;
}

export interface BrpsSuperWorkerRequest {
  iAmFirst: boolean;
  history: BrpsAdvisorRound[];
  pending?: BrpsAdvisorPending;
  timeLimitMs?: number;
}

export interface BrpsSuperWorkerResponse extends BrpsAdvisorPick {}

export function __resetBrpsSuperSearchForTests(): void {
  _memo.clear();
  _nodes = 0;
  _timedOut = false;
  _allowTimeout = false;
  _history = [];
  _obsMatch = { win: 0, draw: 0, lose: 0 };
  _obsBetPred = { win: 0, draw: 0, lose: 0 };
  _obsBetChips = [];
}
