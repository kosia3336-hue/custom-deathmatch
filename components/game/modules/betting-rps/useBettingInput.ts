'use client';
import { useState } from 'react';
import type { BRPSResult } from '@/shared/types/betting-rps';
import { bettingRpsChipBounds, validBettingRpsBet } from '@/shared/bettingRpsSubmission';
export function useBettingInput(owned: number) {
  const bounds = bettingRpsChipBounds(owned);
  const [prediction, setPrediction] = useState<BRPSResult | null>(null);
  const [amount, setAmount] = useState(bounds.min);
  const chips = Math.max(bounds.min, Math.min(bounds.max, amount));
  return {
    prediction,
    setPrediction,
    chips,
    bounds,
    changeChips: (delta: number) =>
      setAmount(Math.max(bounds.min, Math.min(bounds.max, chips + delta))),
    canSubmit: validBettingRpsBet(owned, prediction, chips),
  };
}
