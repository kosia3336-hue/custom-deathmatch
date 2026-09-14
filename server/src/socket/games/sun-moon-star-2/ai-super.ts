/* 해달별2 슈퍼 자문: 표시등·보드·칩만. 정확 빛가루·이번 분배 금지. 한 라운드 EV 금지. COM ai.ts 안 씀. */
import type {
  SMS2ChipBet,
  SMS2MarkId,
  SMS2PowderStage,
  SMS2PowderSubmission,
} from '@shared/types/sun-moon-star-2.js';
import {
  MARK_IDS,
  decideLitMark,
  firstMaxBet,
  secondMinBet,
  sms2ApplyChipDelta,
  sms2FocusBet,
  sms2FocusPowder,
  sms2IsPowderStage,
  sms2PowderSoftCap,
  sms2SpentByStage,
  sms2StageKeepSpend,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
} from '@shared/types/sun-moon-star-2.js';
import {
  sms2AdvisorAsk,
  sms2AdvisorRoundLegal,
  sms2AdvisorSnapshot,
  sms2ParseAdvisorRound,
  sms2ParseBet,
  sms2ParsePowder,
  type Sms2AdvisorPending,
  type Sms2AdvisorRound,
  type Sms2AdvisorSnapshot,
} from '@shared/types/sun-moon-star-2-advisor.js';

export const SMS2_SUPER_THINK_MS = 90_000;
const MIX = 0.5;

export type Sms2AdvisorPick =
  | { kind: 'powder'; powder: SMS2PowderSubmission; winRate: number }
  | { kind: 'bet'; bet: SMS2ChipBet; winRate: number };

function leftoverLeader(left: SMS2PowderSubmission): SMS2MarkId {
  return decideLitMark(left).mark;
}

function addPowder(a: SMS2PowderSubmission, b: SMS2PowderSubmission): SMS2PowderSubmission {
  return { sun: a.sun + b.sun, moon: a.moon + b.moon, star: a.star + b.star };
}

function pWinChips(my: number, opp: number, left: number, myPw: number, oppStage: SMS2PowderStage): number {
  if (my <= 0 && opp <= 0) return 0.5;
  if (my <= 0) return 0;
  if (opp <= 0) return 1;
  if (left <= 0) {
    if (my > opp) return 1;
    if (my < opp) return 0;
    return 0.5;
  }
  const fuel = (myPw / Math.max(1, left) - (oppStage * 8) / Math.max(1, left)) / 20;
  const x = (my - opp) / 5 + fuel * 0.35;
  if (x > 8) return 1;
  if (x < -8) return 0;
  return 1 / (1 + Math.exp(-x));
}

function evalBoard(
  leftover: SMS2PowderSubmission,
  myPw: SMS2PowderSubmission,
  oppPw: SMS2PowderSubmission,
  myBet: SMS2ChipBet,
  oppBet: SMS2ChipBet,
  myChips: number,
  oppChips: number,
  leftAfter: number,
  myRemainAfter: number,
  oppStageAfter: SMS2PowderStage,
): number {
  const totals = addPowder(leftover, addPowder(myPw, oppPw));
  const lit = decideLitMark(totals).mark;
  const my = sms2ApplyChipDelta(myChips, myBet, lit);
  const opp = sms2ApplyChipDelta(oppChips, oppBet, lit);
  return pWinChips(my, opp, leftAfter, myRemainAfter, oppStageAfter);
}

