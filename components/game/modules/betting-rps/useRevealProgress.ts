'use client';

import { serverNow } from '@/lib/serverClock';
import { useEffect, useState } from 'react';
import { BRPS_REVEAL_DELAY_MS } from '@/shared/types/betting-rps';

const STEPS = [350, 1150, 2000];

/** Server deadline also determines the reveal stage after reconnecting. */
export function useRevealProgress(deadline?: number, finished = false) {
  const [fallbackStart] = useState(serverNow);
  const [now, setNow] = useState(fallbackStart);
  const start = deadline === undefined ? fallbackStart : deadline - BRPS_REVEAL_DELAY_MS;
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 50);
    return () => clearInterval(timer);
  }, []);
  return finished ? STEPS.length : STEPS.filter((delay) => now - start >= delay).length;
}
