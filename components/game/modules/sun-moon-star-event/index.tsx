'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { sfxSmsTimeout } from '@/lib/smsEventSfx';
import { useSmsEventRoomStore } from '@/stores/smsEventRoom';
import Button from '@/components/ui/Button';
import { isEventRoomOpen } from '@shared/event/kst';
import type {
  SmsKickedPayload,
  SmsMetaPayload,
  SmsPromotedPayload,
  SmsRoundResultPayload,
  SmsStatePayload,
} from '@/shared/types/sun-moon-star-event';
import EventClosedNotice from '@/components/event/EventClosedNotice';
import SmsGameBoard from '@/components/event/SmsGameBoard';

/**
 * 해달별 (이벤트) — 게임 모듈 컴포넌트.
 *
 * 기존 게임룸 인프라(/room/[id]/layout.tsx + GameShell)에서 렌더링된다.
 * - mount: smsEvent:join (멱등). EventLobbyControls 에서 미리 join 했어도 안전.
 * - unmount: 자동 leave 하지 않음. 사용자가 GameShell의 "나가기" 버튼으로 명시적으로 떠난다.
 */
export default function SunMoonStarEventGame() {
  const router = useRouter();
  const setMeta = useSmsEventRoomStore((s) => s.setMeta);
  const setState = useSmsEventRoomStore((s) => s.setState);
  const state = useSmsEventRoomStore((s) => s.state);
  const [roundOverlay, setRoundOverlay] = useState<SmsRoundResultPayload | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    const sock = getSocket();

    const onState = (payload: SmsStatePayload) => {
      setState(payload);
      setBootstrapping(false);
    };
    const onMeta = (m: SmsMetaPayload) => setMeta(m);
    const onPromoted = (p: SmsPromotedPayload) => toast.success(p.message);
    const onKicked = (p: SmsKickedPayload) => {
      sfxSmsTimeout();
      toast.error(p.message, { duration: 5000 });
    };
    const onRoundResult = (p: { result: SmsRoundResultPayload }) => {
      setRoundOverlay(p.result);
      setTimeout(() => setRoundOverlay(null), 2800);
    };

    sock.on('smsEvent:state', onState);
    sock.on('smsEvent:meta:changed', onMeta);
    sock.on('smsEvent:promoted', onPromoted);
    sock.on('smsEvent:kicked', onKicked);
    sock.on('smsEvent:round:result', onRoundResult);

    sock.emit('smsEvent:join', (res) => {
      setBootstrapping(false);
      if (!res.success) {
        setBootstrapError(res.error ?? '입장 실패');
      }
    });

    return () => {
      sock.off('smsEvent:state', onState);
      sock.off('smsEvent:meta:changed', onMeta);
      sock.off('smsEvent:promoted', onPromoted);
      sock.off('smsEvent:kicked', onKicked);
      sock.off('smsEvent:round:result', onRoundResult);
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
      <SmsGameBoard
        state={state}
        roundOverlay={roundOverlay}
        mySeatIdx={state.mySeatIdx}
      />
    </div>
  );
}
