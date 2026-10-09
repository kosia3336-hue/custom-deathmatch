'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useRankMatchStore } from '@/stores/rankMatch';
import { RankBadge } from '@/components/cdm/RankBadge';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import type { RankTier } from '@/shared/types/rank';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 제공되면 '내려두기' 가 생기고, Esc·뒤로 가기 대신 최소화한다 */
  onMinimize?: () => void;
}

export function formatQueueElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface MyRank {
  tier: RankTier;
  rp: number;
  placementDone: boolean;
}

function useMyRank(memberId: string | null): MyRank | null {
  const [row, setRow] = useState<MyRank | null>(null);
  useEffect(() => {
    if (!memberId) return;
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
    return () => {
      cancelled = true;
    };
  }, [memberId]);
  return memberId ? row : null;
}

/**
 * 랭크 매칭 대기 화면 — 모바일 전체 화면 (앱 재설계안 1c).
 *
 * 누르는 것은 모두 화면 아래에 모았다. 한 손으로 쥐었을 때 엄지가 닿는 곳이다.
 * 문구는 실제 동작만 적는다: 티어 범위 제한은 없고 매칭 점수가 가까운 상대를
 * 고르며(rankQueueStore.pickOpponent), 내려두고 다른 화면을 봐도 대기는 이어진다.
 */
export function RankQueueModal({ open, onClose, onMinimize }: Props) {
  const router = useRouter();
  const queuing = useRankMatchStore((s) => s.queuing);
  const queueStartedAt = useRankMatchStore((s) => s.queueStartedAt);
  const setServerWaitSeconds = useRankMatchStore((s) => s.setServerWaitSeconds);
  const resetQueueUi = useRankMatchStore((s) => s.resetQueueUi);
  const { member } = useCurrentMember();
  const myRank = useMyRank(member?.id ?? null);

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
  const minimize = onMinimize ?? onClose;
  const visible = open && queuing;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') minimize();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, minimize]);

  if (!visible) return null;

  const tier = myRank?.tier ?? 'unranked';
  const placement = myRank ? !myRank.placementDone : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-queue-title"
      className="rank-queue ink-scope fixed inset-0 z-(--cdm-z-overlay) flex flex-col text-cdm-ink-fg"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
        <p className="text-xs font-bold tracking-[0.18em] text-cdm-ink-fg-muted">랭크 매칭</p>

        <div className="relative flex size-32 items-center justify-center">
          <span aria-hidden className="rank-queue-pulse absolute inset-0 rounded-full border-2 border-cdm-primary" />
          <span aria-hidden className="absolute inset-4 rounded-full border border-white/12" />
          <Image
            src={`/rank/tier-${tier}.webp`}
            alt=""
            width={80}
            height={80}
            className="relative size-20 object-contain"
          />
        </div>

        <div>
          <h2 id="rank-queue-title" className="text-[22px] font-extrabold tracking-tight text-white">
            상대를 찾고 있습니다
          </h2>
          <p className="mt-1.5 text-sm text-cdm-ink-fg-muted">
            경과{' '}
            <span className="font-bold tabular-nums text-cdm-highlight">{formatQueueElapsed(elapsedSec)}</span>
          </p>
          {myRank && (
            <div className="mt-3 flex justify-center">
              <RankBadge tier={myRank.tier} rp={placement ? undefined : myRank.rp} size="md" showRp={!placement} />
            </div>
          )}
        </div>

        <ul className="w-full max-w-xs space-y-2 text-left text-[13px] leading-snug">
          <li className="flex items-center gap-2.5 rounded-cdm-md border border-white/10 bg-white/5 px-3.5 py-3">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-cdm-success" />
            매칭 점수가 가까운 상대부터 찾습니다.
          </li>
          <li className="flex items-center gap-2.5 rounded-cdm-md border border-white/10 bg-white/5 px-3.5 py-3">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-cdm-highlight" />
            내려두고 다른 화면을 봐도 대기는 계속됩니다.
          </li>
        </ul>
      </div>

      {/* 누르는 것은 아래에 — 엄지가 닿는 자리 */}
      <div className="flex flex-col gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            minimize();
            router.push('/rules');
          }}
          className="h-12 rounded-cdm-md border border-white/20 text-[15px] font-semibold text-cdm-ink-fg"
        >
          기다리는 동안 룰 보기
        </button>
        <div className="flex gap-2">
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="h-12 flex-1 rounded-cdm-md bg-white/10 text-[15px] font-semibold text-cdm-ink-fg"
            >
              내려두기
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="h-12 flex-1 rounded-cdm-md bg-cdm-accent/15 text-[15px] font-semibold text-rose-300"
          >
            매칭 취소
          </button>
        </div>
      </div>
    </div>
  );
}
