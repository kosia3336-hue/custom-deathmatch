/* 은행놀이 슈퍼 자문: 상대 권종·승자 금액 금지. 선 장수만. 한 라운드 EV 금지. COM ai.ts 안 씀. */
import type { BankBet } from '@shared/types/bank-game.js';
import {
  bankAmountSoftCap,
  bankMaxCountForRound,
  bankMaxValueWithNotes,
  bankMinNote,
  cloneBet,
  sumBetAmount,
  sumBetCount,
  sumInventoryCount,
  validateBet,
  zeroBet,
} from '@shared/types/bank-game.js';
import {
  bankAdvisorAsk,
  bankAdvisorRoundLegal,
  bankAdvisorSnapshot,
  bankOppRemainBounds,
  bankParseAdvisorRound,
  bankParseBet,
  type BankAdvisorPending,
  type BankAdvisorRound,
  type BankAdvisorSnapshot,
} from '@shared/types/bank-game-advisor.js';

export const BANK_SUPER_THINK_MS = 90_000;
const MIX = 0.5;

export type BankAdvisorPick = { bet: BankBet; winRate: number };

function betKey(b: BankBet): string {
  return `${b[10000]}-${b[5000]}-${b[3000]}-${b[1000]}`;
}

function roundsLeftIncl(snap: BankAdvisorSnapshot): number {
  return Math.max(1, snap.maxRound - snap.round + 1);
}

function isLockedWin(snap: BankAdvisorSnapshot): boolean {
  return snap.my.score > snap.opp.score + roundsLeftIncl(snap);
}

function isLockedLoss(snap: BankAdvisorSnapshot): boolean {
  return snap.opp.score > snap.my.score + roundsLeftIncl(snap);
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1 / (1 + Math.exp(-x));
}

function gameWinProb(
  myScore: number,
  oppScore: number,
  myFuel: number,
  oppFuel: number,
  roundsLeft: number,
): number {
  if (myScore > oppScore + roundsLeft) return 1;
  if (oppScore > myScore + roundsLeft) return 0;
  if (roundsLeft <= 0) {
    if (myScore > oppScore) return 1;
    if (myScore < oppScore) return 0;
    return 0.5;
  }
  const paceMy = myFuel / roundsLeft;
  const paceOpp = oppFuel / roundsLeft;
  const x = (myScore - oppScore) * 1.4 + (paceMy - paceOpp) / 11000;
  return sigmoid(x);
}

function evalAmounts(
  snap: BankAdvisorSnapshot,
  myAmt: number,
  oppAmt: number,
  oppRemainBefore: number,
): number {
  let myScore = snap.my.score;
  let oppScore = snap.opp.score;
  if (myAmt > oppAmt) myScore += 1;
  else if (myAmt < oppAmt) oppScore += 1;
  const myFuel = Math.max(0, snap.my.inventoryAmount - myAmt);
  const oppFuel = Math.max(0, oppRemainBefore - oppAmt);
  const after = Math.max(0, snap.maxRound - snap.round);
  return gameWinProb(myScore, oppScore, myFuel, oppFuel, after);
}

function enumerateMixes(inv: BankBet, maxCount: number, maxAmount: number): BankBet[] {
  const out: BankBet[] = [];
  if (maxCount <= 0 || maxAmount < 0) return out;
  const cap10 = Math.min(inv[10000], maxCount);
  for (let n10 = 0; n10 <= cap10; n10++) {
    const cap5 = Math.min(inv[5000], maxCount - n10);
    for (let n5 = 0; n5 <= cap5; n5++) {
      const cap3 = Math.min(inv[3000], maxCount - n10 - n5);
      for (let n3 = 0; n3 <= cap3; n3++) {
        const used = n10 + n5 + n3;
        const cap1 = Math.min(inv[1000], maxCount - used);
        for (let n1 = 0; n1 <= cap1; n1++) {
          const count = used + n1;
          if (count <= 0) continue;
          const amt = n10 * 10000 + n5 * 5000 + n3 * 3000 + n1 * 1000;
          if (amt > maxAmount) continue;
          out.push({ 10000: n10, 5000: n5, 3000: n3, 1000: n1 });
        }
      }
    }
  }
  return out;
}

