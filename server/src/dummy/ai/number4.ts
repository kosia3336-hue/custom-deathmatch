import type { DummyAiTier } from '@shared/dummy.js';
import {
  TILES_PER_ROUND,
  TOTAL_ROUNDS,
  INITIAL_WHITE,
  INITIAL_BLACK,
  type NF4Number,
  type NumberFourAction,
  type NF4Phase,
  type NF4RoundRecord,
} from '@shared/types/number4.js';
import { runPsychologySearch } from '../psychologySearch.js';

const REWARDS: readonly number[] = [5, 1, 2, 3, 4];
const TOTAL_TILES = INITIAL_WHITE + INITIAL_BLACK;

export interface NumberFourDummyView {
  gameOver: boolean;
  phase: NF4Phase;
  round: number;
  myId: string;
  oppId: string;
  my: {
    score: number;
    remainingWhite: number;
    remainingBlack: number;
    submitted: boolean;
  };
  opp: {
    score: number;
    submitted: boolean;
  };
  /** 클라 roundHistory 와 동일 — 타일 수치 없음 */
  roundHistory: NF4RoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

interface PlanKey {
  white: number;
  black: number;
  number: NF4Number;
}

interface Plan extends PlanKey {
  ev: number;
  successProb: number;
}

interface Acc {
  success: number;
  total: number;
}

function checkNumberSuccess(
  num: NF4Number,
  myW: number,
  myB: number,
  opW: number,
  opB: number,
): boolean {
  switch (num) {
    case 0: return myB + opB >= 11;
    case 1: return myW >= opW;
    case 2: return myW * myB > opW * opB;
    case 3: return myW >= opB + 2;
    case 4: return myW >= opB * 2;
    default: return false;
  }
}

function possibleOppRemaining(roundsCompleted: number): Array<{ w: number; b: number }> {
  const remTotal = TOTAL_TILES - TILES_PER_ROUND * roundsCompleted;
  const minW = Math.max(0, INITIAL_WHITE - TILES_PER_ROUND * roundsCompleted);
  const maxW = Math.min(INITIAL_WHITE, remTotal);
  const out: Array<{ w: number; b: number }> = [];
  for (let w = minW; w <= maxW; w++) {
    const b = remTotal - w;
    if (b < 0 || b > INITIAL_BLACK) continue;
    out.push({ w, b });
  }
  return out.length > 0
    ? out
    : [{ w: Math.min(INITIAL_WHITE, remTotal), b: Math.max(0, remTotal - INITIAL_WHITE) }];
}

function legalWhiteRange(remW: number, remB: number): { minW: number; maxW: number } {
  return {
    minW: Math.max(0, TILES_PER_ROUND - remB),
    maxW: Math.min(TILES_PER_ROUND, remW),
  };
}

function estimateWhiteTendencyFromNumbers(
  history: NF4RoundRecord[],
  oppId: string,
): number | null {
  if (history.length === 0) return null;
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < history.length; i++) {
    const rec = history[i]?.players[oppId];
    if (!rec) continue;
    const n = rec.number;
    let target: number;
    if (n === 0) target = 2;
    else if (n === 2) target = 3.5;
    else target = 5;
    const w = i + 1;
    weighted += target * w;
    weightSum += w;
  }
  if (weightSum === 0) return null;
  return weighted / weightSum;
}

function resourcePenalty(
  remW: number,
  remB: number,
  white: number,
  remainingRounds: number,
): number {
  const futureRounds = remainingRounds - 1;
  if (futureRounds <= 0) return 0;
  const futureW = remW - white;
  const futureB = remB - (TILES_PER_ROUND - white);
  const avgW = futureW / futureRounds;
  const avgB = futureB / futureRounds;
  let penalty = 0;
  if (avgW < 1 || avgB < 1) penalty -= 0.3;
  if (avgW < 0.5 || avgB < 0.5) penalty -= 0.7;
  return penalty;
}

function myNumberSum(history: NF4RoundRecord[], myId: string): number {
  let sum = 0;
  for (const rec of history) {
    const pr = rec.players[myId];
    if (pr) sum += pr.number;
  }
  return sum;
}

function planId(white: number, number: NF4Number): string {
  return `${white}:${number}`;
}

function buildPlanKeys(view: NumberFourDummyView): PlanKey[] {
  const aiMinW = Math.max(0, TILES_PER_ROUND - view.my.remainingBlack);
  const aiMaxW = Math.min(TILES_PER_ROUND, view.my.remainingWhite);
  const keys: PlanKey[] = [];
  for (let w = aiMinW; w <= aiMaxW; w++) {
    const b = TILES_PER_ROUND - w;
    for (let n = 0; n <= 4; n++) {
      keys.push({ white: w, black: b, number: n as NF4Number });
    }
  }
  return keys;
}

