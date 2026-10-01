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
/*
  로비 주소. 예전에는 '/' 가 로비였는데 소개 페이지와 갈라지면서 '/lobby' 로
  옮겨졌다(4ac8621). 그때 이 검사만 '/' 로 남아, 결과 화면의 «다시 큐» 가
  깃발만 세워 두고 로비에 도착해도 아무 일도 일어나지 않았다 — 사용자는 큐에
  안 들어간 채 «랭크 게임» 을 손으로 다시 눌러야 했다.

  '/' 도 같이 받는다. 로그인한 사람은 미들웨어가 '/lobby' 로 보내지만, 그 사이
  한 프레임이라도 '/' 에서 이 컴포넌트가 도는 경로를 막아 둘 이유가 없다.
*/
const LOBBY_PATHS = ['/lobby', '/'];

export function RankAutoRejoinListener() {
  const pathname = usePathname();
  const { member } = useCurrentMember();
  const consumedRef = useRef(false);
  const onLobby = LOBBY_PATHS.includes(pathname);

  useEffect(() => {
    if (!onLobby) {
      consumedRef.current = false;
    }
  }, [onLobby]);

  useEffect(() => {
    if (!onLobby) return;
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
  }, [onLobby, member]);

  return null;
}
