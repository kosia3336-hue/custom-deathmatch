'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '@shared/rank/kst';

export const RANK_REJOIN_STORAGE_KEY = 'rank_rejoin_pending';

const STORAGE_KEY = RANK_REJOIN_STORAGE_KEY;

/** 결과 화면 «다시 큐» 후 로비에서 자동 큐 참여 */
export function RankAutoRejoinListener() {
  const pathname = usePathname();
  const { member } = useCurrentMember();
  const consumedRef = useRef(false);

  useEffect(() => {
    if (pathname !== '/') {
      consumedRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;
    if (consumedRef.current) return;

    let pending = false;
    try {
      pending = sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return;
    }
    if (!pending) return;
    if (!member) return;

    consumedRef.current = true;

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (!isRankQueueOpen()) {
      consumedRef.current = false;
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      toast.error('랭크 운영 시간이 아닙니다. (평일 21:00~익일 01:00 KST / 주말 24시간)');
      return;
    }

    if (!isRankQueueAcceptingNewJoins()) {
      consumedRef.current = false;
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      toast.error('운영 종료 1분 전입니다. 새 랭크 매칭을 시작할 수 없습니다.');
      return;
    }

    useRankMatchStore.getState().setQueuing(true);
    // 모달은 RankQueueFloatingIndicator의 useEffect에서 모바일 여부 확인 후 자동 오픈
    getSocket().emit('rank:queue:join', (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        toast.error(res.error ?? '랭크 큐 참여에 실패했습니다.');
        useRankMatchStore.getState().resetQueueUi();
        consumedRef.current = false;
      } else {
        toast.success('랭크 매칭을 시작합니다.');
      }
    });
  }, [pathname, member]);

  return null;
}