function pushCand(out: BankBet[], seen: Set<string>, bet: BankBet, inv: BankBet): void {
  if (!validateBet(bet, inv).ok) return;
  const key = betKey(bet);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(cloneBet(bet));
}

function firstCandidates(snap: BankAdvisorSnapshot): BankBet[] {
  const inv = snap.my.inventory;
  const remain = snap.my.inventoryAmount;
  const left = roundsLeftIncl(snap);
  const cap = bankAmountSoftCap(remain, left, snap.my.score - snap.opp.score);
  const maxCount = bankMaxCountForRound(snap.my.inventoryCount, left);
  const seen = new Set<string>();
  const out: BankBet[] = [];

  if (isLockedWin(snap) || isLockedLoss(snap)) {
    pushCand(out, seen, zeroBet(), inv);
    if (out.length === 0) pushCand(out, seen, bankMinNote(inv), inv);
    return out;
  }

  if (sumInventoryCount(inv) <= 0 || remain <= 0) {
    pushCand(out, seen, zeroBet(), inv);
    return out;
  }

  for (const mix of enumerateMixes(inv, maxCount, cap)) {
    const c = sumBetCount(mix);
    if (c < 2 && left > 1) continue;
    pushCand(out, seen, mix, inv);
  }
  if (left <= 1) pushCand(out, seen, cloneBet(inv), inv);
  if (out.length === 0) {
    const min = bankMinNote(inv);
    if (sumBetCount(min) > 0) pushCand(out, seen, min, inv);
    else pushCand(out, seen, zeroBet(), inv);
  }
  return out;
}

function secondCandidates(snap: BankAdvisorSnapshot, firstCount: number): BankBet[] {
  const inv = snap.my.inventory;
  const remain = snap.my.inventoryAmount;
  const left = roundsLeftIncl(snap);
  const cap = bankAmountSoftCap(remain, left, snap.my.score - snap.opp.score);
  const maxCount = bankMaxCountForRound(snap.my.inventoryCount, left);
  const seen = new Set<string>();
  const out: BankBet[] = [];

  pushCand(out, seen, zeroBet(), inv);
  if (sumInventoryCount(inv) <= 0) return out;
  if (isLockedWin(snap) || isLockedLoss(snap)) return out;

  if (firstCount <= 0) {
    pushCand(out, seen, bankMinNote(inv), inv);
    return out;
  }

  for (const mix of enumerateMixes(inv, maxCount, cap)) {
    pushCand(out, seen, mix, inv);
  }
  if (left <= 1) pushCand(out, seen, cloneBet(inv), inv);
  return out;
}

function typicalAmountForCount(count: number, minA: number, maxA: number): number {
  if (count <= 0) return 0;
  const mode = count <= 2 ? 7000 : count >= 7 ? 16000 : 12000;
  return Math.max(minA, Math.min(maxA, Math.round(mode / 1000) * 1000));
}

function oppRemainWorlds(snap: BankAdvisorSnapshot): number[] {
  const { min, max } = bankOppRemainBounds(snap);
  const mid = Math.round(((min + max) / 2) / 1000) * 1000;
  const out = [min, mid, max].filter((v, i, a) => a.indexOf(v) === i);
  return out.length > 0 ? out : [min];
}

function firstAmountWorlds(count: number, oppRemain: number): number[] {
  if (count <= 0) return [0];
  const minA = count * 1000;
  const maxA = Math.min(oppRemain, bankMaxValueWithNotes(count));
  if (maxA < minA) return [Math.min(oppRemain, minA)];
  const mid = typicalAmountForCount(count, minA, maxA);
  return [minA, mid, maxA].filter((v, i, a) => a.indexOf(v) === i);
}

