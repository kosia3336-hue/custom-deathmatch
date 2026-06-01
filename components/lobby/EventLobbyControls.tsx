'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useRankMatchStore } from '@/stores/rankMatch';
import { isEventRoomOpen } from '@shared/event/kst';

export default function EventLobbyControls() {
  const router = useRouter();
  const { member } = useCurrentMember();
  const queuing = useRankMatchStore((s) => s.queuing);
  const [joining, setJoining] = useState(false);

  const open = isEventRoomOpen();

  const handleClick = () => {
    // ── 이벤트 기간 종료 — 준비중 처리 ──
    toast.info('현재 진행중인 이벤트가 없습니다.');
    return;

    /* 이벤트 재개 시 아래 주석 해제
    if (!member) {
      toast.error('이벤트 게임은 로그인 후 이용할 수 있습니다.');
      return;
    }
    if (!open) {
      toast.error('이벤트 게임 운영 시간이 아닙니다. (평일 01:00~21:00 / 주말 24시간)');
      return;
    }
    if (queuing) {
      toast.error('랭크 큐 대기 중에는 입장할 수 없습니다.');
      return;
    }
    setJoining(true);
    getSocket().emit('event:join', (res) => {
      setJoining(false);
      if (!res.success) {
        toast.error(res.error ?? '이벤트 입장에 실패했습니다.');
        return;
      }
      router.push('/room/evt-indpkr/play');
    });
    */
  };

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={joining}
      className="border-cdm-primary/40 bg-cdm-primary/10 text-cdm-fg hover:bg-cdm-primary/20"
      onClick={handleClick}
    >
      <span className="hidden sm:inline">🎴 이벤트 게임</span>
      <span className="sm:hidden">🎴 이벤트</span>
    </Button>
  );
}
