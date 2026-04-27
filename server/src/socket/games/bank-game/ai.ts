import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { BankBet, BankDenomination } from '@shared/types/bank-game.js';
import {
  BANK_DENOMINATIONS, sumBetAmount, sumBetCount,
  sumInventoryAmount, sumInventoryCount, zeroBet,
} from '@shared/types/bank-game.js';
import {
  AI_THINK_DELAY_EASY,
  AI_THINK_DELAY_HARD,
  AI_THINK_DELAY_NORMAL,
} from './constants.js';
import type { BankAiDifficulty, IO } from './constants.js';
import type { BankInternalState, BankPlayerInternal } from './types.js';
import { gameStates, resetTimeout, trySubmitBet } from './state.js';

function wait(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function randDelay(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

function getAI(s: BankInternalState): BankPlayerInternal | null {
  if (s.player1.id === AI_PLAYER_ID) return s.player1;
  if (s.player2.id === AI_PLAYER_ID) return s.player2;
  return null;
}

function getUser(s: BankInternalState): BankPlayerInternal | null {
  if (s.player1.id === AI_PLAYER_ID) return s.player2;
  if (s.player2.id === AI_PLAYER_ID) return s.player1;
  return null;
}

function delayFor(diff: BankAiDifficulty): { min: number; max: number } {
  switch (diff) {
    case 'easy': return AI_THINK_DELAY_EASY;
    case 'hard': return AI_THINK_DELAY_HARD;
    default: return AI_THINK_DELAY_NORMAL;
  }
}

/* ────────── 베팅 합성 헬퍼 ────────── */

/** 인벤토리 한도 안에서 가능한 한 `targetAmount`에 가깝게 베팅을 구성. */
function buildBetTargetingAmount(inv: BankBet, targetAmount: number): BankBet {
  const bet = zeroBet();
  let remaining = Math.max(0, targetAmount);
  // 큰 액면부터 욕심내며 채우되, 너무 부족하면 마지막에 1k로 보정
  const ordered: BankDenomination[] = [10000, 5000, 3000, 1000];
  for (const d of ordered) {
    if (remaining <= 0) break;
    const maxByInv = inv[d] - bet[d];
    if (maxByInv <= 0) continue;
    const need = Math.min(maxByInv, Math.floor(remaining / d));
    bet[d] += need;
    remaining -= need * d;
  }
  // 남은 부분(d=1000보다 작은 mod)은 1k 추가로 메우기
  if (remaining > 0 && inv[1000] - bet[1000] > 0) {
    const add = Math.min(inv[1000] - bet[1000], Math.ceil(remaining / 1000));
    bet[1000] += add;
  }
  return bet;
}

/** 인벤토리 한도 안에서 `targetAmount`에 가깝게, 단 1k 위주로 장수 부풀려서 베팅 (블러프) */
function buildBluffBet(inv: BankBet, targetAmount: number): BankBet {
  const bet = zeroBet();
  // 1k 최대 사용 → 그래도 부족하면 3k, 5k, 10k 순으로 채움
  const wanted1k = Math.min(inv[1000], Math.floor(targetAmount / 1000));
  bet[1000] = wanted1k;
  let remaining = targetAmount - wanted1k * 1000;
  const ordered: BankDenomination[] = [3000, 5000, 10000];
  for (const d of ordered) {
    if (remaining <= 0) break;
    const need = Math.min(inv[d], Math.floor(remaining / d));
    bet[d] = need;
    remaining -= need * d;
  }
  if (remaining > 0 && inv[1000] - bet[1000] > 0) {
    const add = Math.min(inv[1000] - bet[1000], Math.ceil(remaining / 1000));
    bet[1000] += add;
  }
  return bet;
}

/** AI 베팅 결정 — 난이도별 전략 */
function pickBet(s: BankInternalState, isFirst: boolean): BankBet {
  const ai = getAI(s);
  if (!ai) return zeroBet();
  const user = getUser(s);
  const diff = s.options.aiDifficulty;

  const aiInv = ai.inventory;
  const aiAmountRemain = sumInventoryAmount(aiInv);
  const aiCountRemain = sumInventoryCount(aiInv);
  const remainRounds = Math.max(1, s.maxRound - s.round + 1);
  // 이번 라운드 평균 사용 금액 = 잔여 금액 / 잔여 라운드 수
  const baseTarget = Math.floor(aiAmountRemain / remainRounds);

  if (aiCountRemain <= 0) return zeroBet();

  if (diff === 'easy') {
    // 단순: 평균 ± 30% 노이즈, 가끔 0장 (10%)
    if (Math.random() < 0.1) return zeroBet();
    const noise = 0.7 + Math.random() * 0.6;
    const target = Math.max(0, Math.min(aiAmountRemain, Math.floor(baseTarget * noise)));
    return buildBetTargetingAmount(aiInv, target);
  }

  // normal/hard 공통: 점수 격차 반영
  const myScore = ai.score;
  const oppScore = user?.score ?? 0;
  const scoreDiff = myScore - oppScore; // +면 우세
  const remainAfter = remainRounds - 1;

  // 우세하면 보수적, 열세하면 공격적
  let aggression = 1.0;
  if (scoreDiff >= 2) aggression = 0.7;
  else if (scoreDiff >= 1) aggression = 0.85;
  else if (scoreDiff <= -2) aggression = 1.4;
  else if (scoreDiff <= -1) aggression = 1.2;

  // 마지막 라운드는 자원 다 쏟아붓기
  if (s.round >= s.maxRound) aggression = Math.max(aggression, 1.6);
  // 라운드가 얼마 남지 않았는데 자원이 많으면 더 공격적
  if (remainAfter > 0 && aiAmountRemain / remainAfter > baseTarget * 1.5) {
    aggression *= 1.15;
  }

  if (isFirst) {
    // 선: 후의 추리를 흐리기 위해 노이즈 추가
    if (diff === 'hard' && Math.random() < 0.18) {
      // 가끔 블러프 — 1k 위주로 적은 금액에 큰 장수
      const bluffTarget = Math.max(2000, Math.floor(baseTarget * 0.5));
      return buildBluffBet(aiInv, bluffTarget);
    }
    if (Math.random() < 0.05) return zeroBet(); // 가끔 포기
    const noise = 0.8 + Math.random() * 0.4;
    const target = Math.max(0, Math.min(aiAmountRemain, Math.floor(baseTarget * aggression * noise)));
    return buildBetTargetingAmount(aiInv, target);
  }

  // 후: 선의 장수를 보고 추리
  const first = s.firstSide === ai.side ? null : (s.firstSide === 'p1' ? s.player1 : s.player2);
  const firstBet = first?.pendingBet;
  const firstCount = firstBet ? sumBetCount(firstBet) : 0;

  // 후의 단가 추정 (선의 평균 단가 + 약간 우위로)
  // 누적 패자 금액 기반으로 단가 추정 (사후 정보지만 합리적)
  const estimatedFirstAvgUnit = estimateOpponentUnitPrice(s);
  const estimatedFirstAmount = firstCount > 0
    ? Math.round(estimatedFirstAvgUnit * firstCount)
    : 0;

  if (firstCount === 0) {
    // 선이 0장 → 후는 1k×1 정도만 내도 이김. 자원 절약.
    const minBet: BankBet = zeroBet();
    if (aiInv[1000] > 0) minBet[1000] = 1;
    else {
      // 1k 없으면 가장 작은 단위로 1장
      for (const d of BANK_DENOMINATIONS) {
        if (aiInv[d] > 0) { minBet[d] = 1; break; }
      }
    }
    if (Math.random() < 0.05) return zeroBet(); // 5% 양측 0장 무승부 노림
    return minBet;
  }

  // 후 전략: 선의 추정 금액보다 약간 위 (+10~25%)
  const overBuffer = diff === 'hard'
    ? 1.05 + Math.random() * 0.15
    : 1.10 + Math.random() * 0.20;
  const targetAmount = Math.min(aiAmountRemain, Math.floor(estimatedFirstAmount * overBuffer * aggression));

  // 후의 자원이 충분치 않거나 너무 큰 베팅 필요시: 포기
  if (estimatedFirstAmount > aiAmountRemain * 0.6) {
    // 자원의 60% 초과 필요 → 포기
    if (Math.random() < 0.5) return zeroBet();
  }

  return buildBetTargetingAmount(aiInv, Math.max(targetAmount, 1000));
}

/**
 * 상대(유저)의 평균 단가를 추정.
 * 지금까지 패배한 라운드에서 공개된 패자 금액과 장수를 사용.
 * 정보가 없으면 시작 평균(2,632원/장).
 */
function estimateOpponentUnitPrice(s: BankInternalState): number {
  const ai = getAI(s);
  if (!ai) return 2632;
  const oppSide = ai.side === 'p1' ? 'p2' : 'p1';

  let totalAmount = 0;
  let totalCount = 0;

  for (const r of s.history) {
    if (r.outcome === 'draw') {
      // 동률: 양측 모두 공개
      totalAmount += r.amounts[oppSide];
      totalCount += r.counts[oppSide];
    } else {
      const loserSide = r.outcome === 'first_win'
        ? (r.firstSide === 'p1' ? 'p2' : 'p1')
        : r.firstSide;
      if (loserSide === oppSide) {
        totalAmount += r.amounts[oppSide];
        totalCount += r.counts[oppSide];
      }
      // 승리한 라운드의 상대 금액은 모르므로 누적하지 않음
    }
  }

  if (totalCount === 0) return 2632;
  return totalAmount / totalCount;
}

/* ────────── AI 턴 처리 ────────── */

export async function handleAiTurn(io: IO, s: BankInternalState) {
  const ai = getAI(s);
  if (!ai) return;
  const gen = s.aiGeneration;
  const delay = delayFor(s.options.aiDifficulty);

  if (s.phase === 'firstSubmit') {
    if (s.firstSide !== ai.side) return;
    if (ai.pendingBet) return;
    await wait(randDelay(delay));
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'firstSubmit') return;
    if (ai.pendingBet) return;
    const bet = pickBet(s, true);
    resetTimeout(s, ai.id);
    trySubmitBet(io, s, ai.id, bet);
    return;
  }

  if (s.phase === 'secondSubmit') {
    if (s.firstSide === ai.side) return;
    if (ai.pendingBet) return;
    await wait(randDelay(delay));
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'secondSubmit') return;
    if (ai.pendingBet) return;
    const bet = pickBet(s, false);
    resetTimeout(s, ai.id);
    trySubmitBet(io, s, ai.id, bet);
    return;
  }
}
