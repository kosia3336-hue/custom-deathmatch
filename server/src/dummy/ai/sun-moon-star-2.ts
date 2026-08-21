import type { DummyAiTier } from '@shared/dummy.js';
import type {
  SMS2Action,
  SMS2ChipBet,
  SMS2MarkId,
  SMS2Phase,
  SMS2PowderStage,
  SMS2PowderSubmission,
  SMS2RoundRecord,
  SMS2Side,
} from '@shared/types/sun-moon-star-2.js';
import {
  MARK_IDS,
  decideLitMark,
  firstMaxBet,
  powderStageRange,
  secondMinBet,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
} from '@shared/types/sun-moon-star-2.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-013 · multi · 전적 집계 403판.
 * 전멸 85%, 선 베팅은 0 아니면 상한. 이번 상대 빛가루 분배·정확 잔량은 안 본다.
 */

export interface SunMoonStar2DummyView {
  gameOver: boolean;
  phase: SMS2Phase;
  round: number;
  maxRound: number;
  suddenDeath: boolean;
  firstPlayerSide: SMS2Side;
  myId: string;
  oppId: string;
  mySide: SMS2Side;
  my: {
    chips: number;
    powderRemain: number;
    powderStage: SMS2PowderStage;
    markContribution: SMS2PowderSubmission;
    submittedPowder: boolean;
    betConfirmed: boolean;
    pendingPowder: SMS2PowderSubmission | null;
    pendingBet: SMS2ChipBet | null;
  };
  opp: {
    chips: number;
    powderStage: SMS2PowderStage;
    submittedPowder: boolean;
    betConfirmed: boolean;
    /** 선 확정 후 후에게만 의미 있음. 이번 빛가루 없음 */
    publicBet: SMS2ChipBet | null;
  };
  /** 직전 점등 후 남은 합산. 없으면 0 */
  leftover: SMS2PowderSubmission;
  /** 이번 라운드 시작 때 상대 표시등 (직전 stageAfter) */
  oppStageStart: SMS2PowderStage;
  history: SMS2RoundRecord[];
  winner: string | 'draw' | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type PowderCand = { powder: SMS2PowderSubmission; key: string };
type BetCand = { bet: SMS2ChipBet; key: string };

function tierKnobs(tier: DummyAiTier): { uniformMix: number; softmaxTemp: number } {
  if (tier === '하') return { uniformMix: 0.4, softmaxTemp: 0.08 };
  if (tier === '중') return { uniformMix: 0.16, softmaxTemp: 0.03 };
  return { uniformMix: 0.05, softmaxTemp: 0.012 };
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1 / (1 + Math.exp(-x));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function leftoverTotals(history: SMS2RoundRecord[]): SMS2PowderSubmission {
  const last = history.at(-1);
  return last ? { ...last.markTotalsAfter } : zeroPowder();
}

export function powderSoftCap(remain: number, roundsLeft: number): number {
  if (remain <= 0) return 0;
  if (roundsLeft <= 1) return remain;
  if (roundsLeft >= 8) return Math.min(remain, 28);
  if (roundsLeft >= 5) return Math.min(remain, 30);
  if (roundsLeft >= 3) return Math.min(remain, 36);
  return remain;
}

export function focusPowder(mark: SMS2MarkId, amount: number): SMS2PowderSubmission {
  const p = zeroPowder();
  p[mark] = Math.max(0, amount);
  return p;
}

export function focusBet(mark: SMS2MarkId, amount: number): SMS2ChipBet {
  const b = zeroBet();
  b[mark] = Math.max(0, amount);
  return b;
}

function addTotals(a: SMS2PowderSubmission, b: SMS2PowderSubmission): SMS2PowderSubmission {
  return { sun: a.sun + b.sun, moon: a.moon + b.moon, star: a.star + b.star };
}

function pWinChips(my: number, opp: number): number {
  if (my <= 0 && opp <= 0) return 0.5;
  if (my <= 0) return 0;
  if (opp <= 0) return 1;
  return sigmoid((my - opp) / 6);
}

function applyChipDelta(bet: SMS2ChipBet, lit: SMS2MarkId, chips: number): number {
  return chips + 2 * bet[lit] - sumBet(bet);
}

export function firstBetTotals(myChips: number, oppChips: number): number[] {
  const max = Math.min(myChips, firstMaxBet(oppChips));
  if (max <= 0) return [0];
  return [0, max];
}

export function powderCandidates(view: SunMoonStar2DummyView): PowderCand[] {
  const remain = view.my.powderRemain;
  const roundsLeft = Math.max(1, view.maxRound - view.round + 1);
  const cap = powderSoftCap(remain, roundsLeft);
  const amounts = new Set<number>([0]);
  if (cap > 0) {
    for (const a of [10, 15, 19, 20, 25, cap]) {
      if (a > 0 && a <= cap) amounts.add(a);
    }
  }
  const out: PowderCand[] = [];
  const seen = new Set<string>();
  const push = (powder: SMS2PowderSubmission) => {
    const key = `pw:${powder.sun}:${powder.moon}:${powder.star}`;
    if (seen.has(key)) return;
    if (sumPowder(powder) > remain) return;
    seen.add(key);
    out.push({ powder, key });
  };
  push(zeroPowder());
  for (const mark of MARK_IDS) {
    for (const a of amounts) {
      if (a <= 0) continue;
      push(focusPowder(mark, a));
    }
  }
  return out;
}

function sampleOppPowder(
  view: SunMoonStar2DummyView,
  uniformMix: number,
): SMS2PowderSubmission {
  let lo = 0;
  let hi = 28;
  if (view.phase === 'betFirst' || view.phase === 'betSecond') {
    const before = powderStageRange(view.oppStageStart);
    const after = powderStageRange(view.opp.powderStage);
    lo = Math.max(0, before.min - after.max);
    hi = Math.max(lo, before.max - after.min);
    hi = Math.min(hi, 40);
  }
  const r = Math.random();
  if (r < 0.22 + uniformMix * 0.15) return zeroPowder();
  const amount = clampInt(lo + Math.random() * Math.max(1, hi - lo), lo, hi);
  if (amount <= 0) return zeroPowder();
  let mark: SMS2MarkId = 'sun';
  const u = Math.random();
  if (u < 0.22 * uniformMix + 0.08) {
    mark = MARK_IDS[Math.floor(Math.random() * 3)]!;
  } else {
    const lead = leftoverLeader(view.leftover);
    mark = Math.random() < 0.55 ? lead : (Math.random() < 0.5 ? 'sun' : lead);
  }
  return focusPowder(mark, amount);
}

function leftoverLeader(left: SMS2PowderSubmission): SMS2MarkId {
  return decideLitMark(left).mark;
}

function myRoundPowder(view: SunMoonStar2DummyView): SMS2PowderSubmission {
  if (view.my.pendingPowder) return view.my.pendingPowder;
  return zeroPowder();
}

function evalBoard(
  leftover: SMS2PowderSubmission,
  myPw: SMS2PowderSubmission,
  oppPw: SMS2PowderSubmission,
  myBet: SMS2ChipBet,
  oppBet: SMS2ChipBet,
  myChips: number,
  oppChips: number,
): number {
  const totals = addTotals(leftover, addTotals(myPw, oppPw));
  const lit = decideLitMark(totals).mark;
  return pWinChips(applyChipDelta(myBet, lit, myChips), applyChipDelta(oppBet, lit, oppChips));
}

function greedyOppFirst(view: SunMoonStar2DummyView, leftover: SMS2PowderSubmission, oppPw: SMS2PowderSubmission, myPw: SMS2PowderSubmission): SMS2ChipBet {
  const totals = addTotals(leftover, addTotals(myPw, oppPw));
  const mark = decideLitMark(totals).mark;
  const max = Math.min(view.opp.chips, firstMaxBet(view.my.chips));
  if (max <= 0) return zeroBet();
  return focusBet(mark, max);
}

function greedyOppSecond(
  view: SunMoonStar2DummyView,
  leftover: SMS2PowderSubmission,
  oppPw: SMS2PowderSubmission,
  myPw: SMS2PowderSubmission,
  myFirst: SMS2ChipBet,
): SMS2ChipBet {
  const min = secondMinBet(sumBet(myFirst));
  const tot = Math.min(view.opp.chips, min === 0 ? Math.min(3, view.opp.chips) : min);
  if (tot <= 0) return zeroBet();
  const totals = addTotals(leftover, addTotals(myPw, oppPw));
  const mark = decideLitMark(totals).mark;
  if (sumBet(myFirst) > 0) {
    const firstMark = MARK_IDS.reduce((a, m) => (myFirst[m] > myFirst[a] ? m : a), 'sun' as SMS2MarkId);
    if (Math.random() < 0.35) return focusBet(firstMark, tot);
  }
  return focusBet(mark, tot);
}

export function firstBetCandidates(view: SunMoonStar2DummyView): BetCand[] {
  const totals = firstBetTotals(view.my.chips, view.opp.chips);
  const out: BetCand[] = [];
  for (const t of totals) {
    if (t === 0) {
      out.push({ bet: zeroBet(), key: 'bet:0' });
      continue;
    }
    for (const mark of MARK_IDS) {
      out.push({ bet: focusBet(mark, t), key: `bet:${mark}:${t}` });
    }
  }
  return out;
}

export function secondBetCandidates(view: SunMoonStar2DummyView): BetCand[] {
  const first = view.opp.publicBet ?? zeroBet();
  const min = secondMinBet(sumBet(first));
  const chips = view.my.chips;
  const amounts = new Set<number>();
  amounts.add(Math.min(chips, min));
  if (min === 0) {
    amounts.add(0);
    if (chips >= 2) amounts.add(2);
    if (chips >= 3) amounts.add(Math.min(3, chips));
  } else if (chips > min) {
    amounts.add(min);
  }
  const out: BetCand[] = [];
  const seen = new Set<string>();
  for (const t of amounts) {
    if (t < min || t > chips) continue;
    if (t === 0) {
      const key = 'bet:0';
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ bet: zeroBet(), key });
      }
      continue;
    }
    for (const mark of MARK_IDS) {
      const key = `bet:${mark}:${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ bet: focusBet(mark, t), key });
    }
  }
  if (out.length === 0) {
    out.push({ bet: focusBet('sun', Math.min(chips, min)), key: 'bet:sun:min' });
  }
  return out;
}

function pickSoftmax<T>(scored: Array<{ cand: T; score: number }>, tier: DummyAiTier, temp: number): T {
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) throw new Error('no cands');
  if (tier === '상') {
    if (scored.length > 1 && Math.random() < 0.05 && scored[0]!.score - scored[1]!.score < 0.03) {
      return scored[1]!.cand;
    }
    return scored[0]!.cand;
  }
  const t = Math.max(0.008, temp);
  const maxS = scored[0]!.score;
  const weights = scored.map((x) => Math.exp((x.score - maxS) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return scored[i]!.cand;
  }
  return scored[scored.length - 1]!.cand;
}

function myIsFirst(view: SunMoonStar2DummyView): boolean {
  return view.firstPlayerSide === view.mySide;
}

export async function pickSunMoonStar2ActionAsync(
  view: SunMoonStar2DummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<SMS2Action | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  const knobs = tierKnobs(tier);

  if (view.phase === 'powder') {
    if (view.my.submittedPowder) return null;
    const cands = powderCandidates(view);
    const acc = new Map<string, { cand: PowderCand; sum: number; n: number }>();
    for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });
    await runPsychologySearch(budgetMs, () => {
      const oppPw = sampleOppPowder(view, knobs.uniformMix);
      for (const c of cands) {
        let sc: number;
        if (myIsFirst(view)) {
          const max = Math.min(view.my.chips, firstMaxBet(view.opp.chips));
          const jamMark = leftoverLeader(addTotals(view.leftover, c.powder));
          const jam = max > 0 ? focusBet(jamMark, max) : zeroBet();
          const oppSec = greedyOppSecond(view, view.leftover, oppPw, c.powder, jam);
          const pJam = evalBoard(view.leftover, c.powder, oppPw, jam, oppSec, view.my.chips, view.opp.chips);
          const oppSec0 = greedyOppSecond(view, view.leftover, oppPw, c.powder, zeroBet());
          const pCheck = evalBoard(view.leftover, c.powder, oppPw, zeroBet(), oppSec0, view.my.chips, view.opp.chips);
          sc = Math.max(pJam, pCheck);
        } else {
          const oppFirst = greedyOppFirst(view, view.leftover, oppPw, c.powder);
          const min = secondMinBet(sumBet(oppFirst));
          const tot = Math.min(view.my.chips, min === 0 ? Math.min(2, view.my.chips) : min);
          const mark = leftoverLeader(addTotals(view.leftover, c.powder));
          const myBet = tot > 0 ? focusBet(mark, tot) : zeroBet();
          sc = evalBoard(view.leftover, c.powder, oppPw, myBet, oppFirst, view.my.chips, view.opp.chips);
        }
        const a = acc.get(c.key)!;
        a.sum += sc;
        a.n += 1;
      }
    }, { batchSize: 8 });
    const scored = [...acc.values()].filter((a) => a.n > 0).map((a) => ({ cand: a.cand, score: a.sum / a.n }));
    const picked = scored.length ? pickSoftmax(scored, tier, knobs.softmaxTemp).powder : zeroPowder();
    if (sumPowder(picked) > view.my.powderRemain) return { type: 'submitPowder', powder: zeroPowder() };
    return { type: 'submitPowder', powder: picked };
  }

  if (view.phase === 'betFirst') {
    if (!myIsFirst(view) || view.my.betConfirmed) return null;
    const myPw = myRoundPowder(view);
    const cands = firstBetCandidates(view);
    const acc = new Map<string, { cand: BetCand; sum: number; n: number }>();
    for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });
    await runPsychologySearch(budgetMs, () => {
      const oppPw = sampleOppPowder(view, knobs.uniformMix);
      for (const c of cands) {
        const oppSec = greedyOppSecond(view, view.leftover, oppPw, myPw, c.bet);
        const sc = evalBoard(view.leftover, myPw, oppPw, c.bet, oppSec, view.my.chips, view.opp.chips);
        const a = acc.get(c.key)!;
        a.sum += sc;
        a.n += 1;
      }
    }, { batchSize: 16 });
    const scored = [...acc.values()].filter((a) => a.n > 0).map((a) => ({ cand: a.cand, score: a.sum / a.n }));
    const picked = scored.length ? pickSoftmax(scored, tier, knobs.softmaxTemp).bet : zeroBet();
    const max = Math.min(view.my.chips, firstMaxBet(view.opp.chips));
    if (sumBet(picked) > max) return { type: 'submitBet', bet: zeroBet() };
    return { type: 'submitBet', bet: picked };
  }

  if (view.phase === 'betSecond') {
    if (myIsFirst(view) || view.my.betConfirmed) return null;
    const myPw = myRoundPowder(view);
    const first = view.opp.publicBet ?? zeroBet();
    const cands = secondBetCandidates(view);
    const acc = new Map<string, { cand: BetCand; sum: number; n: number }>();
    for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });
    await runPsychologySearch(budgetMs, () => {
      const oppPw = sampleOppPowder(view, knobs.uniformMix);
      for (const c of cands) {
        const sc = evalBoard(view.leftover, myPw, oppPw, c.bet, first, view.my.chips, view.opp.chips);
        const a = acc.get(c.key)!;
        a.sum += sc;
        a.n += 1;
      }
    }, { batchSize: 16 });
    const scored = [...acc.values()].filter((a) => a.n > 0).map((a) => ({ cand: a.cand, score: a.sum / a.n }));
    const picked = scored.length ? pickSoftmax(scored, tier, knobs.softmaxTemp).bet : zeroBet();
    const min = secondMinBet(sumBet(first));
    if (sumBet(picked) < min) {
      const mark = leftoverLeader(addTotals(view.leftover, myPw));
      return { type: 'submitBet', bet: focusBet(mark, Math.min(view.my.chips, min)) };
    }
    return { type: 'submitBet', bet: picked };
  }

  return null;
}
