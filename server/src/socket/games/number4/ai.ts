import type { NF4Number } from '@shared/types/number4.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { AI_DELAY, TILES_PER_ROUND, TOTAL_ROUNDS } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, NF4PlayerInternal } from './types.js';
import { gameStates, broadcastState, processRound } from './state.js';

const REWARDS: readonly number[] = [5, 1, 2, 3, 4];

interface Plan {
  white: number;
  black: number;
  number: NF4Number;
  ev: number;
  successProb: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

function getOpponent(s: InternalState, ai: NF4PlayerInternal): NF4PlayerInternal {
  return ai.id === s.player1.id ? s.player2 : s.player1;
}

/* ── 상대 타일 범위 추론 ─────────────────────────────── */

function getOpponentTileRange(op: NF4PlayerInternal): { minW: number; maxW: number } {
  const minW = Math.max(0, TILES_PER_ROUND - op.remainingBlack);
  const maxW = Math.min(TILES_PER_ROUND, op.remainingWhite);
  return { minW, maxW };
}

function estimateTendency(
  s: InternalState,
  op: NF4PlayerInternal,
  range: { minW: number; maxW: number },
): number {
  if (s.roundHistory.length === 0) {
    return (range.minW + range.maxW) / 2;
  }

  let weightedSum = 0;
  let weightSum = 0;
  const history = s.roundHistory;
  for (let i = 0; i < history.length; i++) {
    const rec = history[i].players[op.id];
    if (!rec) continue;
    const weight = i + 1;
    weightedSum += rec.white * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return (range.minW + range.maxW) / 2;
  const tendency = weightedSum / weightSum;
  return Math.max(range.minW, Math.min(range.maxW, tendency));
}

/* ── 정밀 확률 계산 ──────────────────────────────────── */

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

function calcPreciseProb(
  num: NF4Number,
  myW: number,
  myB: number,
  range: { minW: number; maxW: number },
  tendency: number,
): number {
  if (range.minW > range.maxW) return 0;
  if (range.minW === range.maxW) {
    const opB = TILES_PER_ROUND - range.minW;
    return checkNumberSuccess(num, myW, myB, range.minW, opB) ? 1 : 0;
  }

  let totalWeight = 0;
  let successWeight = 0;
  for (let opW = range.minW; opW <= range.maxW; opW++) {
    const opB = TILES_PER_ROUND - opW;
    const dist = Math.abs(opW - tendency);
    const weight = 1 / (1 + dist);
    totalWeight += weight;
    if (checkNumberSuccess(num, myW, myB, opW, opB)) {
      successWeight += weight;
    }
  }
  return totalWeight > 0 ? successWeight / totalWeight : 0;
}

/* ── 미래 자원 밸런스 평가 ───────────────────────────── */

function resourcePenalty(
  ai: NF4PlayerInternal,
  white: number,
  remainingRounds: number,
): number {
  const futureRounds = remainingRounds - 1;
  if (futureRounds <= 0) return 0;

  const futureW = ai.remainingWhite - white;
  const futureB = ai.remainingBlack - (TILES_PER_ROUND - white);
  const avgW = futureW / futureRounds;
  const avgB = futureB / futureRounds;

  let penalty = 0;
  if (avgW < 1 || avgB < 1) penalty -= 0.3;
  if (avgW < 0.5 || avgB < 0.5) penalty -= 0.7;
  return penalty;
}

/* ── 타이브레이커 누적 넘버합 ────────────────────────── */

function getMyNumberSum(s: InternalState, ai: NF4PlayerInternal): number {
  let sum = 0;
  for (const rec of s.roundHistory) {
    const pr = rec.players[ai.id];
    if (pr) sum += pr.number;
  }
  return sum;
}

/* ── 통합 최적화: 최적 플랜 탐색 ────────────────────── */

function findBestPlan(s: InternalState, ai: NF4PlayerInternal): Plan {
  const op = getOpponent(s, ai);
  const opRange = getOpponentTileRange(op);
  const tendency = estimateTendency(s, op, opRange);
  const remainingRounds = TOTAL_ROUNDS - s.round + 1;
  const scoreDiff = ai.score - op.score;

  const aiMinW = Math.max(0, TILES_PER_ROUND - ai.remainingBlack);
  const aiMaxW = Math.min(TILES_PER_ROUND, ai.remainingWhite);

  const plans: Plan[] = [];

  for (let w = aiMinW; w <= aiMaxW; w++) {
    const b = TILES_PER_ROUND - w;
    const resPen = resourcePenalty(ai, w, remainingRounds);

    for (let n = 0; n <= 4; n++) {
      const num = n as NF4Number;
      const prob = calcPreciseProb(num, w, b, opRange, tendency);
      const rawEV = prob * REWARDS[n] - (1 - prob) * 1;
      const tiebreakerBonus = (4 - n) * 0.05;
      const ev = rawEV + resPen + tiebreakerBonus;
      plans.push({ white: w, black: b, number: num, ev, successProb: prob });
    }
  }

  if (plans.length === 0) {
    return { white: ai.remainingWhite, black: ai.remainingBlack, number: 1, ev: 0, successProb: 0 };
  }

  return selectByStrategy(plans, s, ai, scoreDiff, remainingRounds);
}

function selectByStrategy(
  plans: Plan[],
  s: InternalState,
  ai: NF4PlayerInternal,
  scoreDiff: number,
  remainingRounds: number,
): Plan {
  // 탈락 위기: 성공 확률 최우선
  if (ai.score <= 1) {
    return selectSafest(plans);
  }

  // 막판 역전이 필요한 경우
  if (scoreDiff <= -2 && remainingRounds <= 2) {
    return selectComebackPlan(plans, -scoreDiff);
  }

  // 열세: 고보상 넘버에 가중치
  if (scoreDiff <= -2) {
    return selectAggressivePlan(plans);
  }

  // 안정 우위 / 접전: 기대값 최대 (약간의 랜덤성)
  return selectBestEV(plans);
}

function selectSafest(plans: Plan[]): Plan {
  let best = plans[0];
  for (const p of plans) {
    if (p.successProb > best.successProb ||
        (p.successProb === best.successProb && p.ev > best.ev)) {
      best = p;
    }
  }
  return best;
}

function selectComebackPlan(plans: Plan[], deficit: number): Plan {
  const viable = plans.filter(p => REWARDS[p.number] >= deficit && p.successProb > 0.1);
  if (viable.length > 0) {
    return viable.reduce((best, p) => p.ev > best.ev ? p : best);
  }
  return selectAggressivePlan(plans);
}

function selectAggressivePlan(plans: Plan[]): Plan {
  let best = plans[0];
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

function selectBestEV(plans: Plan[]): Plan {
  let best = plans[0];
  let bestScore = -Infinity;
  for (const p of plans) {
    const jitter = (Math.random() - 0.5) * 0.2;
    const score = p.ev + jitter;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/* ── 공개 API ────────────────────────────────────────── */

export async function aiSubmitTiles(io: IO, s: InternalState) {
  if (s.gameOver) return;
  const ai = s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
  if (ai.submitted && ai.submittedWhite !== null) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (!gameStates.has(s.roomId) || s.gameOver) return;
  if (s.aiGeneration !== gen) return;

  const plan = findBestPlan(s, ai);
  s.aiTargetNumber = plan.number;

  ai.submittedWhite = plan.white;
  ai.submittedBlack = plan.black;
  ai.submitted = true;

  if (s.player1.submitted && s.player2.submitted) {
    s.phase = 'numberSubmit';
    s.player1.submitted = false;
    s.player2.submitted = false;
  }

  broadcastState(io, s);
}

export async function aiSubmitNumber(io: IO, s: InternalState) {
  if (s.gameOver) return;
  const ai = s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
  if (ai.submitted && ai.submittedNumber !== null) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (!gameStates.has(s.roomId) || s.gameOver) return;
  if (s.aiGeneration !== gen) return;

  ai.submittedNumber = s.aiTargetNumber ?? 1;
  ai.submitted = true;
  s.aiTargetNumber = null;

  if (s.player1.submitted && s.player2.submitted) {
    processRound(io, s);
  } else {
    broadcastState(io, s);
  }
}
