'use client';

import type { SmsStatePayload } from '@/shared/types/sun-moon-star-event';

interface Props {
  state: SmsStatePayload;
}

/** 해달별 이벤트 — 관전·대기열 안내 (퇴장은 GameShell 헤더만 사용) */
export default function SmsEventSpectatorPanel({ state }: Props) {
  return (
    <div className="rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3 sm:p-4">
      <div className="flex flex-col gap-1 text-sm">
        {state.role === 'queued' ? (
          <>
            <div className="font-bold text-cdm-fg">
              대기열 {state.myQueuePosition ?? '-'}번
            </div>
            <div className="text-xs text-cdm-fg-muted">
              자리가 나면 자동으로 입장합니다. (총 대기 {state.queueLength}명)
            </div>
          </>
        ) : (
          <>
            <div className="font-bold text-cdm-fg">관전 중</div>
            <div className="text-xs text-cdm-fg-muted">
              다음 판 시작 시 빈 자리가 있으면 자동으로 입장합니다.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
