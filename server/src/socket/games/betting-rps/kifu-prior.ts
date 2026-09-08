import type { BRPSResult, BrpsAdvisorRound } from '@shared/types/betting-rps.js';
import {
  BRPS_BET_FRAC_ROWS,
  BRPS_BET_GAP_ROWS,
  BRPS_BET_ROWS,
  BRPS_FLOW_ROWS,
  BRPS_MATCH_GAP_ROWS,
  BRPS_MATCH_ROWS,
  BRPS_OPP_ROLE_ROWS,
  BRPS_REPLY_BET_CHIP_ROWS,
  BRPS_REPLY_ROWS,
  BRPS_ROLE_ROWS,
} from './kifu-prior-data.js';

const LAPLACE = 1;
const RESULTS: readonly BRPSResult[] = ['win', 'draw', 'lose'];

function resultCode(r: BRPSResult): 0 | 1 | 2 {
  if (r === 'win') return 0;
  if (r === 'draw') return 1;
  return 2;
}

function roleCode(role: 'match' | 'bet'): 0 | 1 {
  return role === 'match' ? 0 : 1;
}

const roleByRound = new Map<string, number>();
const oppRoleByRound = new Map<string, number>();
const matchByRound = new Map<string, number>();
const betByRound = new Map<string, number>();
const replyExact = new Map<string, number>();
const replyCtx = new Map<string, number>();
const replyBetChip = new Map<string, number>();
const replyBetChipCtx = new Map<string, number>();
const flowExact = new Map<string, number>();
const flowCtx = new Map<string, number>();
const betFrac = new Map<string, { frac: number; n: number }>();
const matchGap = new Map<string, number>();
const betGap = new Map<string, number>();

for (const [round, role, n] of BRPS_ROLE_ROWS) {
  roleByRound.set(`${round}:${role}`, n);
}
for (const [round, role, n] of BRPS_OPP_ROLE_ROWS) {
  oppRoleByRound.set(`${round}:${role}`, n);
}
for (const [round, result, n] of BRPS_MATCH_ROWS) {
  matchByRound.set(`${round}:${result}`, n);
}
for (const [round, pred, chips, n] of BRPS_BET_ROWS) {
  betByRound.set(`${round}:${pred}:${chips}`, n);
}
for (const [myRole, myAct, oppAct, n] of BRPS_REPLY_ROWS) {
  replyExact.set(`${myRole}:${myAct}:${oppAct}`, n);
  replyCtx.set(`${myRole}:${myAct}`, (replyCtx.get(`${myRole}:${myAct}`) ?? 0) + n);
}
for (const [round, myMatch, oppPred, bucket, n] of BRPS_REPLY_BET_CHIP_ROWS) {
  replyBetChip.set(`${round}:${myMatch}:${oppPred}:${bucket}`, n);
  replyBetChipCtx.set(
    `${round}:${myMatch}`,
    (replyBetChipCtx.get(`${round}:${myMatch}`) ?? 0) + n,
  );
}
for (const [pr, pa, po, nr, na, nc, n] of BRPS_FLOW_ROWS) {
  flowExact.set(`${pr}:${pa}:${po}:${nr}:${na}:${nc}`, n);
  flowCtx.set(`${pr}:${pa}:${po}:${nc}`, (flowCtx.get(`${pr}:${pa}:${po}:${nc}`) ?? 0) + n);
}
for (const [round, gap, frac100, n] of BRPS_BET_FRAC_ROWS) {
  betFrac.set(`${round}:${gap}`, { frac: frac100 / 100, n });
}
for (const [round, gap, result, n] of BRPS_MATCH_GAP_ROWS) {
  matchGap.set(`${round}:${gap}:${result}`, n);
}
for (const [round, gap, pred, chips, n] of BRPS_BET_GAP_ROWS) {
  betGap.set(`${round}:${gap}:${pred}:${chips}`, n);
}

/** 0=뒤3+, 1=뒤1~2, 2=접전, 3=앞2~3, 4=앞4+ */
export function gapBucket(myChips: number, oppChips: number): 0 | 1 | 2 | 3 | 4 {
  const d = myChips - oppChips;
  if (d <= -3) return 0;
  if (d <= -1) return 1;
  if (d <= 1) return 2;
  if (d <= 3) return 3;
  return 4;
}

