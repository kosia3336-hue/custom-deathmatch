/**
 * 베팅! 가위바위보 — COM AI
 *
 * 설계 원칙: 확률 주사위가 아닌 기대값(EV) 계산 기반 의사결정
 *
 * 【베팅 역할】
 *   EV(win 예측) = P_win - P_lose
 *   EV(무 예측)  = 3*P_draw - 1
 *   EV(lose 예측) = P_lose - P_win
 *   → 최고 EV 예측 선택. 베팅량은 켈리 공식.
 *
 * 【승부 역할】
 *   ΔchipGap(win 선택)  = bonus - B_est*(2*q_win - 1)
 *   ΔchipGap(draw 선택) = -2*B_est*q_draw
 *   ΔchipGap(lose 선택) = -B_est*(2*q_lose - 1)
 *   → 최고 ΔchipGap 선택.
 *
 * 【확률 추정】
 *   베이즈 사전 분포 + 최근 가중 관측값으로 사후 분포 계산.
 */

import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { BRPSResult } from '@shared/types/betting-rps.js';
import { brpsMatchWinBonus } from '@shared/types/betting-rps.js';
import { AI_DELAY, ROLE_SELECT_AI_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, BRPSPlayerInternal } from './types.js';
import {
  gameStates,
  broadcastState,
  processRound,
  assignRoles,
  getChoiceRightId,
} from './state.js';

/* ────────── 기본 유틸 ────────── */

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

function getAI(s: InternalState): BRPSPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}

function getUser(s: InternalState): BRPSPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

function roundsLeft(s: InternalState): number {
  return s.totalRounds - s.round;
}

/* ────────── 타입 ────────── */

type Probs = { win: number; draw: number; lose: number };

/* ════════════════════════════════════════
   베이즈 확률 추정
════════════════════════════════════════ */

/**
 * 사전 분포: 유저가 '승부' 역할일 때
 * - 초반엔 칩을 모으려고 '승' 선택 多
 * - '무'는 후반 심리전에서나 쓰임 (초반 빈도 매우 낮음)
 * - '패'는 역심리 블러프 용도
 */
const MATCH_PRIOR: Probs = { win: 4.5, draw: 1.0, lose: 3.0 };
const MATCH_PRIOR_TOTAL = MATCH_PRIOR.win + MATCH_PRIOR.draw + MATCH_PRIOR.lose; // 8.5

/**
 * 사전 분포: 유저가 '베팅' 역할일 때
 * - '무' 예측은 드묾 (초반에 특히 거의 안 씀)
 */
const BET_PRIOR: Probs = { win: 4.0, draw: 0.8, lose: 3.5 };
const BET_PRIOR_TOTAL = BET_PRIOR.win + BET_PRIOR.draw + BET_PRIOR.lose; // 8.3

/** 최근 라운드에 가중치를 두어 유저의 승부 선택 기록 집계 */
function getUserMatchHistory(s: InternalState): { counts: Probs; total: number } {
  const user = getUser(s);
  const counts: Probs = { win: 0, draw: 0, lose: 0 };
  const logs = s.actionLog;
  for (let i = 0; i < logs.length; i++) {
    const p = logs[i].players[user.id];
    if (p?.role === 'match' && p.matchResult) {
      const w = 1 + i / Math.max(1, logs.length - 1); // 1.0 ~ 2.0
      counts[p.matchResult] += w;
    }
  }
  return { counts, total: counts.win + counts.draw + counts.lose };
}

/** 최근 라운드에 가중치를 두어 유저의 베팅 예측 기록 집계 */
function getUserBetHistory(s: InternalState): { counts: Probs; total: number } {
  const user = getUser(s);
  const counts: Probs = { win: 0, draw: 0, lose: 0 };
  const logs = s.actionLog;
  for (let i = 0; i < logs.length; i++) {
    const p = logs[i].players[user.id];
    if (p?.role === 'bet' && p.prediction) {
      const w = 1 + i / Math.max(1, logs.length - 1);
      counts[p.prediction] += w;
    }
  }
  return { counts, total: counts.win + counts.draw + counts.lose };
}

