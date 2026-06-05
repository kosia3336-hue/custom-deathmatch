'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import type { TitleColor } from '@/lib/supabase/database.types';
import { gachaTitleGrantedSuppress } from '@/lib/gacha/suppress-title-granted';

interface TitleGrantedPayload {
  titleId: string;
  name: string;
  color: string;
  description: string | null;
  effect?: string | null;
}

/**
 * 칭호 획득 모달.
 * 소켓 'title:granted' 이벤트 수신 시 큐에 쌓아 순차 표시.
 * app/layout.tsx 에서 전역 렌더링.
 */
export default function TitleGrantedModal() {
  const [queue, setQueue] = useState<TitleGrantedPayload[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const socket = getSocket();

    const onTitleGranted = (payload: TitleGrantedPayload) => {
      if (gachaTitleGrantedSuppress.active) return;
      setQueue((prev) => [...prev, payload]);
    };

    socket.on('title:granted', onTitleGranted);
    return () => {
      socket.off('title:granted', onTitleGranted);
    };
  }, []);

  function dismiss() {
    setQueue((prev) => prev.slice(1));
  }

  if (!current) return null;

  return (
    <Modal
      open
      onClose={dismiss}
      closeOnBackdrop={false}
      closeOnEscape={false}
      mobileBottomSheet={false}
      size="sm"
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-cdm-primary">
          칭호 획득!
        </p>
        <TitleBadge
          name={current.name}
          color={current.color as TitleColor}
          effect={current.effect as 'legend' | 'xuanwu' | null}
          size="lg"
        />
        {current.description && (
          <p className="text-sm text-cdm-fg-muted">{current.description}</p>
        )}
        <Button onClick={dismiss} className="mt-2 w-full">
          확인
        </Button>
      </div>
    </Modal>
  );
}
