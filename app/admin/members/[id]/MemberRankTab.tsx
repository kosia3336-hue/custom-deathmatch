'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/cdm/Card';
import { RankBadge } from '@/components/cdm/RankBadge';

const TIER_KO: Record<string, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
};

interface Props {
  memberId: string;
}

export default function MemberRankTab({ memberId }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{
    seasons: { id: number; name: string; is_active: boolean | null }[];
    activeSeason: { id: number; name: string } | null;
    stats: Record<string, unknown> | null;
    history: Record<string, unknown>[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/members/${memberId}/rank`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? '불러오기 실패');
        return j;
      })
      .then((j) => {
        if (!cancelled) {
          setData(j);
          setErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (loading) {
    return <p className="text-sm text-cdm-fg-muted">불러오는 중…</p>;
  }
  if (err) {
    return <p className="text-sm text-cdm-accent">{err}</p>;
  }
  if (!data?.activeSeason) {
    return <p className="text-sm text-cdm-fg-muted">진행 중인 랭크 시즌이 없습니다.</p>;
  }

  const st = data.stats;
  const tier = st ? String(st.tier ?? 'unranked') : 'unranked';
  const rp = st ? Number(st.rp ?? 0) : 0;
  const placementDone = st ? Boolean(st.placement_done) : false;
  const wins = st ? Number(st.season_wins ?? 0) : 0;
  const losses = st ? Number(st.season_losses ?? 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="text-sm font-semibold text-cdm-fg">현재 시즌 ({data.activeSeason.name})</h3>
        {st ? (
          <div className="mt-3 flex flex-col gap-2">
            <RankBadge
              tier={tier as 'unranked' | 'bronze' | 'silver' | 'gold' | 'diamond'}
              rp={placementDone ? rp : undefined}
              size="lg"
              showRp={placementDone}
            />
            {!placementDone ? (
              <p className="text-sm text-cdm-fg-muted">
                배치전 진행 중 ({Math.min(5, Number(st.placement_games ?? 0))}/5)
              </p>
            ) : (
              <p className="text-sm text-cdm-fg-muted">
                이번 시즌 {wins}승 {losses}패 · 최고 티어{' '}
                {TIER_KO[String(st.season_peak_tier ?? 'unranked')] ?? st.season_peak_tier}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-cdm-fg-muted">이번 시즌 랭크 기록이 없습니다.</p>
        )}
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-cdm-fg">최근 랭크 매치</h3>
        {data.history.length === 0 ? (
          <p className="text-sm text-cdm-fg-muted">기록이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.history.map((h) => {
              const hid = String(h.id ?? '');
              const playedAt = h.played_at ? new Date(String(h.played_at)).toLocaleString('ko-KR') : '';
              const wid = String(h.winner_id ?? '');
              const lid = String(h.loser_id ?? '');
              const won = wid === memberId;
              return (
                <li key={hid} className="rounded-cdm-md border border-cdm-border px-3 py-2">
                  <span className={won ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>
                    {won ? '승리' : '패배'}
                  </span>
                  <span className="ml-2 text-cdm-fg-muted">{playedAt}</span>
                  {h.is_forfeit ? (
                    <span className="ml-2 text-xs text-cdm-fg-muted">(항복)</span>
                  ) : null}
                  <div className="mt-1 text-xs text-cdm-fg-muted">
                    {String(h.game_id)} ·{' '}
                    {won
                      ? `${TIER_KO[String(h.winner_tier ?? '')] ?? h.winner_tier} RP ${h.winner_rp_before}→${h.winner_rp_after}`
                      : `${TIER_KO[String(h.loser_tier ?? '')] ?? h.loser_tier} RP ${h.loser_rp_before}→${h.loser_rp_after}`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-cdm-fg">시즌 이력</h3>
        <ul className="mt-2 space-y-1 text-xs text-cdm-fg-muted">
          {(data.seasons ?? []).map((s) => (
            <li key={s.id}>
              {s.name} {s.is_active ? '(진행 중)' : ''}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
