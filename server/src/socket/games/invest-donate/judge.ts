import type { IDCoinAllocation, IDCoinStock, IDBadge } from '@shared/types/invest-donate.js';
import { coinValue, stockTotal } from '@shared/types/invest-donate.js';

export { coinValue, stockTotal };

export function coinAdd(a: IDCoinAllocation, b: IDCoinAllocation): IDCoinAllocation {
  return { coin50: a.coin50 + b.coin50, coin10: a.coin10 + b.coin10, coin1: a.coin1 + b.coin1 };
}

export function coinSubtract(stock: IDCoinStock, used: IDCoinAllocation): IDCoinStock {
  return { coin50: stock.coin50 - used.coin50, coin10: stock.coin10 - used.coin10, coin1: stock.coin1 - used.coin1 };
}

export interface InvestResult {
  badge: Record<string, 'majorShareholder' | null>;
  scoreChanges: Record<string, number>;
  isTied: boolean;
}

export function judgeInvest(
  aId: string, aInvest: IDCoinAllocation,
  bId: string, bInvest: IDCoinAllocation,
): InvestResult {
  const aVal = coinValue(aInvest);
  const bVal = coinValue(bInvest);

  if (aVal > bVal) {
    return {
      badge: { [aId]: 'majorShareholder', [bId]: null },
      scoreChanges: { [aId]: 1, [bId]: 0 },
      isTied: false,
    };
  }
  if (bVal > aVal) {
    return {
      badge: { [aId]: null, [bId]: 'majorShareholder' },
      scoreChanges: { [aId]: 0, [bId]: 1 },
      isTied: false,
    };
  }
  return {
    badge: { [aId]: null, [bId]: null },
    scoreChanges: { [aId]: 0, [bId]: 0 },
    isTied: true,
  };
}

export interface DonateResult {
  badge: Record<string, 'miser' | null>;
  scoreChanges: Record<string, number>;
  isTied: boolean;
}

export function judgeDonate(
  aId: string, aDonate: IDCoinAllocation,
  bId: string, bDonate: IDCoinAllocation,
): DonateResult {
  const aVal = coinValue(aDonate);
  const bVal = coinValue(bDonate);

  if (aVal < bVal) {
    return {
      badge: { [aId]: 'miser', [bId]: null },
      scoreChanges: { [aId]: -1, [bId]: 0 },
      isTied: false,
    };
  }
  if (bVal < aVal) {
    return {
      badge: { [aId]: null, [bId]: 'miser' },
      scoreChanges: { [aId]: 0, [bId]: -1 },
      isTied: false,
    };
  }
  return {
    badge: { [aId]: 'miser', [bId]: 'miser' },
    scoreChanges: { [aId]: -1, [bId]: -1 },
    isTied: true,
  };
}
