'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { ingestTitleGrantedMail } from '@/lib/mailbox/ingest';

interface TitleGrantedPayload {
  titleId: string;
  name: string;
  color: string;
  description: string | null;
  effect?: string | null;
}

/**
 * title:granted → 우편함만. 획득 모달 없음.
 * app/layout.tsx 에서 전역 렌더링.
 */
export default function TitleGrantedModal() {
  useEffect(() => {
    const socket = getSocket();

    const onTitleGranted = (payload: TitleGrantedPayload) => {
      ingestTitleGrantedMail({
        titleId: payload.titleId,
        name: payload.name,
        color: payload.color,
        description: payload.description,
        effect: payload.effect,
      });
    };

    socket.on('title:granted', onTitleGranted);
    return () => {
      socket.off('title:granted', onTitleGranted);
    };
  }, []);

  return null;
}
