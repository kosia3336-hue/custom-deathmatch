'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { ingestNoticePublishedMail } from '@/lib/mailbox/ingest';

interface NoticePublishedPayload {
  noticeId: string;
  title: string;
  category: string;
}

/**
 * notice:published → 우편함만. 토스트 없음.
 * app/layout.tsx 에서 전역 렌더링.
 */
export function NoticePublishedListener() {
  useEffect(() => {
    const socket = getSocket();

    const onNoticePublished = (payload: NoticePublishedPayload) => {
      ingestNoticePublishedMail(payload);
    };

    socket.on('notice:published', onNoticePublished);
    return () => {
      socket.off('notice:published', onNoticePublished);
    };
  }, []);

  return null;
}
