'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useEventRoomStore } from '@/stores/eventRoom';
import { useEventChipsStore } from '@/stores/eventChips';
import Button from '@/components/ui/Button';
import { isEventRoomOpen } from '@shared/event/kst';
import type {
  IPEStatePayload,
  IPEMetaPayload,
  IPEHandResultPayload,
  IPEKickedPayload,
  IPEPromotedPayload,
} from '@/shared/types';
import EventGameBoard from '@/components/event/EventGameBoard';
import EventClosedNotice from '@/components/event/EventClosedNotice';

/**
 * 인디언 홀덤 (이벤트) — 게임 모듈 컴포넌트.
 *
 * 기존 게임룸 인프라(/room/[id]/layout.tsx + GameShell)에서 렌더링된다.
 * - mount: event:join (멱등). EventLobbyControls 에서 미리 join 했어도 안전.
 * - unmount: 자동 leave 하지 않음. 사용자가 GameShell의 "나가기" 버튼으로 명시적으로 떠난다.
 */
export default function IndianPokerEventGame() {
  const router = useRouter();
  const setMeta = useEventRoomStore((s) => s.setMeta);
  const setState = useEventRoomStore((s) => s.setState);
  const state = useEventRoomStore((s) => s.state);
  const setChipBalance = useEventChipsStore((s) => s.setBalance);

  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    const sock = getSocket();

    const onState = (payload: IPEStatePayload) => {
      setState(payload);
      if (typeof payload.myChipBalance === 'number') {
        setChipBalance(payload.myChipBalance);
      }
    };
    const onMeta = (m: IPEMetaPayload) => setMeta(m);
    const onHandResult = (p: IPEHandResultPayload) => {
      const { winnerIds, kind } = p.result;
      if (kind === 'showdown' && winnerIds.length === 0) {
        toast('무승부 — 팟이 다음 핸드로 이월됩니다.');
      }
    };
    const onKicked = (p: IPEKickedPayload) => {
      toast.error(p.message);
      router.push('/lobby');
    };
    const onPromoted = (p: IPEPromotedPayload) => {
      toast.success(p.message);
    };

    sock.on('event:state', onState);
    sock.on('event:meta:changed', onMeta);
    sock.on('event:hand:result', onHandResult);
    sock.on('event:kicked', onKicked);
    sock.on('event:promoted', onPromoted);

    sock.emit('event:join', (res) => {
      setBootstrapping(false);
      if (!res.success) {
        setBootstrapError(res.error ?? '입장에 실패했습니다.');
      }
    });

    return () => {
      sock.off('event:state', onState);
      sock.off('event:meta:changed', onMeta);
      sock.off('event:hand:result', onHandResult);
      sock.off('event:kicked', onKicked);
      sock.off('event:promoted', onPromoted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrapping) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-cdm-fg-muted">입장 중...</div>
      </div>
    );
  }
  if (bootstrapError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-cdm-fg">{bootstrapError}</p>
        <Button onClick={() => router.push('/lobby')}>로비로 돌아가기</Button>
      </div>
    );
  }
  if (!state) return null;
  if (state.gameData.phase === 'closed' || !isEventRoomOpen()) {
    return <EventClosedNotice />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-3 lg:p-4">
      <EventGameBoard state={state} />
    </div>
  );
}
