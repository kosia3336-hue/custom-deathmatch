'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/cdm/Icon';
import { resultSharePayload, type ResultShareSummary } from '@/lib/resultShare';
import { shareOrCopy } from '@/lib/share';

/** 전적 요약을 공유 시트로 보낸다. 게임명·승패·시간·턴만 담고 닉네임·패·로그는 넣지 않는다. */
export default function ResultShareButton({ summary }: { summary: ResultShareSummary }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    let payload;
    try {
      payload = resultSharePayload(
        summary,
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
      );
    } catch {
      toast.error('공유 주소 설정이 올바르지 않습니다.');
      return;
    }
    setBusy(true);
    const outcome = await shareOrCopy(payload);
    setBusy(false);
    if (outcome === 'copied') toast.success('결과 요약과 링크를 복사했습니다.');
    else if (outcome === 'failed') toast.error('공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  };
  return (
    <button
      type="button"
      aria-label="전적 공유"
      title="공유하기"
      disabled={busy}
      onClick={share}
      className="inline-flex h-8 w-8 items-center justify-center rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted transition-colors hover:border-cdm-border-strong hover:text-cdm-fg disabled:opacity-50"
    >
      <Icon name="share" size="sm" />
    </button>
  );
}
