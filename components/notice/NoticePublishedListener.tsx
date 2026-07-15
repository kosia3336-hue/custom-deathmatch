'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

interface NoticePublishedPayload {
  noticeId: string;
  title: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반',
  maintenance: '점검',
  update: '업데이트',
  event: '이벤트',
  urgent: '긴급',
};

/**
 * 소켓 'notice:published' 이벤트 수신 → Sonner 토스트 표시.
 * app/layout.tsx 에서 전역 렌더링.
 */
export function NoticePublishedListener() {
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();

    const onNoticePublished = (payload: NoticePublishedPayload) => {
      const categoryLabel = CATEGORY_LABELS[payload.category] ?? payload.category;
      toast(`새 공지 [${categoryLabel}]`, {
        description: payload.title,
        duration: 6000,
        action: {
          label: '공지 보기',
          onClick: () => router.push(`/notice/${payload.noticeId}`),
        },
      });
    };

    socket.on('notice:published', onNoticePublished);
    return () => {
      socket.off('notice:published', onNoticePublished);
    };
  }, [router]);

  return null;
}
