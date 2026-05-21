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
import EventGameBoard from './EventGameBoard';
import EventSpectatorPanel from './EventSpectatorPanel';
import EventClosedNotice from './EventClosedNotice';

/**
 * 인디언홀덤 (이벤트) 룸 메인 컨테이너.
 * - mount: event:join 호출 (서버가 좌석/관전/대기열 자동 배정)
 * - unmount: event:leave 호출
 * - event:state / event:meta:changed / event:hand:result / event:kicked / event:promoted 구독
 */
export function EventRoomClient() {
  const router = useRouter();
  const setMeta = useEventRoomStore((s) => s.setMeta);
  const setState = useEventRoomStore((s) => s.setState);
  const clearState = useEventRoomStore((s) => s.clearState);
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
      // 본인 결과만 토스트 (chip:changed 가 따로 발행됨, 여기선 무승부/승리 알림만)
      const { winnerIds, kind } = p.result;
      if (kind === 'showdown') {
        if (winnerIds.length === 0) {
          toast('무승부 — 팟이 다음 핸드로 이월됩니다.');
        }
      }
    };
    const onKicked = (p: IPEKickedPayload) => {
      toast.error(p.message);
      router.push('/');
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
      sock.emit('event:leave');
      clearState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrapping) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-cdm-fg-muted">입장 중...</div>
      </div>
    );
  }
  if (bootstrapError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-cdm-fg">{bootstrapError}</p>
        <Button onClick={() => router.push('/')}>로비로 돌아가기</Button>
      </div>
    );
  }
  if (!state) {
    return null;
  }
  if (state.gameData.phase === 'closed' || !isEventRoomOpen()) {
    return <EventClosedNotice />;
  }

  return (
    <div className="flex flex-col gap-4">
      <EventGameBoard state={state} />
      {state.role !== 'player' && (
        <EventSpectatorPanel state={state} />
      )}
    </div>
  );
}
