'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useRankMatchStore } from '@/stores/rankMatch';
import { Icon } from '@/components/cdm/Icon';
import { RankQueueModal, formatQueueElapsed } from './RankQueueModal';

export function useQueueElapsed() {
  const queueStartedAt = useRankMatchStore((s) => s.queueStartedAt);
  const queuing = useRankMatchStore((s) => s.queuing);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!queuing || !queueStartedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Math.floor((Date.now() - queueStartedAt) / 1000));
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - queueStartedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [queuing, queueStartedAt]);

  return elapsed;
}

function handleCancelQueue() {
  getSocket().emit('rank:queue:leave');
  useRankMatchStore.getState().resetQueueUi();
}

// ─────────────────────────────────────────────
// 데스크탑 GNB / 방 헤더용 인라인 칩
// ─────────────────────────────────────────────
export function RankQueueDesktopChip() {
  const queuing = useRankMatchStore((s) => s.queuing);
  const elapsed = useQueueElapsed();

  if (!queuing) return null;

  return (
    <div className="flex items-center gap-2 rounded-cdm-md border border-cdm-highlight/40 bg-cdm-highlight/10 px-3 py-1">
      <span className="text-xs font-medium text-cdm-ink-fg">대기 중</span>
      <span className="text-xs tabular-nums font-semibold text-cdm-ink-fg">{formatQueueElapsed(elapsed)}</span>
      <button
        type="button"
        onClick={handleCancelQueue}
        className="p-0.5 text-xs text-cdm-fg-muted hover:text-cdm-accent"
        aria-label="랭크 큐 취소"
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 모바일 전용 플로팅 인디케이터
// SocketProvider에 마운트 → 모든 페이지에 표시
// ─────────────────────────────────────────────
export function RankQueueFloatingIndicator() {
  const pathname = usePathname();
  const queuing = useRankMatchStore((s) => s.queuing);
  const queueModalOpen = useRankMatchStore((s) => s.queueModalOpen);
  const setQueueModalOpen = useRankMatchStore((s) => s.setQueueModalOpen);
  const elapsed = useQueueElapsed();

  const [minimized, setMinimized] = useState(false);

  // 큐 진입 시 모바일에서만 모달 자동 오픈
  useEffect(() => {
    if (queuing) {
      setMinimized(false);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setQueueModalOpen(true);
      }
    }
  }, [queuing, setQueueModalOpen]);

  if (!queuing) return null;

  const handleCancel = () => {
    handleCancelQueue();
    setMinimized(false);
  };

  const handleMinimize = () => {
    setQueueModalOpen(false);
    setMinimized(true);
  };

  const handleIconTap = () => {
    setMinimized(false);
    setQueueModalOpen(true);
  };

  /*
    내려둔 대기 표시. 예전에는 글자도 아이콘도 없는 빈 동그라미라 무엇인지 알 수
    없었다. 번개 + 경과 시간을 싣고, 하단 탭 바 위에 띄운다.
    로비는 하단 행동 바의 '매칭 중' 버튼이 같은 일을 하므로 겹쳐 띄우지 않는다.
  */
  const showPill = minimized && pathname !== '/lobby';

  return (
    <>
      {showPill && (
        <button
          type="button"
          onClick={handleIconTap}
          className="fixed right-4 z-(--cdm-z-sticky) flex h-11 items-center gap-1.5 rounded-full border border-cdm-highlight/50 bg-cdm-ink/95 pr-3.5 pl-3 text-sm font-bold text-cdm-ink-fg shadow-lg backdrop-blur md:hidden"
          style={{ bottom: 'calc(var(--cdm-tabbar-h) + env(safe-area-inset-bottom) + 0.75rem)' }}
          aria-label={`랭크 매칭 대기 중 ${formatQueueElapsed(elapsed)} — 눌러서 열기`}
        >
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-cdm-highlight" />
          <Icon name="bolt" size="sm" className="text-cdm-highlight" />
          <span className="tabular-nums">{formatQueueElapsed(elapsed)}</span>
        </button>
      )}

      {/* 모달 — 래퍼 div 없이 직접 렌더링 (fixed inset-0이 뷰포트 기준으로 정확히 배치되도록) */}
      <RankQueueModal
        open={queueModalOpen}
        onClose={handleCancel}
        onMinimize={handleMinimize}
      />
    </>
  );
}
