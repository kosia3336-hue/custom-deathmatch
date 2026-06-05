'use client';

import { useEffect, useState } from 'react';
import type { SmsGameData } from '@/shared/types/sun-moon-star-event';

function secondsUntil(deadlineMs: number, now: number): number {
  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}

/** waiting 카운트다운·pick 타이머 멘트 */
export function useSmsPhaseMessage(gd: SmsGameData): string | null {
  const [now, setNow] = useState(() => Date.now());

  const needsTick =
    (gd.phase === 'waiting' && gd.nextRoundStartsAt != null) ||
    ((gd.phase === 'pickFirst' || gd.phase === 'pickSecond') && gd.pickDeadlineAt != null);

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [needsTick, gd.nextRoundStartsAt, gd.pickDeadlineAt, gd.phase]);

  if (gd.phase === 'waiting') {
    if (gd.nextRoundStartsAt != null) {
      const sec = secondsUntil(gd.nextRoundStartsAt, now);
      return sec > 0 ? `${sec}초 후 시작됩니다` : '곧 시작됩니다';
    }
    return gd.message;
  }

  if ((gd.phase === 'pickFirst' || gd.phase === 'pickSecond') && gd.pickDeadlineAt != null) {
    const sec = secondsUntil(gd.pickDeadlineAt, now);
    const base = gd.message ?? '';
    return sec > 0 ? `${base} (${sec}초)` : base;
  }

  return gd.message;
}
