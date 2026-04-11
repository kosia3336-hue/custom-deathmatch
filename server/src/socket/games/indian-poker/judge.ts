import type { IPHand } from '@shared/types/indian-poker.js';
import { DIE_PENALTY } from './constants.js';

const HAND_RANK: Record<IPHand, number> = {
  noPair: 0,
  double: 1,
  straight: 2,
  triple: 3,
};

export function evaluateHand(
  playerCard: number,
  communityCards: [number, number],
): IPHand {
  const [c1, c2] = communityCards;

  if (playerCard === c1 && playerCard === c2) {
    return 'triple';
  }

  const sorted = [playerCard, c1, c2].sort((a, b) => a - b);
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) {
    return 'straight';
  }

  if (playerCard === c1 || playerCard === c2) {
    return 'double';
  }

  return 'noPair';
}

export interface JudgeResult {
  winnerId: string | null;
  isDraw: boolean;
}

export function judgeShowdown(
  playerA: { id: string; card: number; hand: IPHand },
  playerB: { id: string; card: number; hand: IPHand },
): JudgeResult {
  const rankA = HAND_RANK[playerA.hand];
  const rankB = HAND_RANK[playerB.hand];

  if (rankA !== rankB) {
    return {
      winnerId: rankA > rankB ? playerA.id : playerB.id,
      isDraw: false,
    };
  }

  if (playerA.card !== playerB.card) {
    return {
      winnerId: playerA.card > playerB.card ? playerA.id : playerB.id,
      isDraw: false,
    };
  }

  return { winnerId: null, isDraw: true };
}

export function getDiePenalty(hand: IPHand): number {
  return DIE_PENALTY[hand] ?? 0;
}