function powderCandidates(snap: Sms2AdvisorSnapshot): SMS2PowderSubmission[] {
  const remain = snap.my.powderRemain;
  const roundsLeft = Math.max(1, snap.maxRound - snap.round + 1);
  const cap = sms2PowderSoftCap(remain, roundsLeft);
  const out: SMS2PowderSubmission[] = [];
  const seen = new Set<string>();
  const push = (powder: SMS2PowderSubmission) => {
    const key = `${powder.sun}:${powder.moon}:${powder.star}`;
    if (seen.has(key)) return;
    if (sumPowder(powder) > remain || sumPowder(powder) > cap) return;
    seen.add(key);
    out.push(powder);
  };
  push(zeroPowder());
  if (remain <= 0 || cap <= 0) return out;

  const amounts = new Set<number>();
  for (const a of [1, 2, 5, 10, 11, 19, 20]) {
    if (a <= cap) amounts.add(a);
  }
  const keep = sms2StageKeepSpend(remain);
  if (keep > 0 && keep <= cap) amounts.add(keep);
  const lead = leftoverLeader(snap.leftover);
  const steal = snap.leftover[lead] + 1;
  if (steal > 0 && steal <= cap) amounts.add(steal);
  if (roundsLeft <= 2 && remain <= cap) amounts.add(remain);

  for (const mark of MARK_IDS) {
    for (const a of amounts) {
      if (a > 0) push(sms2FocusPowder(mark, a));
    }
  }
  if (20 <= cap && remain >= 20) {
    push({ sun: 10, moon: 10, star: 0 });
    push({ sun: 10, moon: 0, star: 10 });
    push({ sun: 0, moon: 10, star: 10 });
  }
  return out;
}

function oppPowderWorlds(
  leftover: SMS2PowderSubmission,
  spentMin: number,
  spentMax: number,
): SMS2PowderSubmission[] {
  const cap = Math.min(40, spentMax);
  const tots = [0, 1, 2, 5, 10, 19, 20].filter((t) => t >= spentMin && t <= cap);
  if (tots.length === 0) tots.push(Math.min(cap, spentMin));
  const out: SMS2PowderSubmission[] = [];
  const seen = new Set<string>();
  const push = (p: SMS2PowderSubmission) => {
    const k = `${p.sun}:${p.moon}:${p.star}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  const lead = leftoverLeader(leftover);
  for (const tot of tots) {
    if (tot <= 0) {
      push(zeroPowder());
      continue;
    }
    push(sms2FocusPowder(lead, tot));
    push(sms2FocusPowder('sun', tot));
  }
  return out;
}

function firstBetCands(myChips: number, oppChips: number): SMS2ChipBet[] {
  const max = Math.min(myChips, firstMaxBet(oppChips));
  if (max <= 0) return [zeroBet()];
  const out: SMS2ChipBet[] = [zeroBet()];
  for (const mark of MARK_IDS) out.push(sms2FocusBet(mark, max));
  return out;
}

function secondBetCands(myChips: number, first: SMS2ChipBet): SMS2ChipBet[] {
  const min = secondMinBet(sumBet(first));
  const amounts = new Set<number>();
  if (min === 0) {
    amounts.add(0);
    if (myChips >= 2) amounts.add(2);
    if (myChips >= 4) amounts.add(4);
    amounts.add(Math.min(8, myChips));
    amounts.add(myChips);
  } else {
    amounts.add(Math.min(myChips, min));
    if (myChips > min) amounts.add(myChips);
  }
  const out: SMS2ChipBet[] = [];
  const seen = new Set<string>();
  const push = (bet: SMS2ChipBet) => {
    const t = sumBet(bet);
    if (t < min || t > myChips) return;
    const k = `${bet.sun}:${bet.moon}:${bet.star}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(bet);
  };
  for (const t of amounts) {
    if (t === 0) {
      push(zeroBet());
      continue;
    }
    for (const mark of MARK_IDS) push(sms2FocusBet(mark, t));
  }
  if (out.length === 0) push(sms2FocusBet('sun', Math.min(myChips, min)));
  return out;
}

function greedyOppSecond(
  leftover: SMS2PowderSubmission,
  myPw: SMS2PowderSubmission,
  oppPw: SMS2PowderSubmission,
  myFirst: SMS2ChipBet,
  oppChips: number,
): SMS2ChipBet {
  const min = secondMinBet(sumBet(myFirst));
  const use = min === 0 ? Math.min(oppChips, 8) : Math.min(oppChips, min);
  if (use <= 0) return zeroBet();
  const lit = leftoverLeader(addPowder(leftover, addPowder(myPw, oppPw)));
  return sms2FocusBet(lit, use);
}

