/**
 * 인디언홀덤 (이벤트) — 손패 평가 / 다수 비교.
 * 기존 2인용 `indian-poker/judge.ts` 로직을 N인 비교로 확장한다.
 */

import type { IPHand } from '@shared/types/indian-poker.js';
import { IPE_DIE_PENALTY } from '@shared/types/indian-poker-event.js';

const HAND_RANK: Record<IPHand, number> = {
  noPair: 0,
  double: 1,
  straight: 2,
  triple: 3,
};

/** 본인 카드 + 커뮤니티 2장으로 손패 평가. */
export function evaluateHand(
  playerCard: number,
  communityCards: [number, number],
): IPHand {
  const [c1, c2] = communityCards;

  if (playerCard === c1 && playerCard === c2) return 'triple';

  const sorted = [playerCard, c1, c2].sort((a, b) => a - b);

  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) return 'straight';

  // 백스트레이트 (1~10 순환): [1,9,10] / [1,2,10]
  if (sorted[0] === 1 && sorted[2] === 10 && (sorted[1] === 9 || sorted[1] === 2)) {
    return 'straight';
  }

  if (playerCard === c1 || playerCard === c2) return 'double';

  return 'noPair';
}

export interface JudgeCandidate {
  id: string;
  card: number;
  hand: IPHand;
}

export interface JudgeResult {
  /** 단독 승자가 있으면 1명, 무승부면 다수. */
  winnerIds: string[];
  /** 무승부 여부 (winnerIds.length >= 2). */
  isDraw: boolean;
}

/**
 * 살아있는(다이하지 않은) 후보들 중 최강 손패 보유자(들) 반환.
 * - 손패 랭크 우선
 * - 동일 랭크 시 카드 숫자 우선 (10 > 9 > ...)
 * - 카드까지 같으면 무승부
 */
export function judgeShowdownMany(candidates: JudgeCandidate[]): JudgeResult {
  if (candidates.length === 0) return { winnerIds: [], isDraw: false };
  if (candidates.length === 1) {
    return { winnerIds: [candidates[0].id], isDraw: false };
  }

  let bestRank = -1;
  let bestCard = -1;
  let winners: string[] = [];

  for (const c of candidates) {
    const r = HAND_RANK[c.hand];
    if (r > bestRank) {
      bestRank = r;
      bestCard = c.card;
      winners = [c.id];
    } else if (r === bestRank) {
      if (c.card > bestCard) {
        bestCard = c.card;
        winners = [c.id];
      } else if (c.card === bestCard) {
        winners.push(c.id);
      }
    }
  }

  return { winnerIds: winners, isDraw: winners.length > 1 };
}

export function getDiePenalty(hand: IPHand): number {
  return IPE_DIE_PENALTY[hand] ?? 0;
}
