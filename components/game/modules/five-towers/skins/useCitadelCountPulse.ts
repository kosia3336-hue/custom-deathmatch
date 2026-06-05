'use client';

import { useEffect, useRef, useState } from 'react';

export type CitadelCountPulse = {
  level: number;
  dir: 'up' | 'down';
} | null;

/** 추론 카운트 변경 시 해당 층에 짧은 연출 트리거 */
export function useCitadelCountPulse(userCount: number): CitadelCountPulse {
  const prevRef = useRef(userCount);
  const [pulse, setPulse] = useState<CitadelCountPulse>(null);

  useEffect(() => {
    if (prevRef.current === userCount) return;
    const prev = prevRef.current;
    const dir = userCount > prev ? 'up' : 'down';
    const level = dir === 'up' ? userCount : prev;
    prevRef.current = userCount;
    if (level < 1) return;
    setPulse({ level, dir });
    const t = window.setTimeout(() => setPulse(null), 420);
    return () => window.clearTimeout(t);
  }, [userCount]);

  return pulse;
}