/** 사후 분포: 유저가 승부 역할에서 각 결과를 선택할 확률 */
function estimateMatchProbs(s: InternalState): Probs {
  const { counts, total } = getUserMatchHistory(s);
  const denom = MATCH_PRIOR_TOTAL + total;
  return {
    win: (MATCH_PRIOR.win + counts.win) / denom,
    draw: (MATCH_PRIOR.draw + counts.draw) / denom,
    lose: (MATCH_PRIOR.lose + counts.lose) / denom,
  };
}

/** 사후 분포: 유저가 베팅 역할에서 각 결과를 예측할 확률 */
function estimateBetProbs(s: InternalState): Probs {
  const { counts, total } = getUserBetHistory(s);
  const denom = BET_PRIOR_TOTAL + total;
  return {
    win: (BET_PRIOR.win + counts.win) / denom,
    draw: (BET_PRIOR.draw + counts.draw) / denom,
    lose: (BET_PRIOR.lose + counts.lose) / denom,
  };
}

/** 유저의 평균 베팅 칩 수 추정 (기록 없으면 현재 칩의 35%) */
function estimateUserBetAmount(s: InternalState): number {
  const user = getUser(s);
  if (user.chips === 0) return 0;
  const bets: number[] = [];
  for (const log of s.actionLog) {
    const p = log.players[user.id];
    if (p?.role === 'bet' && p.betChips != null) bets.push(p.betChips);
  }
  if (bets.length === 0) return Math.max(1, Math.round(user.chips * 0.35));
  return Math.max(1, Math.round(bets.reduce((a, b) => a + b, 0) / bets.length));
}

/* ════════════════════════════════════════
   기대값(EV) 계산
════════════════════════════════════════ */

/**
 * 베팅 1칩당 기대 순이득 (각 예측별)
 *
 * win 예측:  승부='win'이면 +1, 승부='draw'이면 0(환불), 승부='lose'이면 -1
 *            → EV = P_win - P_lose
 * draw 예측: 승부='draw'이면 +2, 나머지 -1
 *            → EV = 3*P_draw - 1
 * lose 예측: 승부='lose'이면 +1, 승부='draw'이면 0(환불), 승부='win'이면 -1
 *            → EV = P_lose - P_win
 */
function calcBetEVPerChip(mp: Probs): Probs {
  return {
    win: mp.win - mp.lose,
    draw: 3 * mp.draw - 1,
    lose: mp.lose - mp.win,
  };
}

/**
 * 켈리 비율 (bankroll 대비 최적 베팅 비율)
 *
 * win/lose 예측 (환불 포함 홀짝 베팅):  kelly = P_success - P_fail
 * draw 예측 (2:1 순배율 베팅):          kelly = (3*P_draw - 1) / 2
 * EV < 0이면 0 (베팅 불가)
 */
function calcKellyFractions(mp: Probs): Probs {
  return {
    win: Math.max(0, mp.win - mp.lose),
    draw: Math.max(0, (3 * mp.draw - 1) / 2),
    lose: Math.max(0, mp.lose - mp.win),
  };
}

/**
 * 승부 역할에서 각 선택이 만들어내는 칩갭 변화량 (AI 관점)
 *
 * ΔchipGap = Δai.chips − Δuser.chips
 *
 * win 선택:  AI +bonus, 유저 기대이득 = B*(2*q_w - 1)
 *            → bonus - B*(2*q_w - 1)
 * draw 선택: AI +0,     유저 기대이득 = 2B*q_d
 *            → -2B*q_d
 * lose 선택: AI +0,     유저 기대이득 = B*(2*q_l - 1)
 *            → -B*(2*q_l - 1)
 */
