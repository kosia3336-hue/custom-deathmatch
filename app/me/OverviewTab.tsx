import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CurrentMember } from '@/lib/auth/server';
import type { TitleColor } from '@/lib/supabase/database.types';

interface StatsRow {
  game_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
}

interface GameRow {
  id: string;
  name: string;
}

export default async function OverviewTab({ member }: { member: CurrentMember }) {
  const sb = await getServerSupabase();

  const [statsRes, metaRes, reportsPendingRes, inquiriesPendingRes] = await Promise.all([
    sb
      .from('member_game_stats')
      .select('game_id, total_games, wins, losses, draws')
      .eq('member_id', member.id),
    sb.from('games').select('id, name'),
    sb
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', member.id)
      .in('status', ['pending', 'processing']),
    sb
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', member.id)
      .in('status', ['pending', 'processing', 'answered', 'replied']),
  ]);

  const stats = (statsRes.data ?? []) as unknown as StatsRow[];
  const meta = (metaRes.data ?? []) as unknown as GameRow[];
  const nameOf = (id: string) => meta.find((m) => m.id === id)?.name ?? id;

  const totalGames = stats.reduce((acc, s) => acc + s.total_games, 0);
  const topGames = [...stats].sort((a, b) => b.total_games - a.total_games).slice(0, 3);
  const pendingCount = (reportsPendingRes.count ?? 0) + (inquiriesPendingRes.count ?? 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">누적 전적</h2>
        <p className="mt-2 text-2xl font-bold text-cdm-fg">
          {totalGames === 0 ? '0판' : `${totalGames}판`}
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">표시 칭호</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-cdm-fg">
            {member.displayedTitle ? (
              <TitleBadge
                name={member.displayedTitle.name}
                color={member.displayedTitle.color as TitleColor}
                size="md"
              />
            ) : (
              <span className="text-sm text-cdm-fg-muted">없음</span>
            )}
          </p>
          <Link href="/me?tab=titles">
            <Button variant="tertiary" size="sm">칭호 관리 →</Button>
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">즐겨 한 게임 Top 3</h2>
        {topGames.length === 0 ? (
          <p className="mt-2 text-sm text-cdm-fg-muted">아직 데이터가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {topGames.map((g, i) => {
              const winRate = g.total_games > 0
                ? Math.round(((g.wins + g.draws * 0.5) / g.total_games) * 1000) / 10
                : 0;
              return (
                <li key={g.game_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-cdm-fg">{i + 1}. {nameOf(g.game_id)}</span>
                  <span className="shrink-0 text-cdm-fg-muted">
                    {g.total_games}전 {g.wins}승 {g.losses}패
                    {g.draws > 0 && ` ${g.draws}무`}
                    {' '}{winRate}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">처리 중 신고/문의</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-cdm-fg">
            {pendingCount === 0 ? (
              <span className="text-sm text-cdm-fg-muted">없음</span>
            ) : (
              <span className="text-2xl font-bold">{pendingCount}건</span>
            )}
          </p>
          <Link href="/me?tab=support">
            <Button variant="tertiary" size="sm">내역 보기 →</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
