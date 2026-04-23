import { calcBNW2Stage } from './constants.js';

export { calcBNW2Stage as calcStage };
export { calcBNW2Color as calcColor } from './constants.js';

export function judgeRound(
  firstPoints: number,
  secondPoints: number,
): { winnerId: 'first' | 'second' | null } {
  if (firstPoints > secondPoints) return { winnerId: 'first' };
  if (secondPoints > firstPoints) return { winnerId: 'second' };
  return { winnerId: null };
}

export function autoSubmitPoints(remainingPoints: number): number {
  if (remainingPoints <= 0) return 0;
  return Math.max(1, Math.floor(remainingPoints * 0.1));
}
