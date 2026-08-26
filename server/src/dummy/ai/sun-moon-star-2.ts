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
  powderStageOf,
  powderStageRange,
  secondMinBet,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
} from '@shared/types/sun-moon-star-2.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-013 · multi · 404판 / 3772 player-round.
 * 빛가루 총량 0·20·1·19. 한 표식 28g·후 체크 뒤 0/2/3만은 사람이 안 씀.
 * 이번 상대 빛가루 분배·정확 잔량은 안 본다.
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
  leftover: SMS2PowderSubmission;
  oppStageStart: SMS2PowderStage;
  history: SMS2RoundRecord[];
  winner: string | 'draw' | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type PowderCand = { powder: SMS2PowderSubmission; key: string };
type BetCand = { bet: SMS2ChipBet; key: string };

/** 기보 빛가루 총량 (상위). 1g가 20g 다음 */
const GIBO_POWDER_TOT: Array<{ tot: number; n: number }> = [
  { tot: 0, n: 1051 },
  { tot: 20, n: 476 },
  { tot: 1, n: 318 },
  { tot: 19, n: 308 },
  { tot: 10, n: 136 },
  { tot: 2, n: 106 },
  { tot: 5, n: 104 },
  { tot: 21, n: 94 },
  { tot: 25, n: 81 },
  { tot: 11, n: 79 },
  { tot: 30, n: 79 },
  { tot: 6, n: 57 },
  { tot: 3, n: 53 },
  { tot: 15, n: 51 },
];

const GIBO_PRIOR = 0.08;

