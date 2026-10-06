'use client';

import { serverNow } from '@/lib/serverClock';
import { useEffect, useState } from 'react';
import { ID_REVEAL_DELAY_MS } from '@/shared/types/invest-donate';

const STEPS = [350, 850, 1450, 2100];

/** Server deadline also determines the reveal stage after reconnecting. */
export function useRevealProgress(deadline?: number, finished = false) {
  const [fallbackStart] = useState(serverNow);
  const [now, setNow] = useState(fallbackStart);
  const start = deadline === undefined ? fallbackStart : deadline - ID_REVEAL_DELAY_MS;
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 50);
    return () => clearInterval(timer);
  }, []);
  return finished ? STEPS.length : STEPS.filter((delay) => now - start >= delay).length;
}
