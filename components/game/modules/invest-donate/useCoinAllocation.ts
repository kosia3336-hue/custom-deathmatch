'use client';

import { useState } from 'react';
import type { IDCoinAllocation, IDCoinStock } from '@/shared/types/invest-donate';
import { allocationError, emptyAllocation } from '@/shared/investDonateAllocation';

export function useCoinAllocation(stock: IDCoinStock) {
  const [invest, setInvest] = useState(emptyAllocation);
  const [donate, setDonate] = useState(emptyAllocation);
  const update = (pile: 'invest' | 'donate', key: keyof IDCoinAllocation, amount: number) => {
    const opposite = pile === 'invest' ? donate : invest;
    const setter = pile === 'invest' ? setInvest : setDonate;
    const max = Math.max(0, stock[key] - opposite[key]);
    setter((previous) => ({ ...previous, [key]: Math.max(0, Math.min(max, Math.trunc(amount))) }));
  };
  return { invest, donate, update, error: allocationError(stock, invest, donate) };
}
