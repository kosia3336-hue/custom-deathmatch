'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { RankBadge } from '@/components/cdm/RankBadge';
import type { RankTier } from '@/shared/types/rank';

const TIER_KO: Record<RankTier, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

export function OverviewRankCard() {
  type Snap =
    | 'loading'
    | null
    | {
        season: { id: number; name: string; started_at: string; ended_at: string | null } | null;
        stats: {
          tier: RankTier;
          rp: number;
          placement_done: boolean;
          placement_games: number;
          season_wins: number;
          season_losses: number;
          season_draws: number;
          season_peak_tier: RankTier;
        } | null;
      };

  const [snap, setSnap] = useState<Snap>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/rank')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        if (!j?.season) {
          setSnap(null);
          return;
        }
        setSnap({
          season: j.season,
          stats: j.stats
            ? {
                tier: j.stats.tier as RankTier,
                rp: Number(j.stats.rp ?? 0),
                placement_done: Boolean(j.stats.placement_done),
                placement_games: Number(j.stats.placement_games ?? 0),
                season_wins: Number(j.stats.season_wins ?? 0),
                season_losses: Number(j.stats.season_losses ?? 0),
                season_draws: Number(j.stats.season_draws ?? 0),
                season_peak_tier: (j.stats.season_peak_tier as RankTier) ?? 'unranked',
              }
            : null,
        });
      })
      .catch(() => {
        if (!cancelled) setSnap(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (snap === 'loading') {
    return (
      <Card>
        <div className="h-24 animate-pulse rounded bg-cdm-bg-elev-2" />
      </Card>
    );
  }

  if (!snap?.season) {
    return null;
  }

  const st = snap.stats;
  const placement = st && !st.placement_done;

  return (
    <Card variant="highlight" accent="accent">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-cdm-fg-muted">랭크</h2>
          {st ? (
            <div className="mt-2 flex flex-col gap-2">
              <RankBadge
                tier={st.tier}
                rp={placement ? undefined : st.rp}
                size="lg"
                showRp={!placement}
              />
              {placement ? (
                <p className="text-sm text-cdm-fg-muted">
                  배치전 진행 중 ({Math.min(5, st.placement_games)}/5)
                </p>
              ) : (
                <>
                  <div className="h-2 max-w-xs overflow-hidden rounded-full bg-cdm-bg-elev-2">
                    <div
                      className="h-full bg-cdm-primary"
                      style={{ width: `${Math.min(100, st.rp)}%` }}
                    />
                  </div>
                  <p className="text-xs text-cdm-fg-muted">
                    이번 시즌 {st.season_wins}승 {st.season_losses}패
                    {st.season_draws > 0 ? ` ${st.season_draws}무` : ''} · 최고 티어{' '}
                    {TIER_KO[st.season_peak_tier] ?? st.season_peak_tier}
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-cdm-fg-muted">시즌 기록이 없습니다.</p>
          )}
          <p className="mt-3 text-xs text-cdm-fg-muted">
            {snap.season.name} ·{' '}
            {new Date(snap.season.started_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
            ~
          </p>
        </div>
        <Link
          href="/ranking?board=rank"
          className="inline-flex h-8 shrink-0 items-center rounded-cdm-md px-4 text-[13px] text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-1 hover:text-cdm-fg"
        >
          랭크 랭킹 →
        </Link>
      </div>
    </Card>
  );
}