function tierKnobs(tier: DummyAiTier): { uniformMix: number; softmaxTemp: number } {
  if (tier === '하') return { uniformMix: 0.36, softmaxTemp: 0.07 };
  if (tier === '중') return { uniformMix: 0.08, softmaxTemp: 0.016 };
  return { uniformMix: 0.03, softmaxTemp: 0.01 };
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1 / (1 + Math.exp(-x));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function weightedPick<T>(items: readonly T[], weight: (t: T) => number): T {
  let sum = 0;
  const ws = items.map(weight);
  for (const w of ws) sum += Math.max(0, w);
  if (sum <= 0) return items[Math.floor(Math.random() * items.length)]!;
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, ws[i]!);
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

export function leftoverTotals(history: SMS2RoundRecord[]): SMS2PowderSubmission {
  const last = history.at(-1);
  return last ? { ...last.markTotalsAfter } : zeroPowder();
}

/** R1 p90=27. cap을 후보 금액으로 쓰지 않는다. */
export function powderSoftCap(remain: number, roundsLeft: number): number {
  if (remain <= 0) return 0;
  if (roundsLeft <= 1) return remain;
  if (roundsLeft >= 7) return Math.min(remain, 27);
  if (roundsLeft >= 5) return Math.min(remain, 22);
  if (roundsLeft >= 3) return Math.min(remain, 20);
  return remain;
}

/** 표시등 단계를 안 떨어뜨리는 최대 지출. 잔여 100 → 19. */
export function stageKeepSpend(remain: number): number {
  if (remain <= 0) return 0;
  const { min } = powderStageRange(powderStageOf(remain));
  return Math.max(0, remain - min);
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

function leftoverLeader(left: SMS2PowderSubmission): SMS2MarkId {
  return decideLitMark(left).mark;
}

function giboTotWeight(tot: number): number {
  return GIBO_POWDER_TOT.find((x) => x.tot === tot)?.n ?? (tot === 0 ? 1 : 4);
}

export function powderCandidates(view: SunMoonStar2DummyView): PowderCand[] {
  const remain = view.my.powderRemain;
  const roundsLeft = Math.max(1, view.maxRound - view.round + 1);
  const cap = powderSoftCap(remain, roundsLeft);
  const out: PowderCand[] = [];
  const seen = new Set<string>();
  const push = (powder: SMS2PowderSubmission) => {
    const key = `pw:${powder.sun}:${powder.moon}:${powder.star}`;
    if (seen.has(key)) return;
    if (sumPowder(powder) > remain) return;
    if (sumPowder(powder) > cap && roundsLeft > 1) return;
    seen.add(key);
    out.push({ powder, key });
  };

  push(zeroPowder());
  if (remain <= 0 || cap <= 0) return out;

  const amounts = new Set<number>();
  for (const a of [1, 2, 5, 10, 11, 19, 20]) {
    if (a > 0 && a <= cap) amounts.add(a);
  }
  const keep = stageKeepSpend(remain);
  if (keep > 0 && keep <= cap) amounts.add(keep);

  const lead = leftoverLeader(view.leftover);
  const leadV = view.leftover[lead];
  if (leadV > 0) {
    const steal = leadV + 1;
    if (steal <= cap) amounts.add(steal);
  }

  if (roundsLeft <= 2 && remain <= cap) amounts.add(remain);

  for (const mark of MARK_IDS) {
    for (const a of amounts) {
      if (a <= 0) continue;
      push(focusPowder(mark, a));
    }
  }

  // 기보 쪼개기 최다: 10+10
  if (20 <= cap && remain >= 20) {
    push({ sun: 10, moon: 10, star: 0 });
    push({ sun: 10, moon: 0, star: 10 });
    push({ sun: 0, moon: 10, star: 10 });
  }

  return out;
}

function sampleOppPowder(
  view: SunMoonStar2DummyView,
  uniformMix: number,
): SMS2PowderSubmission {
  const cap = 40;
  const totPick = weightedPick(GIBO_POWDER_TOT, (x) => {
    if (x.tot > cap) return 0;
    return x.n * (1 - uniformMix) + 30 * uniformMix;
  }).tot;
  const tot = clampInt(totPick, 0, cap);
  if (tot <= 0) return zeroPowder();

  if (tot === 20 && Math.random() < 0.07) {
    const pairs: SMS2PowderSubmission[] = [
      { sun: 10, moon: 10, star: 0 },
      { sun: 10, moon: 0, star: 10 },
      { sun: 0, moon: 10, star: 10 },
    ];
    return pairs[Math.floor(Math.random() * pairs.length)]!;
  }

  let mark: SMS2MarkId = leftoverLeader(view.leftover);
  const u = Math.random();
  if (u < 0.12 + uniformMix * 0.2) {
    mark = MARK_IDS[Math.floor(Math.random() * 3)]!;
  } else if (sumPowder(view.leftover) === 0 && u < 0.55) {
    mark = MARK_IDS[Math.floor(Math.random() * 3)]!;
  }
  return focusPowder(mark, tot);
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
  if (Math.random() < 0.38) return zeroBet();
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
  const chips = view.opp.chips;
  let tot: number;
  if (min === 0) {
    const roll = Math.random();
    if (roll < 0.17) tot = 0;
    else if (roll < 0.41) tot = Math.min(chips, 8);
    else if (roll < 0.49) tot = Math.min(chips, 4);
    else tot = Math.min(chips, chips);
  } else {
    tot = Math.min(chips, Math.random() < 0.55 ? min : chips);
  }
  if (tot <= 0) return zeroBet();
  const totals = addTotals(leftover, addTotals(myPw, oppPw));
  const mark = decideLitMark(totals).mark;
  if (sumBet(myFirst) > 0 && Math.random() < 0.35) {
    const firstMark = MARK_IDS.reduce((a, m) => (myFirst[m] > myFirst[a] ? m : a), 'sun' as SMS2MarkId);
    return focusBet(firstMark, tot);
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
  if (min === 0) {
    amounts.add(0);
    if (chips >= 2) amounts.add(2);
    if (chips >= 4) amounts.add(4);
    if (chips >= 8) amounts.add(8);
    amounts.add(chips);
  } else {
    amounts.add(Math.min(chips, min));
    if (chips > min) amounts.add(chips);
  }
  const out: BetCand[] = [];
  const seen = new Set<string>();
  const pushBet = (bet: SMS2ChipBet) => {
    const t = sumBet(bet);
    if (t < min || t > chips) return;
    const key = `bet:${bet.sun}:${bet.moon}:${bet.star}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ bet, key });
  };
  for (const t of amounts) {
    if (t === 0) {
      pushBet(zeroBet());
      continue;
    }
    for (const mark of MARK_IDS) {
      pushBet(focusBet(mark, t));
      if (t >= 3) {
        const hedge = focusBet(mark, t - 2);
        const others = MARK_IDS.filter((m) => m !== mark);
        hedge[others[0]!] += 1;
        hedge[others[1]!] += 1;
        pushBet(hedge);
      }
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

function powderFuelScore(spent: number, remain: number, roundsLeft: number): number {
  if (roundsLeft <= 1) return 0;
  const left = remain - spent;
  const pace = left / (roundsLeft - 1);
  let s = 0;
  if (pace < 4 && roundsLeft >= 4) s -= (4 - pace) * 0.02;
  if (spent >= 25 && roundsLeft >= 8) s -= 0.12;
  if (spent === 1) s += 0.04;
  s += GIBO_PRIOR * Math.log(1 + giboTotWeight(spent));
  return s;
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
  const roundsLeft = Math.max(1, view.maxRound - view.round + 1);

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
          const tot = Math.min(view.my.chips, min === 0 ? Math.min(8, view.my.chips) : min);
          const mark = leftoverLeader(addTotals(view.leftover, c.powder));
          const myBet = tot > 0 ? focusBet(mark, tot) : zeroBet();
          sc = evalBoard(view.leftover, c.powder, oppPw, myBet, oppFirst, view.my.chips, view.opp.chips);
        }
        sc += powderFuelScore(sumPowder(c.powder), view.my.powderRemain, roundsLeft);
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
