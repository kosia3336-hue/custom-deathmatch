'use client';

import { useEffect, useRef } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';

/**
 * 로그인 사용자가 공지 상세를 열면 조회 기록 + 유레카 히든 판정 트리거.
 */
export function NoticeReadTracker({
  noticeId,
  enabled,
}: {
  noticeId: string;
  enabled: boolean;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (!enabled || fired.current) return;
    fired.current = true;

    void (async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'record_notice_read', { p_notice_id: noticeId });
        // GNB 미읽음 카운트 갱신 트리거
        window.dispatchEvent(new Event('notice:read'));
      } catch {
        // 로그인 세션 없음 등 — 무시
      }
      try {
        await fetch('/api/hidden-titles/eureka', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noticeId }),
        });
      } catch {
        // 소켓 서버 다운 등 — 무시
      }
    })();
  }, [noticeId, enabled]);

  return null;
}