function greedyOppFirst(
  leftover: SMS2PowderSubmission,
  myPw: SMS2PowderSubmission,
  oppPw: SMS2PowderSubmission,
  oppChips: number,
  myChips: number,
): SMS2ChipBet {
  const max = Math.min(oppChips, firstMaxBet(myChips));
  if (max <= 0) return zeroBet();
  const lit = leftoverLeader(addPowder(leftover, addPowder(myPw, oppPw)));
  return sms2FocusBet(lit, max);
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

function canSuicide(myChips: number, bet: SMS2ChipBet, values: number[]): boolean {
  if (sumBet(bet) < myChips) return false;
  return values.some((v) => v <= 0.02);
}

function pickBest<T>(
  cands: T[],
  scoreOf: (c: T) => number[],
  costOf: (c: T) => number,
  myChips?: number,
  asBet?: (c: T) => SMS2ChipBet | null,
): { cand: T; winRate: number } {
  let best = cands[0]!;
  let bestEv = -Infinity;
  let bestCost = Infinity;
  for (const c of cands) {
    const vs = scoreOf(c);
    if (myChips != null && asBet) {
      const bet = asBet(c);
      if (bet && canSuicide(myChips, bet, vs) && cands.length > 1) continue;
    }
    const ev = scoreMixWorst(vs);
    const cost = costOf(c);
    if (ev > bestEv + 1e-6 || (Math.abs(ev - bestEv) <= 1e-6 && cost < bestCost)) {
      bestEv = ev;
      bestCost = cost;
      best = c;
    }
  }
  return { cand: best, winRate: Math.min(1, Math.max(0, bestEv === -Infinity ? 0.5 : bestEv)) };
}

function oppWorldsForPowder(snap: Sms2AdvisorSnapshot): SMS2PowderSubmission[] {
  const range = sms2SpentByStage(snap.opp.powderStage, 1);
  return oppPowderWorlds(snap.leftover, 0, Math.min(40, range.max));
}

function oppWorldsForBet(snap: Sms2AdvisorSnapshot, stageAfter: SMS2PowderStage): SMS2PowderSubmission[] {
  const range = sms2SpentByStage(snap.opp.powderStage, stageAfter);
  return oppPowderWorlds(snap.leftover, range.min, range.max);
}

function pickPowder(snap: Sms2AdvisorSnapshot): Sms2AdvisorPick {
  const cands = powderCandidates(snap);
  const worlds = oppWorldsForPowder(snap);
  const left = Math.max(0, snap.maxRound - snap.round);
  const scored = pickBest(
    cands,
    (pw) => worlds.map((oppPw) => {
      const mark = leftoverLeader(addPowder(snap.leftover, pw));
      const myBet = snap.iAmFirst
        ? sms2FocusBet(mark, Math.min(snap.my.chips, firstMaxBet(snap.opp.chips)))
        : sms2FocusBet(mark, Math.min(snap.my.chips, 8));
      const oppBet = snap.iAmFirst
        ? greedyOppSecond(snap.leftover, pw, oppPw, myBet, snap.opp.chips)
        : greedyOppFirst(snap.leftover, pw, oppPw, snap.opp.chips, snap.my.chips);
      return evalBoard(
        snap.leftover, pw, oppPw, myBet, oppBet, snap.my.chips, snap.opp.chips,
        left, snap.my.powderRemain - sumPowder(pw), snap.opp.powderStage,
      );
    }),
    (pw) => sumPowder(pw),
  );
  return { kind: 'powder', powder: scored.cand, winRate: scored.winRate };
}

function pickFirstBet(
  snap: Sms2AdvisorSnapshot,
  myPw: SMS2PowderSubmission,
  stageAfter: SMS2PowderStage,
): Sms2AdvisorPick {
  const cands = firstBetCands(snap.my.chips, snap.opp.chips);
  const worlds = oppWorldsForBet(snap, stageAfter);
  const left = Math.max(0, snap.maxRound - snap.round);
  const scored = pickBest(
    cands,
    (bet) => worlds.map((oppPw) => {
      const oppSec = greedyOppSecond(snap.leftover, myPw, oppPw, bet, snap.opp.chips);
      return evalBoard(
        snap.leftover, myPw, oppPw, bet, oppSec, snap.my.chips, snap.opp.chips,
        left, snap.my.powderRemain - sumPowder(myPw), stageAfter,
      );
    }),
    (bet) => sumBet(bet),
    snap.my.chips,
    (bet) => bet,
  );
  return { kind: 'bet', bet: scored.cand, winRate: scored.winRate };
}

function pickSecondBet(
  snap: Sms2AdvisorSnapshot,
  myPw: SMS2PowderSubmission,
  first: SMS2ChipBet,
  stageAfter: SMS2PowderStage,
): Sms2AdvisorPick {
  const cands = secondBetCands(snap.my.chips, first);
  const worlds = oppWorldsForBet(snap, stageAfter);
  const left = Math.max(0, snap.maxRound - snap.round);
  const scored = pickBest(
    cands,
    (bet) => worlds.map((oppPw) => evalBoard(
      snap.leftover, myPw, oppPw, bet, first, snap.my.chips, snap.opp.chips,
      left, snap.my.powderRemain - sumPowder(myPw), stageAfter,
    )),
    (bet) => sumBet(bet),
    snap.my.chips,
    (bet) => bet,
  );
  return { kind: 'bet', bet: scored.cand, winRate: scored.winRate };
}

export function pickSunMoonStar2Advisor(
  iAmFirstStart: boolean,
  history: Sms2AdvisorRound[],
  pending: Sms2AdvisorPending | undefined,
  _timeLimitMs: number,
): Sms2AdvisorPick {
  const snap = sms2AdvisorSnapshot(iAmFirstStart, history);
  const ask = sms2AdvisorAsk(iAmFirstStart, history, pending);
  const p = pending ?? {};

  if (snap.result.kind !== 'playing') {
    return { kind: 'powder', powder: zeroPowder(), winRate: snap.result.kind === 'win' ? 1 : 0 };
  }

  if (ask === 'powder') {
    const pick = pickPowder(snap);
    console.info(`[SMS2 advisor] r=${snap.round} powder=${sumPowder(pick.powder)} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  const myPw = p.myPowder ?? zeroPowder();
  const stageAfter = p.oppStageAfter ?? snap.opp.powderStage;

  if (ask === 'betFirst') {
    const pick = pickFirstBet(snap, myPw, stageAfter);
    console.info(`[SMS2 advisor] r=${snap.round} firstBet=${sumBet(pick.bet)} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  if (ask === 'betSecond') {
    const first = p.oppFirstBet ?? zeroBet();
    const pick = pickSecondBet(snap, myPw, first, stageAfter);
    console.info(`[SMS2 advisor] r=${snap.round} secondBet=${sumBet(pick.bet)} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  return { kind: 'powder', powder: zeroPowder(), winRate: 0.5 };
}

export function parseAdvisorHistory(raw: unknown, iAmFirstStart = true): Sms2AdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > 12) return null;
  const out: Sms2AdvisorRound[] = [];
  for (const row of raw) {
    const rec = sms2ParseAdvisorRound(row);
    if (!rec) return null;
    const snap = sms2AdvisorSnapshot(iAmFirstStart, out);
    if (!sms2AdvisorRoundLegal(snap, rec)) return null;
    out.push(rec);
  }
  return out;
}

export function parsePending(raw: unknown): Sms2AdvisorPending | null {
  if (raw == null) return {};
  if (typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if ('oppPowder' in rec || 'oppPowderRemain' in rec || 'pendingPowder' in rec) return null;
  const out: Sms2AdvisorPending = {};
  if (rec.myPowder != null) {
    const p = sms2ParsePowder(rec.myPowder);
    if (!p) return null;
    out.myPowder = p;
  }
  if (rec.oppStageAfter != null) {
    if (!sms2IsPowderStage(rec.oppStageAfter)) return null;
    out.oppStageAfter = rec.oppStageAfter;
  }
  if (rec.myBet != null) {
    const b = sms2ParseBet(rec.myBet);
    if (!b) return null;
    out.myBet = b;
  }
  if (rec.oppFirstBet != null) {
    const b = sms2ParseBet(rec.oppFirstBet);
    if (!b) return null;
    out.oppFirstBet = b;
  }
  return out;
}

export interface Sms2SuperWorkerRequest {
  iAmFirst: boolean;
  history: Sms2AdvisorRound[];
  pending?: Sms2AdvisorPending;
  timeLimitMs?: number;
}

export interface Sms2SuperWorkerResponse extends Sms2AdvisorPick {}