function sampleWeightedIndex(weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function sampleOppPlay(
  remStates: Array<{ w: number; b: number }>,
  tendency: number | null,
  useTendency: boolean,
): { opW: number; opB: number } {
  const rem = remStates[Math.floor(Math.random() * remStates.length)]!;
  const range = legalWhiteRange(rem.w, rem.b);
  if (range.minW > range.maxW) {
    return { opW: range.minW, opB: TILES_PER_ROUND - range.minW };
  }
  const options: number[] = [];
  const weights: number[] = [];
  for (let opW = range.minW; opW <= range.maxW; opW++) {
    options.push(opW);
    if (useTendency && tendency != null) {
      weights.push(1 / (1 + Math.abs(opW - tendency)));
    } else {
      weights.push(1);
    }
  }
  const opW = options[sampleWeightedIndex(weights)]!;
  return { opW, opB: TILES_PER_ROUND - opW };
}

function pickUniform<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function selectSafest(plans: Plan[]): Plan {
  return plans.reduce((best, p) =>
    p.successProb > best.successProb
    || (p.successProb === best.successProb && p.ev > best.ev)
      ? p
      : best);
}

function selectBestEV(plans: Plan[]): Plan {
  return plans.reduce((best, p) => (p.ev > best.ev ? p : best));
}

function selectAggressive(plans: Plan[]): Plan {
  let best = plans[0]!;
  let bestScore = -Infinity;
  for (const p of plans) {
    const adjusted = p.ev + p.number * 0.15;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = p;
    }
  }
  return best;
}

function selectComeback(plans: Plan[], deficit: number): Plan {
  const viable = plans.filter((p) => REWARDS[p.number]! >= deficit && p.successProb > 0.1);
  if (viable.length > 0) return selectBestEV(viable);
  return selectAggressive(plans);
}

/**
 * 룰 숙지 바닥 — 등급과 무관.
 * 탈락 위기만 예외. 성공확률 ~0·기대값 바닥 올인 금지.
 */
function filterCompetent(plans: Plan[], desperate: boolean): Plan[] {
  if (desperate) return plans;
  const byProb = plans.filter((p) => p.successProb >= 0.12);
  const pool = byProb.length > 0 ? byProb : plans.filter((p) => p.successProb >= 0.08);
  if (pool.length === 0) return plans;
  const bestEv = Math.max(...pool.map((p) => p.ev));
  // EV가 최선보다 너무 아래면 “룰은 아는데 자폭”에 가깝다
  const near = pool.filter((p) => p.ev >= bestEv - 1.25);
  return near.length > 0 ? near : pool;
}

function samePlan(a: PlanKey, b: PlanKey): boolean {
  return a.white === b.white && a.black === b.black && a.number === b.number;
}

/** 최선 근처만 — 하는 머저리 랜덤(풀 전체) 금지 */
function nearBestBand(sorted: Plan[], best: Plan, maxSlack: number, maxCount: number): Plan[] {
  const band = sorted.filter((p) => p.ev >= best.ev - maxSlack).slice(0, maxCount);
  return band.length > 0 ? band : [best];
}

function applyTierNoise(best: Plan, pool: Plan[], tier: DummyAiTier): Plan {
  if (pool.length <= 1) return best;
  const sorted = [...pool].sort((a, b) => b.ev - a.ev);
  const r = Math.random();
  if (tier === '하') {
    // 자주 차선이지만 상위권만. 바닥 EV는 안 고름.
    if (r < 0.42) {
      const band = nearBestBand(sorted, best, 0.55, 6);
      const alts = band.filter((p) => !samePlan(p, best));
      return alts.length > 0 ? pickUniform(alts) : best;
    }
    return best;
  }
  if (tier === '중') {
    if (r < 0.08) {
      const band = nearBestBand(sorted, best, 0.25, 3);
      const alts = band.filter((p) => !samePlan(p, best));
      return alts.length > 0 ? pickUniform(alts) : best;
    }
    return best;
  }
  if (r < 0.03) {
    const second = sorted.find((p) => !samePlan(p, best));
    return second && second.ev >= best.ev - 0.25 ? second : best;
  }
  return best;
}

/** 하는 MC를 곧이곧대로 안 믿음(얕은 읽기). 중·상은 그대로. */
function readProb(raw: number, tier: DummyAiTier): number {
  if (tier === '하') {
    const prior = 0.38;
    return raw * 0.62 + prior * 0.38;
  }
  if (tier === '중') {
    const prior = 0.35;
    return raw * 0.88 + prior * 0.12;
  }
  return raw;
}