export function kifuBetFraction(round: number, gap: 0 | 1 | 2 | 3 | 4): number {
  const hit = betFrac.get(`${round}:${gap}`);
  if (hit && hit.n >= 4) return hit.frac;
  const near = betFrac.get(`${round}:${Math.max(0, gap - 1) as 0 | 1 | 2 | 3 | 4}`)
    ?? betFrac.get(`${round}:${Math.min(4, gap + 1) as 0 | 1 | 2 | 3 | 4}`);
  if (near) return near.frac;
  const prev = betFrac.get(`${Math.max(1, round - 1)}:${gap}`);
  if (prev) return prev.frac;
  return 0.58;
}

export function matchWeightGap(round: number, gap: 0 | 1 | 2 | 3 | 4, result: BRPSResult): number {
  const exact = matchGap.get(`${round}:${gap}:${resultCode(result)}`) ?? 0;
  if (exact >= 3) return LAPLACE + exact * 4;
  return matchWeight(round, result);
}

export function betWeightGap(
  round: number,
  gap: 0 | 1 | 2 | 3 | 4,
  pred: BRPSResult,
  chips: number,
): number {
  const exact = betGap.get(`${round}:${gap}:${resultCode(pred)}:${chips}`) ?? 0;
  if (exact >= 3) return LAPLACE + exact * 4;
  return betWeight(round, pred, chips);
}

export function kifuBetAmountsGap(round: number, gap: 0 | 1 | 2 | 3 | 4): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const [r, g, _pred, chips, n] of BRPS_BET_GAP_ROWS) {
    if (r !== round || g !== gap || n < 3 || seen.has(chips)) continue;
    seen.add(chips);
    out.push(chips);
  }
  if (out.length > 0) return out;
  return kifuBetAmounts(round);
}

export function roleWeight(round: number, role: 'match' | 'bet', forOpp: boolean): number {
  const table = forOpp ? oppRoleByRound : roleByRound;
  const code = roleCode(role);
  const exact = table.get(`${round}:${code}`) ?? 0;
  const near = table.get(`${Math.max(1, round - 1)}:${code}`) ?? 0;
  return LAPLACE + exact * 4 + near;
}

export function matchWeight(round: number, result: BRPSResult): number {
  const code = resultCode(result);
  const exact = matchByRound.get(`${round}:${code}`) ?? 0;
  const near = matchByRound.get(`${Math.max(1, round - 1)}:${code}`) ?? 0;
  return LAPLACE + exact * 3 + near;
}

export function betWeight(round: number, pred: BRPSResult, chips: number): number {
  const code = resultCode(pred);
  const exact = betByRound.get(`${round}:${code}:${chips}`) ?? 0;
  let near = 0;
  for (const [key, n] of betByRound) {
    if (!key.startsWith(`${round}:${code}:`)) continue;
    const amt = Number(key.split(':')[2]);
    if (Math.abs(amt - chips) <= 1) near += n;
  }
  return LAPLACE + exact * 4 + near;
}

export function kifuBetAmounts(round: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const [r, _pred, chips, n] of BRPS_BET_ROWS) {
    if (r !== round || n < 3 || seen.has(chips)) continue;
    seen.add(chips);
    out.push(chips);
  }
  return out;
}

/** 승자가 이 수를 낼 때 상대가 저 수를 낸 횟수 + 라플라스. */
export function replyWeight(
  myRole: 'match' | 'bet',
  myAct: BRPSResult,
  oppAct: BRPSResult,
): number {
  const exact = replyExact.get(`${roleCode(myRole)}:${resultCode(myAct)}:${resultCode(oppAct)}`) ?? 0;
  const ctx = replyCtx.get(`${roleCode(myRole)}:${resultCode(myAct)}`) ?? 0;
  if (ctx >= 4) return LAPLACE + exact * 4;
  return LAPLACE + exact * 4;
}

export function replySeen(
  myRole: 'match' | 'bet',
  myAct: BRPSResult,
  oppAct: BRPSResult,
): boolean {
  return (replyExact.get(`${roleCode(myRole)}:${resultCode(myAct)}:${resultCode(oppAct)}`) ?? 0) >= 8;
}

export function replyBetChipWeight(
  round: number,
  myMatch: BRPSResult,
  oppPred: BRPSResult,
  bucket: number,
): number {
  const exact =
    replyBetChip.get(`${round}:${resultCode(myMatch)}:${resultCode(oppPred)}:${bucket}`) ?? 0;
  const ctx = replyBetChipCtx.get(`${round}:${resultCode(myMatch)}`) ?? 0;
  const thin = replyWeight('match', myMatch, oppPred);
  if (ctx >= 4) return LAPLACE + exact * 4 + thin;
  return LAPLACE + exact * 2 + thin;
}

