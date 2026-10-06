import { BRPS_RESULTS } from './types/betting-rps';
import type { BRPSResult } from './types/betting-rps';

export function isBettingRpsResult(value: unknown): value is BRPSResult {
  return BRPS_RESULTS.includes(value as BRPSResult);
}
export function bettingRpsChipBounds(owned: number) {
  return { min: owned > 0 ? 1 : 0, max: Math.max(0, owned) };
}
export function validBettingRpsBet(owned: number, prediction: unknown, chips: unknown): boolean {
  const { min, max } = bettingRpsChipBounds(owned);
  return (
    isBettingRpsResult(prediction) &&
    typeof chips === 'number' &&
    Number.isInteger(chips) &&
    chips >= min &&
    chips <= max
  );
}