function plansFromAcc(
  keys: PlanKey[],
  acc: Map<string, Acc>,
  view: NumberFourDummyView,
  tier: DummyAiTier,
): Plan[] {
  const remainingRounds = TOTAL_ROUNDS - view.round + 1;
  const plans: Plan[] = [];
  for (const key of keys) {
    const a = acc.get(planId(key.white, key.number));
    const raw = a && a.total > 0 ? a.success / a.total : 0;
    const prob = readProb(raw, tier);
    const resPen = resourcePenalty(
      view.my.remainingWhite,
      view.my.remainingBlack,
      key.white,
      remainingRounds,
    );
    // 하는 자원·타이브레이크를 덜 봄 (당장 한 수 위주)
    const resScale = tier === '하' ? 0.35 : tier === '중' ? 0.75 : 1;
    const tieScale = tier === '하' ? 0 : tier === '중' ? 0.5 : 1;
    const rawEV = prob * REWARDS[key.number]! - (1 - prob) * 1;
    const tiebreakerBonus = (4 - key.number) * 0.05 * tieScale;
    plans.push({
      ...key,
      successProb: prob,
      ev: rawEV + resPen * resScale + tiebreakerBonus,
    });
  }
  return plans;
}

function chooseFromPlans(view: NumberFourDummyView, tier: DummyAiTier, all: Plan[]): Plan {
  if (all.length === 0) {
    const w = Math.min(TILES_PER_ROUND, view.my.remainingWhite);
    return {
      white: w,
      black: TILES_PER_ROUND - w,
      number: 1,
      ev: 0,
      successProb: 0,
    };
  }

  const scoreDiff = view.my.score - view.opp.score;
  const remainingRounds = TOTAL_ROUNDS - view.round + 1;
  const desperate = view.my.score <= 1;
  const pool = filterCompetent(all, desperate);

  let best: Plan;
  if (desperate) {
    // 전원: 탈락 위기에 자폭 안 함
    best = selectSafest(pool);
  } else if (scoreDiff <= -2 && remainingRounds <= 2) {
    if (tier === '하') {
      // 룰은 알지만 역전 도박은 약함 — 안전한 쪽 + 소폭 고보상
      const safe = selectSafest(pool);
      const come = selectComeback(pool, -scoreDiff);
      best = come.successProb >= safe.successProb - 0.12 ? come : safe;
    } else {
      best = selectComeback(pool, -scoreDiff);
    }
  } else if (scoreDiff <= -2) {
    if (tier === '상') best = selectAggressive(pool);
    else if (tier === '중') best = Math.random() < 0.55 ? selectAggressive(pool) : selectBestEV(pool);
    else best = selectBestEV(pool); // 하: 점수 압박을 덜 읽음
  } else {
    best = selectBestEV(pool);
  }

  if (tier === '상' && remainingRounds <= 2 && Math.abs(scoreDiff) <= 1) {
    const mySum = myNumberSum(view.roundHistory, view.myId);
    const lowNum = pool
      .filter((p) => p.successProb >= best.successProb - 0.05)
      .sort((a, b) => a.number - b.number || b.ev - a.ev)[0];
    if (lowNum && mySum >= 6 && lowNum.number < best.number) {
      best = lowNum;
    }
  }

  return applyTierNoise(best, pool, tier);
}

function toAction(view: NumberFourDummyView, plan: Plan): NumberFourAction | null {
  const { white, black, number } = plan;
  if (white < 0 || black < 0) return null;
  if (white > view.my.remainingWhite || black > view.my.remainingBlack) return null;
  if (white + black !== TILES_PER_ROUND) return null;
  return { type: 'submit', white, black, number };
}

/** 잔여 7장 = 타일 자동. 넘버만 고른다. */
export function isNumberFourLastRound(view: NumberFourDummyView): boolean {
  return (
    view.round >= TOTAL_ROUNDS
    || view.my.remainingWhite + view.my.remainingBlack <= TILES_PER_ROUND
  );
}

/**
 * 공개 뷰만. `budgetMs`(심리 5~90초 예산) 동안 상대 타일 MC 샘플로 성공확률을 쌓은 뒤 제출.
 * idle sleep 금지 — runPsychologySearch 가 예산을 탐색으로 채운다.
 */
export async function pickNumberFourActionAsync(
  view: NumberFourDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<NumberFourAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.phase !== 'submit') return null;
  if (view.myId !== dummyId) return null;
  if (view.my.submitted) return null;

  const keys = buildPlanKeys(view);
  if (keys.length === 0) return null;

  const roundsCompleted = view.round - 1;
  const remStates = possibleOppRemaining(roundsCompleted);
  const tendency = estimateWhiteTendencyFromNumbers(view.roundHistory, view.oppId);
  const useTendency = tier === '상' || (tier === '중' && view.roundHistory.length >= 2);

  const acc = new Map<string, Acc>();
  for (const key of keys) {
    acc.set(planId(key.white, key.number), { success: 0, total: 0 });
  }

  await runPsychologySearch(budgetMs, () => {
    const { opW, opB } = sampleOppPlay(remStates, tendency, useTendency);
    for (const key of keys) {
      const a = acc.get(planId(key.white, key.number))!;
      a.total += 1;
      if (checkNumberSuccess(key.number, key.white, key.black, opW, opB)) {
        a.success += 1;
      }
    }
  });

  const plans = plansFromAcc(keys, acc, view, tier);
  return toAction(view, chooseFromPlans(view, tier, plans));
}
