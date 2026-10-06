import { ID_INITIAL_COIN_STOCK } from './types/invest-donate';
import type { IDCoinAllocation, IDCoinStock } from './types/invest-donate';

export const emptyAllocation = (): IDCoinAllocation => ({ coin50: 0, coin10: 0, coin1: 0 });
export const COIN_KEYS = ['coin50', 'coin10', 'coin1'] as const;

export function parseCoinAllocation(value: unknown): IDCoinAllocation | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  for (const key of COIN_KEYS) {
    if (
      typeof obj[key] !== 'number' ||
      !Number.isInteger(obj[key]) ||
      obj[key] < 0 ||
      obj[key] > ID_INITIAL_COIN_STOCK[key]
    )
      return null;
  }
  return { coin50: obj.coin50 as number, coin10: obj.coin10 as number, coin1: obj.coin1 as number };
}

export function allocationError(
  stock: IDCoinStock,
  invest: IDCoinAllocation,
  donate: IDCoinAllocation,
): string | null {
  if (!parseCoinAllocation(invest) || !parseCoinAllocation(donate))
    return '유효하지 않은 코인 개수입니다.';
  for (const key of COIN_KEYS) {
    if (invest[key] + donate[key] > stock[key]) {
      const label = key === 'coin50' ? 50 : key === 'coin10' ? 10 : 1;
      return `보유한 ${label}원짜리 코인이 부족합니다.`;
    }
  }
  return null;
}
