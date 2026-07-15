'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useRankMatchStore } from '@/stores/rankMatch';
import { RankQueueModal } from './RankQueueModal';

function fmtElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useQueueElapsed() {
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
      <span className="text-xs tabular-nums font-semibold text-cdm-ink-fg">{fmtElapsed(elapsed)}</span>
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
  const queuing = useRankMatchStore((s) => s.queuing);
  const queueModalOpen = useRankMatchStore((s) => s.queueModalOpen);
  const setQueueModalOpen = useRankMatchStore((s) => s.setQueueModalOpen);

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

  return (
    <>
      {/* 최소화 아이콘 — 모바일만 (md 이상 hidden) */}
      {minimized && (
        <button
          type="button"
          onClick={handleIconTap}
          className="fixed bottom-6 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border-2 border-cdm-highlight/60 bg-cdm-highlight/20 text-xl shadow-lg backdrop-blur md:hidden"
          aria-label="랭크 큐 대기 중 — 탭하여 열기"
        />
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
