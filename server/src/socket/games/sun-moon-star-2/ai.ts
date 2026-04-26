import { AI_PLAYER_ID } from '@shared/types/room.js';
import type {
  SMS2ChipBet, SMS2MarkId, SMS2PowderSubmission,
} from '@shared/types/sun-moon-star-2.js';
import {
  MARK_IDS, firstMaxBet, secondMinBet, sumBet, zeroBet, zeroPowder,
} from '@shared/types/sun-moon-star-2.js';
import { AI_THINK_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { SMS2InternalState, SMS2PlayerInternal } from './types.js';
import {
  gameStates, trySubmitPowder, trySubmitBet, resetTimeout,
} from './state.js';

function wait(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function randDelay(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

function getAI(s: SMS2InternalState): SMS2PlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}

function getUser(s: SMS2InternalState): SMS2PlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

/* ────────── 빛가루 분배 ────────── */

function pickPowder(s: SMS2InternalState): SMS2PowderSubmission {
  const ai = getAI(s);
  const user = getUser(s);
  const remain = ai.powderRemain;
  if (remain <= 0) return zeroPowder();

  const remainRounds = Math.max(1, s.maxRound - s.round + 1);
  // 이번 라운드 사용량 기준: 평균 + 노이즈
  const targetAvg = Math.max(1, Math.floor(remain / remainRounds));
  const variance = Math.floor(targetAvg * 0.6);
  let toUse = Math.max(0, targetAvg + Math.floor((Math.random() - 0.5) * 2 * variance));
  // 불리하면 더 공격적으로
  if (ai.chips < user.chips) toUse = Math.min(remain, Math.floor(toUse * 1.3));
  toUse = Math.min(remain, toUse);

  if (toUse <= 0) return zeroPowder();

  // 표식별 분배: 현재 내 기여가 적은 쪽이나 누적이 적은 쪽에 편중
  // 완전 랜덤 + 약간의 휴리스틱으로 혼합
  const weights: Record<SMS2MarkId, number> = { sun: 0, moon: 0, star: 0 };
  for (const mark of MARK_IDS) {
    // 기본 가중치
    let w = 1 + Math.random() * 2;
    // sun은 우선순위 유리 → 동률 시 유리하므로 약간 가점
    if (mark === 'sun') w += 0.4;
    // 이미 내가 많이 기여한 표식은 점등 가능성이 높아지므로 살짝 선호
    const myContrib = ai.markContribution[mark];
    if (myContrib >= 10) w += 0.6;
    weights[mark] = w;
  }

  // 때때로 한 표식 집중 (33%)
  if (Math.random() < 0.33) {
    const marks = [...MARK_IDS];
    const focus = marks[Math.floor(Math.random() * marks.length)];
    const res = { sun: 0, moon: 0, star: 0 };
    res[focus] = toUse;
    return res;
  }

  const totalW = weights.sun + weights.moon + weights.star;
  const raw = {
    sun: (weights.sun / totalW) * toUse,
    moon: (weights.moon / totalW) * toUse,
    star: (weights.star / totalW) * toUse,
  };
  const res: SMS2PowderSubmission = {
    sun: Math.floor(raw.sun),
    moon: Math.floor(raw.moon),
    star: Math.floor(raw.star),
  };
  // 반올림 조정
  let diff = toUse - (res.sun + res.moon + res.star);
  const order: SMS2MarkId[] = ['sun', 'moon', 'star'];
  let i = 0;
  while (diff > 0) {
    res[order[i % order.length]] += 1;
    diff -= 1;
    i += 1;
  }
  return res;
}

/* ────────── 칩 베팅 ────────── */

function pickBet(s: SMS2InternalState, isFirst: boolean): SMS2ChipBet {
  const ai = getAI(s);
  const user = getUser(s);

  let totalToBet: number;
  if (isFirst) {
    const maxAllowed = firstMaxBet(user.chips);
    const limit = Math.min(ai.chips, maxAllowed);
    // 대체로 한도의 50~100% 사이에서 베팅
    const frac = 0.4 + Math.random() * 0.6;
    totalToBet = Math.max(0, Math.min(limit, Math.floor(limit * frac)));
    // 우세하면 적극적, 열세면 신중
    if (ai.chips <= 2 && user.chips >= 5) totalToBet = Math.max(0, totalToBet - 1);
  } else {
    const firstBet = user.pendingBet ?? zeroBet();
    const firstTotal = sumBet(firstBet);
    const minReq = secondMinBet(firstTotal);
    if (minReq > ai.chips) {
      // 불가능한 상황이지만 안전 가드: 최대로
      totalToBet = ai.chips;
    } else if (minReq === 0) {
      // 선 0 → 자유 (0 또는 적절히 2~3개 투자)
      const avgBet = Math.min(ai.chips, Math.max(0, Math.floor(Math.random() * 3)));
      totalToBet = avgBet;
    } else {
      // 최소 이상 ~ ai.chips
      const extra = Math.floor(Math.random() * Math.max(1, ai.chips - minReq + 1));
      totalToBet = Math.min(ai.chips, minReq + extra);
    }
  }

  if (totalToBet <= 0) return zeroBet();

  // 분배: 내가 빛가루 많이 기여한 표식에 편중
  const weights: Record<SMS2MarkId, number> = { sun: 0, moon: 0, star: 0 };
  for (const mark of MARK_IDS) {
    let w = 1 + Math.random();
    const myContrib = ai.markContribution[mark];
    if (myContrib >= 10) w += 1.5;
    if (myContrib >= 20) w += 1.5;
    if (mark === 'sun') w += 0.3;
    // 후 베팅의 경우, 선이 많이 베팅한 표식은 유리하다고 판단 가능
    if (!isFirst) {
      const firstBet = user.pendingBet ?? zeroBet();
      w += firstBet[mark] * 0.4;
    }
    weights[mark] = w;
  }

  // 때때로 한 표식 집중
  if (Math.random() < 0.4) {
    const ordered = (Object.entries(weights) as [SMS2MarkId, number][])
      .sort((a, b) => b[1] - a[1]);
    const focus = ordered[0][0];
    const res: SMS2ChipBet = { sun: 0, moon: 0, star: 0 };
    res[focus] = totalToBet;
    return res;
  }

  const totalW = weights.sun + weights.moon + weights.star;
  const raw = {
    sun: (weights.sun / totalW) * totalToBet,
    moon: (weights.moon / totalW) * totalToBet,
    star: (weights.star / totalW) * totalToBet,
  };
  const res: SMS2ChipBet = {
    sun: Math.floor(raw.sun),
    moon: Math.floor(raw.moon),
    star: Math.floor(raw.star),
  };
  let diff = totalToBet - (res.sun + res.moon + res.star);
  const order: SMS2MarkId[] = ['sun', 'moon', 'star'];
  let i = 0;
  while (diff > 0) {
    res[order[i % order.length]] += 1;
    diff -= 1;
    i += 1;
  }
  return res;
}

/* ────────── AI 턴 처리 ────────── */

export async function handleAiTurn(io: IO, s: SMS2InternalState) {
  const ai = getAI(s);
  if (!ai) return;

  const gen = s.aiGeneration;

  if (s.phase === 'powder') {
    if (ai.pendingPowder) return;
    await wait(randDelay(AI_THINK_DELAY));
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'powder') return;
    if (ai.pendingPowder) return;
    const powder = pickPowder(s);
    resetTimeout(s, ai.id);
    trySubmitPowder(io, s, ai.id, powder);
    return;
  }

  if (s.phase === 'betFirst') {
    const first = s.firstPlayerSide === ai.side ? ai : null;
    if (!first) return;
    if (first.pendingBet) return;
    await wait(randDelay(AI_THINK_DELAY));
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'betFirst') return;
    if (first.pendingBet) return;
    const bet = pickBet(s, true);
    resetTimeout(s, ai.id);
    trySubmitBet(io, s, ai.id, bet);
    return;
  }

  if (s.phase === 'betSecond') {
    const isAiSecond = s.firstPlayerSide !== ai.side;
    if (!isAiSecond) return;
    if (ai.pendingBet) return;
    await wait(randDelay(AI_THINK_DELAY));
    if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'betSecond') return;
    if (ai.pendingBet) return;
    const bet = pickBet(s, false);
    resetTimeout(s, ai.id);
    trySubmitBet(io, s, ai.id, bet);
    return;
  }
}
