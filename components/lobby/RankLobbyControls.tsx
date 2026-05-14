'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import Button from '@/components/ui/Button';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '@shared/rank/kst';

export default function RankLobbyControls() {
  const { member } = useCurrentMember();
  const [, setClock] = useState(0);
  const queuing = useRankMatchStore((s) => s.queuing);
  const setQueuing = useRankMatchStore((s) => s.setQueuing);
  const matched = useRankMatchStore((s) => s.matched);

  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // 매칭 성사되면 버튼 상태가 queuing→false로 자연히 전환됨 (resetQueueUi는 VS 오버레이가 처리)
  useEffect(() => {
    if (matched) {
      // matched 수신 시 queuing도 false가 되므로 별도 처리 불필요
    }
  }, [matched]);

  const hoursOpen = isRankQueueOpen();
  const canJoin = isRankQueueAcceptingNewJoins();

  const handleRankClick = () => {
    if (queuing) return; // 이미 대기 중
    if (!member) {
      toast.error('랭크 게임은 로그인 후 이용할 수 있습니다.');
      return;
    }
    if (!hoursOpen) {
      toast.error('랭크 운영 시간이 아닙니다. (평일 21:00~익일 01:00 KST / 주말 24시간)');
      return;
    }
    if (!canJoin) {
      toast.error('운영 종료 1분 전입니다. 새 랭크 매칭을 시작할 수 없습니다.');
      return;
    }
    setQueuing(true);
    getSocket().emit('rank:queue:join', (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        toast.error(res.error ?? '랭크 큐 참여에 실패했습니다.');
        useRankMatchStore.getState().setQueuing(false);
      } else {
        toast.success('랭크 매칭을 시작합니다.');
      }
    });
  };

  const rankTitle = queuing
    ? '랭크 큐 대기 중'
    : hoursOpen
      ? canJoin
        ? '랭크 매칭 시작'
        : '운영 종료 1분 전 — 새 매칭 불가'
      : '평일 21:00~01:00 KST / 주말 24시간';

  return (
    <div className="flex flex-col items-stretch gap-0.5">
      <Button
        type="button"
        variant="secondary"
        title={rankTitle}
        disabled={queuing}
        className={
          queuing
            ? 'cursor-not-allowed opacity-50'
            : 'border-cdm-highlight/40 bg-cdm-highlight/10 text-cdm-fg hover:bg-cdm-highlight/20'
        }
        onClick={handleRankClick}
      >
        {queuing ? (
          <>
            <span className="hidden sm:inline">🏆 대기 중...</span>
            <span className="sm:hidden">🏆 대기 중</span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline">🏆 랭크 게임</span>
            <span className="sm:hidden">🏆 랭크</span>
          </>
        )}
      </Button>
    </div>
  );
}
