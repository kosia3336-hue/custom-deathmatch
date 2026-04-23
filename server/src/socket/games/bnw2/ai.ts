import { AI_PLAYER_ID } from '@shared/types/room.js';
import { BNW2_MAX_SCORE } from './constants.js';
import { AI_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, BNW2PlayerInternal } from './types.js';
import { gameStates, processFirstSubmit, processSecondSubmit } from './state.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

function getAI(s: InternalState): BNW2PlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}

function getUser(s: InternalState): BNW2PlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 유저가 선플 / 후플로 참여했던 라운드의 평균 베팅을 각각 반환한다.
 * actionLog에는 서버 내부 포인트 값이 그대로 기록되어 있다.
 */
function analyzeUserBets(s: InternalState, userId: string): {
  avgAsFirst: number | null;
  avgAsSecond: number | null;
} {
  const asFirst: number[] = [];
  const asSecond: number[] = [];

  for (const log of s.actionLog) {
    const pd = log.players[userId];
    if (!pd) continue;
    if (log.firstPlayerId === userId) {
      asFirst.push(pd.points);
    } else {
      asSecond.push(pd.points);
    }
  }

  return { avgAsFirst: mean(asFirst), avgAsSecond: mean(asSecond) };
}

/* ── 선플 전략 ─────────────────────────────────────────────── */

function decideFirstPoints(s: InternalState, ai: BNW2PlayerInternal): number {
  const remaining = ai.remainingPoints;
  if (remaining === 0) return 0;

  // 잔여 20 이하: 전부 사용
  if (remaining <= 20) return remaining;

  const user = getUser(s);
  const aiNeeded   = BNW2_MAX_SCORE - ai.score;
  const userNeeded = BNW2_MAX_SCORE - user.score;
  const isGamePoint  = userNeeded === 1;
  const isMatchPoint = aiNeeded === 1;

  const { avgAsSecond } = analyzeUserBets(s, user.id);
  // 후플로서 유저의 평균 베팅 (히스토리 없으면 잔여의 20%)
  const expectedUserBet = avgAsSecond ?? user.remainingPoints * 0.2;

  // 게임포인트: 유저가 이번 이기면 게임 끝 → 강하게 막아야
  if (isGamePoint) {
    const target = Math.ceil(expectedUserBet * 1.4);
    return clamp(target, 1, remaining);
  }

  // 매치포인트: AI가 이번 이기면 게임 끝 → 유저 예상값+1로 최소 비용 클로즈
  if (isMatchPoint) {
    const target = Math.ceil(expectedUserBet) + 1;
    return clamp(target, 1, remaining);
  }

  // 승점 우세: 흑 블러핑 — 1~9로 내면 유저는 이기려고 10+ 써야 함
  // 포인트 효율 측면에서 장기적으로 유리
  if (aiNeeded < userNeeded) {
    return randInt(1, Math.min(9, remaining));
  }

  // 승점 열세: 유저 예상 베팅보다 높게 공격
  if (aiNeeded > userNeeded) {
    const target = Math.ceil(expectedUserBet * 1.2);
    return clamp(target, 1, remaining);
  }

  // 중립: 유저 예상 베팅 근처에 약간의 노이즈
  const target = Math.round(expectedUserBet) + randInt(-2, 3);
  return clamp(target, 1, remaining);
}

/* ── 후플 전략 ─────────────────────────────────────────────── */

function decideSecondPoints(s: InternalState, ai: BNW2PlayerInternal): number {
  const remaining = ai.remainingPoints;
  if (remaining === 0) return 0;

  // 서버 특권: 선플의 정확한 제시값을 직접 읽는다
  const firstPoints = s.firstPoints!;
  const user = getUser(s);

  const aiNeeded   = BNW2_MAX_SCORE - ai.score;
  const userNeeded = BNW2_MAX_SCORE - user.score;
  const isGamePoint  = userNeeded === 1;
  const isMatchPoint = aiNeeded === 1;

  const winBid = firstPoints + 1;   // 이 값으로 내면 최소 비용 승리
  const canWin = winBid <= remaining;
  const canTie = firstPoints <= remaining;

  // 게임포인트: 유저가 이번 이기면 게임 끝 → 포인트 효율 무시, 무조건 이겨야
  if (isGamePoint) {
    if (canWin) return winBid;
    return remaining; // 이길 수 없어도 전부 투입
  }

  // 매치포인트: AI가 이번 이기면 게임 끝 → 최소 비용 클로즈
  if (isMatchPoint) {
    if (canWin) return winBid;
    // 이길 수 없으면 포인트 절약
    return 1;
  }

  // 일반 — 이길 수 있으면 최소 비용으로 이기기
  if (canWin) return winBid;

  // 이길 수 없음 — 무승부 가능하고 리드 중이면 무승부 선택
  if (canTie && aiNeeded < userNeeded) return firstPoints;

  // 그 외: 포인트 절약
  return 1;
}

/* ── 외부 진입점 ────────────────────────────────────────────── */

export async function aiSubmitFirst(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'firstSubmit') return;
  const ai = getAI(s);
  if (ai.id !== s.firstPlayerId) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (!gameStates.has(s.roomId) || s.gameOver) return;
  if (s.aiGeneration !== gen || s.phase !== 'firstSubmit') return;

  const points = decideFirstPoints(s, ai);
  processFirstSubmit(io, s, points);
}

export async function aiSubmitSecond(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'secondSubmit') return;
  const ai = getAI(s);
  if (ai.id === s.firstPlayerId) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (!gameStates.has(s.roomId) || s.gameOver) return;
  if (s.aiGeneration !== gen || s.phase !== 'secondSubmit') return;

  const points = decideSecondPoints(s, ai);
  processSecondSubmit(io, s, points);
}