function calcMatchNetScores(s: InternalState, betProbs: Probs, avgBet: number): Probs {
  const bonus = brpsMatchWinBonus(s.round);
  const { win: qw, draw: qd, lose: ql } = betProbs;
  return {
    win: bonus - avgBet * (2 * qw - 1),
    draw: -2 * avgBet * qd,
    lose: -avgBet * (2 * ql - 1),
  };
}

/* ════════════════════════════════════════
   선택 헬퍼
════════════════════════════════════════ */

function argmax(scores: Probs): BRPSResult {
  if (scores.win >= scores.draw && scores.win >= scores.lose) return 'win';
  if (scores.draw >= scores.lose) return 'draw';
  return 'lose';
}

/**
 * 점수를 소프트맥스로 변환 후 샘플링 (노이즈용)
 * temperature 낮을수록 argmax에 가까움
 */
function softmaxSample(scores: Probs, temperature: number): BRPSResult {
  const keys: BRPSResult[] = ['win', 'draw', 'lose'];
  const maxS = Math.max(scores.win, scores.draw, scores.lose);
  const exps = keys.map((k) => Math.exp((scores[k] - maxS) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  const cumProbs = exps.map((e) => e / sum);
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < keys.length; i++) {
    cum += cumProbs[i];
    if (r < cum) return keys[i];
  }
  return keys[keys.length - 1];
}

/* ════════════════════════════════════════
   역할 선택
════════════════════════════════════════ */

function decideRole(s: InternalState): 'match' | 'bet' {
  const ai = getAI(s);
  const user = getUser(s);

  // 하드 룰
  if (ai.chips === 0) return 'match'; // 베팅 칩 없음
  if (user.chips === 0) return 'match'; // 상대 베팅 불가

  const bonus = brpsMatchWinBonus(s.round);

  // ── 승부 역할 EV ──
  // AI가 승부를 맡으면 최적 선택(ΔchipGap 최대)을 보장할 수 있음
  const betProbs = estimateBetProbs(s);
  const avgUserBet = estimateUserBetAmount(s);
  const netScores = calcMatchNetScores(s, betProbs, avgUserBet);
  const matchRoleScore = Math.max(netScores.win, netScores.draw, netScores.lose);

  // ── 베팅 역할 EV ──
  // AI가 베팅을 맡으면: 기대 베팅 수익 - 유저(승부 역할)의 기대 칩 획득
  const matchProbs = estimateMatchProbs(s);
  const evs = calcBetEVPerChip(matchProbs);
  const kellys = calcKellyFractions(matchProbs);
  const bestPred = argmax(evs);
  const bestEV = evs[bestPred];
  const safeKelly = kellys[bestPred] * 0.4;
  const aiExpectedBetGain = bestEV > 0 ? bestEV * safeKelly * ai.chips : 0;
  // 유저가 승부를 맡으면 '승' 선택 시 bonus 획득 → AI에게 불리
  const userExpectedMatchGain = matchProbs.win * bonus;
  const betRoleScore = aiExpectedBetGain - userExpectedMatchGain;

  // 점수 비교 → 명확한 우위면 확정, 아니면 확률적
  const diff = matchRoleScore - betRoleScore;
  if (diff > 0.5) {
    return Math.random() < 0.9 ? 'match' : 'bet'; // 10% 노이즈
  }
  if (diff < -0.5) {
    return Math.random() < 0.9 ? 'bet' : 'match';
  }
  // 박빙: 우위 방향으로 60%
  return Math.random() < (diff >= 0 ? 0.6 : 0.4) ? 'match' : 'bet';
}

/* ════════════════════════════════════════
   승부 역할 — 결과 선택
════════════════════════════════════════ */

function decideMatchResult(s: InternalState): BRPSResult {
  const betProbs = estimateBetProbs(s);
  const avgUserBet = estimateUserBetAmount(s);
  const netScores = calcMatchNetScores(s, betProbs, avgUserBet);
  const best = argmax(netScores);

  // 85% 확률로 수학적 최적; 15%는 소프트맥스 노이즈 (패턴 흐리기)
  if (Math.random() < 0.85) return best;
  return softmaxSample(netScores, 1.0);
}

/* ════════════════════════════════════════
   베팅 역할 — 예측 + 칩 수
════════════════════════════════════════ */

function decidePredictionAndChips(s: InternalState): { prediction: BRPSResult; chips: number } {
  const ai = getAI(s);
  if (ai.chips === 0) return { prediction: 'win', chips: 0 };

  const matchProbs = estimateMatchProbs(s);
  const evs = calcBetEVPerChip(matchProbs);
  const kellys = calcKellyFractions(matchProbs);

  // ── 예측 선택 ──
  const bestByEV = argmax(evs);
  const bestEV = evs[bestByEV];
  let prediction: BRPSResult;

  if (bestEV > 0.1 && Math.random() < 0.88) {
    // EV 명확히 양수 → 확정 (88%)
    prediction = bestByEV;
  } else if (bestEV > 0 && Math.random() < 0.75) {
    // EV 약하게 양수 → 주로 확정
    prediction = bestByEV;
  } else {
    // EV 0 근방 또는 전부 음수 → 소프트맥스 (최소 손실 선택)
    prediction = softmaxSample(evs, 0.5);
  }

  // ── 켈리 기반 베팅량 ──
  const kellyFrac = kellys[prediction];
  const left = roundsLeft(s);
  const chipGap = ai.chips - getUser(s).chips;

  // 안전 계수 (기본 0.4배 켈리)
  let factor = 0.4;
  if (chipGap >= 3) factor = 0.2; // 크게 앞서면 보수적
  if (chipGap <= -3) factor = 0.55; // 뒤처지면 공격적
  if (chipGap < 0 && left <= 2) factor = 0.8; // 막판 역전 필요
  if (left <= 1) factor = 1.0; // 마지막 라운드 = 풀 켈리

  // EV 음수인 예측을 어쩔 수 없이 고른 경우 → 최소 베팅
  if (kellyFrac <= 0) return { prediction, chips: 1 };

  const targetRatio = Math.min(kellyFrac * factor, 1.0);
  let bet = Math.ceil(ai.chips * targetRatio);

  // 마지막 라운드 아니면 1칩 이상 남기기 (0칩 자멸 방지)
  if (left > 1 && bet >= ai.chips) bet = ai.chips - 1;

  return { prediction, chips: Math.max(1, Math.min(ai.chips, bet)) };
}

/* ════════════════════════════════════════
   진입점
════════════════════════════════════════ */

export async function aiSelectRole(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'roleSelect') return;
  const aiId = AI_PLAYER_ID;
  if (getChoiceRightId(s) !== aiId) return;

  const gen = s.aiGeneration;
  await wait(randDelay(ROLE_SELECT_AI_DELAY));
  if (gameStates.get(s.roomId) !== s || s.gameOver) return;
  if (s.aiGeneration !== gen || s.phase !== 'roleSelect') return;

  const role = decideRole(s);
  assignRoles(s, aiId, role);
  s.phase = 'submit';
  broadcastState(io, s);

  const ai = getAI(s);
  if (!ai.submitted) aiSubmit(io, s);
}

export async function aiSubmit(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'submit') return;
  const ai = getAI(s);
  if (ai.submitted) return;

  const gen = s.aiGeneration;
  await wait(randDelay(AI_DELAY));
  if (gameStates.get(s.roomId) !== s || s.gameOver) return;
  if (s.aiGeneration !== gen || s.phase !== 'submit' || ai.submitted) return;

  if (ai.role === 'match') {
    ai.matchResult = decideMatchResult(s);
  } else {
    const { prediction, chips } = decidePredictionAndChips(s);
    ai.prediction = prediction;
    ai.betChips = chips;
  }
  ai.submitted = true;

  const other = ai.id === s.player1.id ? s.player2 : s.player1;
  if (other.submitted) {
    processRound(io, s);
  } else {
    broadcastState(io, s);
  }
}
