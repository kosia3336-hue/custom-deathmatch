import type { ReactNode } from 'react';
import { Card } from '@/components/cdm/Card';
import { Tag } from '@/components/cdm/Tag';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';

interface StatsRow {
  game_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  resigns: number;
  total_first: number;
  wins_first: number;
  total_second: number;
  wins_second: number;
}

interface GameRow {
  id: string;
  name: string;
}

export default async function StatsTab({ memberId }: { memberId: string }) {
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  let rankBlock: ReactNode = null;
  try {
    const { data: season } = await db
      .from('rank_seasons')
      .select('id, name')
      .eq('is_active', true)
      .maybeSingle();
    if (season) {
      const { data: rs } = await db
        .from('rank_stats')
        .select(
          'tier, rp, placement_done, placement_games, win_streak, season_wins, season_losses, season_draws, season_peak_tier',
        )
        .eq('season_id', season.id)
        .eq('member_id', memberId)
        .maybeSingle();
      if (rs) {
        const row = rs as Record<string, unknown>;
        const tierKo: Record<string, string> = {
          unranked: '언랭',
          bronze: '브론즈',
          silver: '실버',
          gold: '골드',
          diamond: '다이아',
          challenger: '챌린저',
        };
        const tier = String(row.tier ?? 'unranked');
        const peak = String(row.season_peak_tier ?? 'unranked');
        const placementDone = Boolean(row.placement_done);
        const pg = Number(row.placement_games ?? 0);
        const ws = Number(row.win_streak ?? 0);
        const sw = Number(row.season_wins ?? 0);
        const sl = Number(row.season_losses ?? 0);
        const sd = Number(row.season_draws ?? 0);
        const rp = Number(row.rp ?? 0);
        rankBlock = (
          <Card variant="highlight" accent="accent">
            <h2 className="text-sm font-semibold text-cdm-fg-muted">랭크 전적 ({season.name})</h2>
            {!placementDone ? (
              <p className="mt-2 text-sm text-cdm-fg">
                배치전 진행 중 ({Math.min(5, pg)}/5) · 언랭
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm text-cdm-fg">
                <span className="font-semibold">{tierKo[tier] ?? tier}</span>
                <span className="text-cdm-fg-muted">{rp} RP</span>
              </div>
            )}
            <p className="mt-2 text-xs text-cdm-fg-muted">
              시즌 {sw + sl + sd}전 {sw}승 {sl}패{sd > 0 ? ` ${sd}무` : ''}
              {placementDone && ws > 0 ? ` · 현재 ${ws}연승` : ''} · 최고 티어 {tierKo[peak] ?? peak}
            </p>
          </Card>
        );
      }
    }
  } catch {
    /* 테이블 미구성 등 */
  }

  const statsRes = await sb
    .from('member_game_stats')
    .select(
      'game_id, total_games, wins, losses, draws, resigns, total_first, wins_first, total_second, wins_second',
    )
    .eq('member_id', memberId);
  const stats = (statsRes.data ?? []) as unknown as StatsRow[];

  const metaRes = await sb.from('games').select('id, name');
  const meta = (metaRes.data ?? []) as unknown as GameRow[];
  const nameOf = (id: string) => meta.find((m) => m.id === id)?.name ?? id;

  const total = stats.reduce(
    (acc, s) => ({
      games: acc.games + s.total_games,
      wins: acc.wins + s.wins,
      losses: acc.losses + s.losses,
      draws: acc.draws + s.draws,
    }),
    { games: 0, wins: 0, losses: 0, draws: 0 },
  );

  if (stats.length === 0 && !rankBlock) {
    return (
      <EmptyState title="아직 전적이 없어요" />
    );
  }

  if (stats.length === 0 && rankBlock) {
    return <div className="flex flex-col gap-4">{rankBlock}</div>;
  }

  const rate = total.games > 0
    ? Math.round(((total.wins + total.draws * 0.5) / total.games) * 1000) / 10
    : 0;

  const sorted = [...stats].sort((a, b) => b.total_games - a.total_games);

  return (
    <div className="flex flex-col gap-4">
      {rankBlock}
      <Card variant="highlight" accent="primary">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-cdm-fg-muted">전체</h2>
          <span className="text-2xl font-bold text-cdm-fg">{total.games}판</span>
          <span className="text-sm text-cdm-fg-muted">승률 {rate}%</span>
          <span className="text-sm text-cdm-fg-muted">
            {total.wins}승 / {total.losses}패 / {total.draws}무
          </span>
        </div>
      </Card>

      {sorted.map((s) => {
        const winRate = s.total_games > 0
          ? Math.round(((s.wins + s.draws * 0.5) / s.total_games) * 1000) / 10
          : 0;
        const firstRate = s.total_first > 0
          ? Math.round((s.wins_first / s.total_first) * 1000) / 10
          : 0;
        const secondRate = s.total_second > 0
          ? Math.round((s.wins_second / s.total_second) * 1000) / 10
          : 0;
        return (
          <Card key={s.game_id}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-base font-bold text-cdm-fg">{nameOf(s.game_id)}</h3>
              <Tag>{s.total_games}판</Tag>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="font-semibold text-cdm-fg">{winRate}%</span>
              <span className="text-cdm-fg-muted">
                {s.wins}승 / {s.losses}패 / {s.draws}무
                {s.resigns > 0 && ` / ${s.resigns}기권`}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cdm-bg-elev-2">
              <div
                className="h-full bg-cdm-primary"
                style={{ width: `${Math.min(100, winRate)}%` }}
              />
            </div>
            {(s.total_first > 0 || s.total_second > 0) && (
              <p className="mt-2 text-xs text-cdm-fg-muted">
                ▶ 선공 {s.total_first}판 / 승률 {firstRate}% · ▷ 후공 {s.total_second}판 / 승률 {secondRate}%
              </p>
            )}
          </Card>
        );
      })}

    </div>
  );
}
