'use client';

import { useEffect } from 'react';
import type { GuildV4UnseenPayout } from '@/lib/guild-v4/types';
import { useMailboxStore } from '@/stores/mailbox';

async function ackPayout(p: GuildV4UnseenPayout): Promise<void> {
  await fetch('/api/guild2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ack_rank_payout',
      periodKind: p.kind,
      periodKey: p.periodKey,
    }),
  });
}

/**
 * 안 본 주간·월간 정산을 우편함에 넣고 확인 처리한다. 전용 모달 없음.
 */
export function GuildRankPayoutModal() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/guild2/payouts');
        if (!res.ok) return;
        const json = (await res.json()) as { payouts?: GuildV4UnseenPayout[] };
        const payouts = json.payouts ?? [];
        if (cancelled || payouts.length === 0) return;

        // 먼저 우편을 넣는다. ack를 먼저 하면 첫 INSERT가 읽음이 된다.
        await useMailboxStore.getState().refresh();
        if (cancelled) return;
        for (const p of payouts) {
          try {
            await ackPayout(p);
          } catch {
            /* ack 실패해도 우편은 남긴다 */
          }
          if (cancelled) return;
        }
      } catch {
        /* 접속 안내는 실패해도 화면을 막지 않는다 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
