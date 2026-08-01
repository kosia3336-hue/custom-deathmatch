'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';

/** 관리자 — 쿠폰함 열기/닫기 토글 */
export default function EventCouponBoxToggle({ isOpen }: { isOpen: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !isOpen;
    if (!next && !window.confirm('쿠폰함을 닫을까요? 쿠폰 지급·투입이 중단됩니다.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/event-coupons/box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? '변경 실패');
        return;
      }
      toast.success(next ? '쿠폰함을 열었습니다.' : '쿠폰함을 닫았습니다. 수동 추첨을 진행하세요.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={isOpen ? 'danger' : 'primary'} size="sm" onClick={toggle} disabled={busy}>
      {busy ? '처리 중…' : isOpen ? '쿠폰함 닫기 (이벤트 종료)' : '쿠폰함 열기'}
    </Button>
  );
}
