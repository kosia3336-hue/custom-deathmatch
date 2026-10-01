'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/cdm/Icon';
import { resultSharePayload, type ResultShareSummary } from '@/lib/resultShare';
import { renderResultCardFile } from '@/lib/resultCardImage';
import { shareImageOrText } from '@/lib/share';

interface Prepared {
  key: string;
  summary: ResultShareSummary;
  file: Promise<File | null>;
}

/**
 * 전적 결과 카드 이미지를 공유 시트로 보낸다(링크 없음). 게임명·승패·나 vs 상대·일시·시간·턴.
 * 회원 ID·패·로그는 넣지 않는다. 일시가 없으면(방금 끝난 판) 카드를 만든 시각을 쓴다.
 *
 * 공유 시트는 클릭 직후에만 열리므로 이미지를 미리 만들어 둔다 — `eager` 면 화면에 뜰 때,
 * 아니면(로그 목록처럼 버튼이 많을 때) 손가락·마우스를 올리거나 포커스할 때.
 */
export default function ResultShareButton({
  summary,
  eager = false,
}: {
  summary: ResultShareSummary;
  eager?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const prepared = useRef<Prepared | null>(null);

  const prepare = useCallback((): Prepared => {
    const key = JSON.stringify(summary);
    if (prepared.current?.key !== key) {
      const fixed = { ...summary, playedAt: summary.playedAt ?? Date.now() };
      prepared.current = { key, summary: fixed, file: renderResultCardFile(fixed).catch(() => null) };
    }
    return prepared.current;
  }, [summary]);

  useEffect(() => {
    if (eager) prepare();
  }, [eager, prepare]);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    const { summary: fixed, file } = prepare();
    const outcome = await shareImageOrText(await file, resultSharePayload(fixed));
    setBusy(false);
    if (outcome === 'copied-image') toast.success('결과 카드 이미지를 복사했습니다. 붙여넣기로 보낼 수 있습니다.');
    else if (outcome === 'copied') toast.success('결과 요약을 복사했습니다.');
    else if (outcome === 'failed') toast.error('공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  };

  return (
    <button
      type="button"
      aria-label="전적 공유"
      title="공유하기"
      disabled={busy}
      onPointerEnter={() => prepare()}
      onPointerDown={() => prepare()}
      onFocus={() => prepare()}
      onClick={share}
      className="inline-flex h-8 w-8 items-center justify-center rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted transition-colors hover:border-cdm-border-strong hover:text-cdm-fg disabled:opacity-50"
    >
      <Icon name="share" size="sm" />
    </button>
  );
}