function secondAmountWorlds(myAmt: number, myCount: number, oppRemain: number): number[] {
  if (oppRemain <= 0) return [0];
  if (myCount <= 0) return [0, Math.min(1000, oppRemain)];
  const fold = 0;
  const over = Math.min(oppRemain, myAmt + 1000);
  const beat = Math.min(oppRemain, myAmt + 3000);
  return [fold, over, beat].filter((v, i, a) => a.indexOf(v) === i);
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

function pickBest(cands: BankBet[], scoreOf: (b: BankBet) => number[]): { bet: BankBet; winRate: number } {
  let best = cands[0] ?? zeroBet();
  let bestEv = -Infinity;
  let bestCost = Infinity;
  for (const c of cands) {
    const ev = scoreMixWorst(scoreOf(c));
    const cost = sumBetAmount(c);
    if (ev > bestEv + 1e-6 || (Math.abs(ev - bestEv) <= 1e-6 && cost < bestCost)) {
      bestEv = ev;
      bestCost = cost;
      best = c;
    }
  }
  return { bet: best, winRate: Math.min(1, Math.max(0, bestEv === -Infinity ? 0.5 : bestEv)) };
}

function pickFirst(snap: BankAdvisorSnapshot): BankAdvisorPick {
  const cands = firstCandidates(snap);
  const remains = oppRemainWorlds(snap);
  return pickBest(cands, (bet) => {
    const myAmt = sumBetAmount(bet);
    const myCount = sumBetCount(bet);
    const vals: number[] = [];
    for (const oppRemain of remains) {
      for (const oppAmt of secondAmountWorlds(myAmt, myCount, oppRemain)) {
        vals.push(evalAmounts(snap, myAmt, oppAmt, oppRemain));
      }
    }
    return vals;
  });
}

function pickSecond(snap: BankAdvisorSnapshot, firstCount: number): BankAdvisorPick {
  const cands = secondCandidates(snap, firstCount);
  const remains = oppRemainWorlds(snap);
  return pickBest(cands, (bet) => {
    const myAmt = sumBetAmount(bet);
    const vals: number[] = [];
    for (const oppRemain of remains) {
      for (const firstAmt of firstAmountWorlds(firstCount, oppRemain)) {
        vals.push(evalAmounts(snap, myAmt, firstAmt, oppRemain));
      }
    }
    return vals;
  });
}

export function pickBankGameAdvisor(
  iAmFirstStart: boolean,
  history: BankAdvisorRound[],
  pending: BankAdvisorPending | undefined,
  _timeLimitMs: number,
): BankAdvisorPick {
  const snap = bankAdvisorSnapshot(iAmFirstStart, history);
  const ask = bankAdvisorAsk(iAmFirstStart, history, pending);
  const p = pending ?? {};

  if (snap.result.kind !== 'playing') {
    return { bet: zeroBet(), winRate: snap.result.kind === 'win' ? 1 : 0 };
  }

  if (ask === 'betFirst') {
    const pick = pickFirst(snap);
    console.info(`[BANK advisor] r=${snap.round} first amt=${sumBetAmount(pick.bet)} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  if (ask === 'betSecond') {
    const firstCount = p.firstCount ?? 0;
    const pick = pickSecond(snap, firstCount);
    console.info(`[BANK advisor] r=${snap.round} second amt=${sumBetAmount(pick.bet)} firstN=${firstCount} ev=${pick.winRate.toFixed(3)}`);
    return pick;
  }

  return { bet: zeroBet(), winRate: 0.5 };
}

export function parseAdvisorHistory(raw: unknown, iAmFirstStart = true): BankAdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > 12) return null;
  const out: BankAdvisorRound[] = [];
  for (const row of raw) {
    const rec = bankParseAdvisorRound(row);
    if (!rec) return null;
    const snap = bankAdvisorSnapshot(iAmFirstStart, out);
    if (!bankAdvisorRoundLegal(snap, rec)) return null;
    out.push(rec);
  }
  return out;
}

export function parsePending(raw: unknown): BankAdvisorPending | null {
  if (raw == null) return {};
  if (typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  for (const key of ['oppInventory', 'oppBet', 'pendingBet', 'inventoryAmount', 'firstAmount', 'secondAmount'] as const) {
    if (key in rec) return null;
  }
  const out: BankAdvisorPending = {};
  if (rec.firstCount != null) {
    if (typeof rec.firstCount !== 'number' || !Number.isInteger(rec.firstCount) || rec.firstCount < 0 || rec.firstCount > 40) {
      return null;
    }
    out.firstCount = rec.firstCount;
  }
  if (rec.myBet != null) {
    const b = bankParseBet(rec.myBet);
    if (!b) return null;
    out.myBet = b;
  }
  return out;
}

export interface BankSuperWorkerRequest {
  iAmFirst: boolean;
  history: BankAdvisorRound[];
  pending?: BankAdvisorPending;
  timeLimitMs?: number;
}

export interface BankSuperWorkerResponse extends BankAdvisorPick {}