export function replyBetChipSeen(
  round: number,
  myMatch: BRPSResult,
  oppPred: BRPSResult,
  bucket: number,
): boolean {
  return (
    (replyBetChip.get(`${round}:${resultCode(myMatch)}:${resultCode(oppPred)}:${bucket}`) ?? 0) >= 3
  );
}

export function flowNextCount(
  history: BrpsAdvisorRound[],
  nextRole: 'match' | 'bet',
  nextAct: BRPSResult | null,
  myChoice: boolean,
): number {
  if (history.length === 0) {
    if (nextAct == null) return roleByRound.get(`1:${roleCode(nextRole)}`) ?? 0;
    if (nextRole === 'match') return matchByRound.get(`1:${resultCode(nextAct)}`) ?? 0;
    return 0;
  }
  const last = history[history.length - 1]!;
  const pr = roleCode(last.myRole);
  const pa = resultCode(last.myRole === 'match' ? last.matchResult : last.prediction);
  const po = resultCode(last.myRole === 'match' ? last.prediction : last.matchResult);
  const nc = myChoice ? 1 : 0;
  const nr = roleCode(nextRole);
  if (nextAct == null) {
    let acc = 0;
    for (const act of [0, 1, 2] as const) {
      acc += flowExact.get(`${pr}:${pa}:${po}:${nr}:${act}:${nc}`) ?? 0;
    }
    return acc;
  }
  const exact = flowExact.get(`${pr}:${pa}:${po}:${nr}:${resultCode(nextAct)}:${nc}`) ?? 0;
  const ctx = flowCtx.get(`${pr}:${pa}:${po}:${nc}`) ?? 0;
  if (ctx >= 2) return exact;
  return nextRole === 'match' ? matchWeight(history.length + 1, nextAct) - LAPLACE : exact;
}

export function flowPolicyBonus(
  history: BrpsAdvisorRound[],
  nextRole: 'match' | 'bet',
  nextAct: BRPSResult | null,
  myChoice: boolean,
): number {
  const c = flowNextCount(history, nextRole, nextAct, myChoice);
  return 0.012 * Math.log(1 + c);
}

/** COM과 같은 약한 사전. 승자 응답 473은 쓰지 않는다. */
export const MATCH_OPEN_PRIOR: Record<BRPSResult, number> = { win: 4.5, draw: 1.0, lose: 3.0 };
export const BET_OPEN_PRIOR: Record<BRPSResult, number> = { win: 4.0, draw: 0.8, lose: 3.5 };

export function lastRevealedOppMatch(history: BrpsAdvisorRound[]): BRPSResult | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.myRole === 'bet') return history[i]!.matchResult;
  }
  return null;
}

export function lastRevealedOppPred(history: BrpsAdvisorRound[]): BRPSResult | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.myRole === 'match') return history[i]!.prediction;
  }
  return null;
}

export function lastOurPrediction(history: BrpsAdvisorRound[]): BRPSResult | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.myRole === 'bet') return history[i]!.prediction;
  }
  return null;
}

/** 마지막 베팅이 적중하지 않았으면 그 예측. 적중이면 null. */
export function lastUnhitPrediction(history: BrpsAdvisorRound[]): BRPSResult | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const rec = history[i]!;
    if (rec.myRole !== 'bet') continue;
    if (rec.prediction !== rec.matchResult) return rec.prediction;
    return null;
  }
  return null;
}

export function denyMatchOf(pred: BRPSResult): BRPSResult {
  if (pred === 'win') return 'lose';
  if (pred === 'lose') return 'win';
  return 'win';
}

export function obsWeightSum(rec: Record<BRPSResult, number>): number {
  return rec.win + rec.draw + rec.lose;
}

export function observedOppMatch(history: BrpsAdvisorRound[]): Record<BRPSResult, number> {
  const counts: Record<BRPSResult, number> = { win: 0, draw: 0, lose: 0 };
  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    if (rec.myRole !== 'bet') continue;
    counts[rec.matchResult] += 1 + i / Math.max(1, history.length - 1);
  }
  return counts;
}

export function observedOppBet(history: BrpsAdvisorRound[]): {
  pred: Record<BRPSResult, number>;
  chips: number[];
} {
  const pred: Record<BRPSResult, number> = { win: 0, draw: 0, lose: 0 };
  const chips: number[] = [];
  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    if (rec.myRole !== 'match') continue;
    pred[rec.prediction] += 1 + i / Math.max(1, history.length - 1);
    chips.push(rec.betChips);
  }
  return { pred, chips };
}

export { RESULTS, resultCode, roleCode };
