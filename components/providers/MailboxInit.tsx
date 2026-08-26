'use client';

import { useEffect } from 'react';
import { useMailboxStore } from '@/stores/mailbox';

/** 로그인 시 우편함 DB를 불러 뱃지·탭이 같은 값을 보게 한다. */
export default function MailboxInit({
  memberId,
  ready,
}: {
  memberId: string | null;
  ready: boolean;
}) {
  const reset = useMailboxStore((s) => s.reset);
  const refresh = useMailboxStore((s) => s.refresh);

  useEffect(() => {
    if (!ready) return;
    if (!memberId) {
      reset();
      return;
    }
    void refresh();
  }, [ready, memberId, reset, refresh]);

  return null;
}
