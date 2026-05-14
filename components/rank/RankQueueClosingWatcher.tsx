'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { isRankQueueLastMinuteKst, isRankQueueOpen } from '@shared/rank/kst';

/** KST 00:59 — 운영 종료 1분 전 1회 토스트 (로비에서만) */
export function RankQueueClosingWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const tick = () => {
      if (pathname !== '/') return;
      if (!isRankQueueOpen()) return;
      if (!isRankQueueLastMinuteKst()) return;

      const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const storageKey = `rank_queue_close_warn_${dayKey}`;
      try {
        if (sessionStorage.getItem(storageKey)) return;
        sessionStorage.setItem(storageKey, '1');
      } catch {
        return;
      }

      toast.message('랭크게임이 1분 후 종료됩니다. (평일 01:00 KST)');
    };

    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [pathname]);

  return null;
}
