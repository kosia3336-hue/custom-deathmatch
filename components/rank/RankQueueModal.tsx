'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useRankMatchStore } from '@/stores/rankMatch';
import { Button } from '@/components/cdm/Button';
import Modal from '@/components/ui/Modal';
import { useNicknameStore } from '@/stores/nickname';
import { RankBadge } from '@/components/cdm/RankBadge';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import type { RankTier } from '@/shared/types/rank';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 제공되면 backdrop 클릭 및 [−] 버튼이 취소 대신 최소화를 수행 */
  onMinimize?: () => void;
}

function fmtElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 큐 대기 모달 — 모바일 아이콘 탭 또는 자동 재큐 시 표시 */
export function RankQueueModal({ open, onClose, onMinimize }: Props) {
  const queuing = useRankMatchStore((s) => s.queuing);
  const queueStartedAt = useRankMatchStore((s) => s.queueStartedAt);
  const setServerWaitSeconds = useRankMatchStore((s) => s.setServerWaitSeconds);
  const resetQueueUi = useRankMatchStore((s) => s.resetQueueUi);
  const nickname = useNicknameStore((s) => s.nickname);
  const { member } = useCurrentMember();

  const [elapsedSec, setElapsedSec] = useState(() =>
    queueStartedAt ? Math.floor((Date.now() - queueStartedAt) / 1000) : 0,
  );

  useEffect(() => {
    if (!queuing || !queueStartedAt) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(Math.floor((Date.now() - queueStartedAt) / 1000));
    const id = setInterval(
      () => setElapsedSec(Math.floor((Date.now() - queueStartedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [queuing, queueStartedAt]);

  useEffect(() => {
    const s = getSocket();
    const onStatus = (d: { inQueue: boolean; waitSeconds: number }) => {
      setServerWaitSeconds(d.waitSeconds);
      if (!d.inQueue && !useRankMatchStore.getState().matched) {
        useRankMatchStore.getState().setQueuing(false);
      }
    };
    s.on('rank:queue:status', onStatus);
    return () => { s.off('rank:queue:status', onStatus); };
  }, [setServerWaitSeconds]);

  const handleCancel = () => {
    getSocket().emit('rank:queue:leave');
    resetQueueUi();
    onClose();
  };

  return (
    <Modal
      open={open && queuing}
      onClose={onMinimize ?? handleCancel}
      onBackdropClick={onMinimize}
      title="랭크 매칭 중"
      closable={false}
      className="max-w-sm"
    >
      <div className="space-y-4 text-center">
        {/* 최소화 버튼 — onMinimize 제공 시만 표시 */}
        {onMinimize && (
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={onMinimize}
              className="flex h-7 w-7 items-center justify-center rounded-cdm-md text-lg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg"
              aria-label="최소화"
            >
              −
            </button>
          </div>
        )}

        <p className="text-4xl">🏆</p>
        <p className="text-sm text-cdm-fg-muted">상대를 찾는 중입니다.</p>
        <p className="text-2xl font-bold tabular-nums text-cdm-fg">{fmtElapsed(elapsedSec)}</p>
        <p className="text-sm font-medium text-cdm-fg">{nickname}</p>
        {member ? (
          <div className="flex justify-center">
            <QueueRankHint memberId={member.id} />
          </div>
        ) : null}
        <Button variant="secondary" className="w-full" onClick={handleCancel}>
          취소
        </Button>
      </div>
    </Modal>
  );
}

function QueueRankHint({ memberId }: { memberId: string }) {
  const [row, setRow] = useState<{
    tier: RankTier;
    rp: number;
    placementDone: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/rank')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.stats) return;
        setRow({
          tier: j.stats.tier as RankTier,
          rp: Number(j.stats.rp ?? 0),
          placementDone: Boolean(j.stats.placement_done),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [memberId]);

  if (!row) return <span className="text-xs text-cdm-fg-muted">랭크 불러오는 중...</span>;

  const placement = !row.placementDone;
  return (
    <RankBadge
      tier={row.tier}
      rp={placement ? undefined : row.rp}
      size="md"
      showRp={!placement}
    />
  );
}
