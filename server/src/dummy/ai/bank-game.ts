import type { DummyAiTier } from '@shared/dummy.js';
import type {
  BankAction,
  BankBet,
  BankPhase,
  BankRoundResult,
  BankSide,
} from '@shared/types/bank-game.js';
import {
  BANK_DENOMINATIONS,
  BANK_INITIAL_TOTAL_AMOUNT,
  BANK_INITIAL_INVENTORY,
  sumBetAmount,
  sumBetCount,
  sumInventoryCount,
  validateBet,
  zeroBet,
} from '@shared/types/bank-game.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-014 · multi · 전적 집계 274판 / 2069R.
 * 후는 선 장수만. 이번 선 금액·상대 권종은 안 본다.
 */

export interface BankGameDummyView {
  gameOver: boolean;
  phase: BankPhase;
  round: number;
  maxRound: number;
  firstSide: BankSide;
  myId: string;
  oppId: string;
  mySide: BankSide;
  my: {
    score: number;
    inventory: BankBet;
    inventoryCount: number;
    inventoryAmount: number;
    betConfirmed: boolean;
  };
  opp: {
    score: number;
    inventoryCount: number;
    betConfirmed: boolean;
    publicBetCount: number | null;
  };
  /** firstReveal 이후. 금액 없음 */
  firstPublicCount: number | null;
  history: BankRoundResult[];
  loserAmountTotal: number;
  winner: string | 'draw' | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type Cand = { bet: BankBet; key: string };

function tierKnobs(tier: DummyAiTier): { uniformMix: number; softmaxTemp: number; amountNoise: number } {
  if (tier === '하') return { uniformMix: 0.42, softmaxTemp: 0.08, amountNoise: 0.45 };
  if (tier === '중') return { uniformMix: 0.16, softmaxTemp: 0.03, amountNoise: 0.28 };
  return { uniformMix: 0.05, softmaxTemp: 0.012, amountNoise: 0.16 };
}

function cloneBet(b: BankBet): BankBet {
  return { 1000: b[1000], 3000: b[3000], 5000: b[5000], 10000: b[10000] };
}

function betKey(b: BankBet): string {
  return `${b[10000]}-${b[5000]}-${b[3000]}-${b[1000]}`;
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1 / (1 + Math.exp(-x));
}

function roundTo1000(n: number): number {
  return Math.max(0, Math.round(n / 1000) * 1000);
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function roundsLeftIncl(view: BankGameDummyView): number {
  return Math.max(1, view.maxRound - view.round + 1);
}

function isLastRound(view: BankGameDummyView): boolean {
  return view.round >= view.maxRound;
}

function myIsFirst(view: BankGameDummyView): boolean {
  return view.firstSide === view.mySide;
}

function minNote(inv: BankBet): BankBet {
  const bet = zeroBet();
  for (const d of BANK_DENOMINATIONS) {
    if (inv[d] > 0) {
      bet[d] = 1;
      return bet;
    }
  }
  return bet;
}

/** N장으로 만들 수 있는 최대 금액 (시작 권종 한도). */
export function maxValueWithNotes(n: number): number {
  let left = Math.max(0, n);
  let v = 0;
  const take = (d: 10000 | 5000 | 3000 | 1000, have: number) => {
    const k = Math.min(have, left);
    v += k * d;
    left -= k;
  };
  take(10000, BANK_INITIAL_INVENTORY[10000]);
  take(5000, BANK_INITIAL_INVENTORY[5000]);
  take(3000, BANK_INITIAL_INVENTORY[3000]);
  take(1000, BANK_INITIAL_INVENTORY[1000]);
  return v;
}

/**
 * 기보 R1–6 선 p90 ~2.1~2.4만. 초반 잔여 전부 금지.
 * 마지막 라운드만 잔여.
 */
export function amountSoftCap(
  remain: number,
  roundsLeft: number,
  scoreDiff: number,
): number {
  if (remain <= 0) return 0;
  if (roundsLeft <= 1) return remain;
  const pace = remain / roundsLeft;
  let cap = Math.min(remain, Math.max(8000, Math.round(pace * 2.05)), 24000);
  if (scoreDiff <= -2 && roundsLeft <= 4) {
    cap = Math.min(remain, cap + 4000);
  }
  if (scoreDiff >= 3) {
    cap = Math.min(cap, Math.max(7000, Math.round(pace * 1.55)));
  }
  return roundTo1000(cap);
}

export function maxCountForRound(invCount: number, roundsLeft: number): number {
  if (invCount <= 0) return 0;
  if (roundsLeft <= 1) return invCount;
  if (roundsLeft <= 3) return Math.min(7, invCount);
  return Math.min(6, invCount);
}

export function enumerateMixes(inv: BankBet, maxCount: number, maxAmount: number): BankBet[] {
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

function pushCand(out: Cand[], seen: Set<string>, bet: BankBet, inv: BankBet): void {
  const v = validateBet(bet, inv);
  if (!v.ok) return;
  const key = betKey(bet);
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ bet: cloneBet(bet), key });
}

export function firstCandidates(view: BankGameDummyView): Cand[] {
  const inv = view.my.inventory;
  const remain = view.my.inventoryAmount;
  const left = roundsLeftIncl(view);
  const cap = amountSoftCap(remain, left, view.my.score - view.opp.score);
  const maxCount = maxCountForRound(view.my.inventoryCount, left);
  const seen = new Set<string>();
  const out: Cand[] = [];

  if (sumInventoryCount(inv) <= 0 || remain <= 0) {
    pushCand(out, seen, zeroBet(), inv);
    return out;
  }

  if (isLastRound(view) && view.my.score > view.opp.score) {
    pushCand(out, seen, zeroBet(), inv);
  }

  for (const mix of enumerateMixes(inv, maxCount, cap)) {
    const c = sumBetCount(mix);
    if (c < 2 && left > 1) continue;
    pushCand(out, seen, mix, inv);
  }

  if (left <= 1) {
    pushCand(out, seen, cloneBet(inv), inv);
  }

  if (out.length === 0) {
    const min = minNote(inv);
    if (sumBetCount(min) > 0) pushCand(out, seen, min, inv);
    else pushCand(out, seen, zeroBet(), inv);
  }
  return out;
}

export function secondCandidates(view: BankGameDummyView): Cand[] {
  const inv = view.my.inventory;
  const remain = view.my.inventoryAmount;
  const left = roundsLeftIncl(view);
  const cap = amountSoftCap(remain, left, view.my.score - view.opp.score);
  const maxCount = maxCountForRound(view.my.inventoryCount, left);
  const seen = new Set<string>();
  const out: Cand[] = [];
  const firstCount = view.firstPublicCount ?? 0;

  pushCand(out, seen, zeroBet(), inv);

  if (sumInventoryCount(inv) <= 0) return out;

  if (firstCount <= 0) {
    pushCand(out, seen, minNote(inv), inv);
    return out;
  }

  for (const mix of enumerateMixes(inv, maxCount, cap)) {
    pushCand(out, seen, mix, inv);
  }
  if (left <= 1) {
    pushCand(out, seen, cloneBet(inv), inv);
  }
  return out;
}

/** 기보: 선 장수별 1천장 블러프 비율 */
const BLUFF_P: Record<number, number> = {
  1: 0.45,
  2: 0.28,
  3: 0.20,
  4: 0.22,
  5: 0.32,
  6: 0.25,
  7: 0.18,
};

/** 기보: 후가 선 장수를 보고 0장 내는 비율 (리드 보정 전) */
const FOLD_P: Record<number, number> = {
  0: 0.06,
  1: 0.25,
  2: 0.05,
  3: 0.11,
  4: 0.16,
  5: 0.25,
  6: 0.25,
  7: 0.13,
  8: 0.24,
};

function oppAmountPublic(h: BankRoundResult, oppIsFirst: boolean): number | null {
  return oppIsFirst ? h.firstAmount : h.secondAmount;
}

function oppCountPublic(h: BankRoundResult, oppIsFirst: boolean): number {
  return oppIsFirst ? h.firstCount : h.secondCount;
}

function knownOppSpent(view: BankGameDummyView): { amount: number; hiddenNotes: number } {
  let amount = 0;
  let hiddenNotes = 0;
  for (const h of view.history) {
    const oppFirst = h.firstSide !== view.mySide;
    const amt = oppAmountPublic(h, oppFirst);
    const cnt = oppCountPublic(h, oppFirst);
    if (amt != null) amount += amt;
    else hiddenNotes += cnt;
  }
  return { amount, hiddenNotes };
}

export function oppRemainBounds(view: BankGameDummyView): { min: number; max: number } {
  const n = view.opp.inventoryCount;
  const { amount: known, hiddenNotes } = knownOppSpent(view);
  const spentLo = known + hiddenNotes * 1000;
  const spentHi = known + maxValueWithNotes(hiddenNotes);
  const remainHi = Math.min(maxValueWithNotes(n), BANK_INITIAL_TOTAL_AMOUNT - spentLo);
  const remainLo = Math.max(n * 1000, BANK_INITIAL_TOTAL_AMOUNT - spentHi);
  const min = Math.max(0, Math.min(remainLo, remainHi));
  const max = Math.max(min, Math.max(remainLo, remainHi));
  return { min, max };
}

function sampleOppRemain(view: BankGameDummyView): number {
  const { min, max } = oppRemainBounds(view);
  if (max <= min) return min;
  return roundTo1000(min + Math.random() * (max - min));
}

function sampleFirstAmountGivenCount(
  count: number,
  oppRemain: number,
  noise: number,
): number {
  if (count <= 0) return 0;
  const minA = count * 1000;
  const maxA = Math.min(oppRemain, maxValueWithNotes(count));
  if (maxA < minA) return Math.min(oppRemain, minA);
  const pBluff = BLUFF_P[count] ?? 0.15;
  if (Math.random() < pBluff) return minA;
  const mode = count <= 2 ? 7000 : count >= 7 ? 16000 : 12000;
  const spread = 8000 * (0.7 + noise);
  const raw = mode + (Math.random() * 2 - 1) * spread;
  return clampInt(roundTo1000(raw), minA, maxA);
}

function sampleSecondAmount(
  firstCount: number,
  firstEst: number,
  oppRemain: number,
  secondLead: number,
  noise: number,
): number {
  if (oppRemain <= 0) return 0;
  if (firstCount <= 0) {
    return Math.random() < 0.06 ? 0 : Math.min(1000, oppRemain);
  }
  let fold = FOLD_P[firstCount] ?? 0.15;
  if (secondLead >= 2) fold = Math.min(0.42, fold * 1.7);
  else if (secondLead >= 1) fold = Math.min(0.32, fold * 1.35);
  else if (secondLead <= -2) fold *= 0.45;
  else if (secondLead <= -1) fold *= 0.55;
  fold = fold * (1 - noise * 0.15) + 0.12 * noise;
  if (Math.random() < fold) return 0;
  const over = 1000 * (1 + Math.floor(Math.random() * 3));
  const target = firstEst + over;
  return Math.min(oppRemain, roundTo1000(target));
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
  view: BankGameDummyView,
  myAmt: number,
  oppAmt: number,
  oppRemainBefore: number,
): number {
  let myScore = view.my.score;
  let oppScore = view.opp.score;
  if (myAmt > oppAmt) myScore += 1;
  else if (myAmt < oppAmt) oppScore += 1;
  const myFuel = Math.max(0, view.my.inventoryAmount - myAmt);
  const oppFuel = Math.max(0, oppRemainBefore - oppAmt);
  const after = Math.max(0, view.maxRound - view.round);
  return gameWinProb(myScore, oppScore, myFuel, oppFuel, after);
}

function pickSoftmax(scored: Array<{ cand: Cand; score: number }>, tier: DummyAiTier, temp: number): Cand {
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return { bet: zeroBet(), key: betKey(zeroBet()) };
  }
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

export async function pickBankGameActionAsync(
  view: BankGameDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<BankAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  if (view.my.betConfirmed) return null;

  const first = myIsFirst(view);
  if (view.phase === 'firstSubmit') {
    if (!first) return null;
  } else if (view.phase === 'secondSubmit') {
    if (first) return null;
  } else {
    return null;
  }

  const knobs = tierKnobs(tier);
  const cands = first ? firstCandidates(view) : secondCandidates(view);
  if (cands.length === 0) {
    return { type: 'submitBet', bet: zeroBet() };
  }

  const acc = new Map<string, { cand: Cand; sum: number; n: number }>();
  for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });

  await runPsychologySearch(budgetMs, () => {
    const oppRemain = sampleOppRemain(view);
    if (first) {
      for (const c of cands) {
        const myCount = sumBetCount(c.bet);
        const estForOpp = sampleFirstAmountGivenCount(myCount, view.my.inventoryAmount, knobs.amountNoise);
        const secondLead = view.opp.score - view.my.score;
        const oppAmt = sampleSecondAmount(myCount, estForOpp, oppRemain, secondLead, knobs.uniformMix);
        const sc = evalAmounts(view, sumBetAmount(c.bet), oppAmt, oppRemain);
        const a = acc.get(c.key)!;
        a.sum += sc;
        a.n += 1;
      }
    } else {
      const fc = view.firstPublicCount ?? 4;
      const firstAmt = sampleFirstAmountGivenCount(fc, oppRemain, knobs.amountNoise);
      for (const c of cands) {
        const sc = evalAmounts(view, sumBetAmount(c.bet), firstAmt, oppRemain);
        const a = acc.get(c.key)!;
        a.sum += sc;
        a.n += 1;
      }
    }
  }, { batchSize: 12 });

  const scored = [...acc.values()]
    .filter((a) => a.n > 0)
    .map((a) => ({ cand: a.cand, score: a.sum / a.n }));
  if (scored.length === 0) {
    return { type: 'submitBet', bet: first ? minNote(view.my.inventory) : zeroBet() };
  }

  const picked = pickSoftmax(scored, tier, knobs.softmaxTemp).bet;
  const v = validateBet(picked, view.my.inventory);
  if (!v.ok) {
    return { type: 'submitBet', bet: minNote(view.my.inventory) };
  }
  const left = roundsLeftIncl(view);
  const cap = amountSoftCap(view.my.inventoryAmount, left, view.my.score - view.opp.score);
  if (sumBetAmount(picked) > cap) {
    const cheaper = scored
      .map((s) => s.cand.bet)
      .filter((b) => sumBetAmount(b) <= cap)
      .sort((a, b) => sumBetAmount(b) - sumBetAmount(a))[0];
    return { type: 'submitBet', bet: cheaper ?? minNote(view.my.inventory) };
  }
  return { type: 'submitBet', bet: cloneBet(picked) };
}
