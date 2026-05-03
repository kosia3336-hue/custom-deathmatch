import type { Metadata } from 'next';
import { GNB } from '@/components/cdm/GNB';
import { Card } from '@/components/cdm/Card';
import { EmptyState } from '@/components/cdm/EmptyState';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getAuthState } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import RankingTabs from './RankingTabs';
import type { TitleColor } from '@/lib/supabase/database.types';

export const metadata: Metadata = { title: '랭킹' };

interface Props {
  searchParams: Promise<{ game?: string; period?: string }>;
}

interface GameRow {
  id: string;
  name: string;
  ranking_active: boolean;
}

interface RankRow {
  rank: number;
  member_id: string;
  nickname: string;
  title: { id: string; name: string; color: TitleColor } | null;
  total_games: number;
  wins: number;
  win_rate: number;
  score: number;
}

function periodKstRange(period: 'weekly' | 'monthly' | 'all'): { from: Date; to: Date } | null {
  const now = new Date();
  // KST 기준 오늘 자정
  const kstOffsetMin = 9 * 60;
  const utc = new Date(now.toUTCString());
  const kst = new Date(utc.getTime() + kstOffsetMin * 60_000);
  const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));

  if (period === 'weekly') {
    const day = today.getUTCDay(); // 0 일 ~ 6 토
    const isoDay = day === 0 ? 7 : day; // 1 월 ~ 7 일
    const from = new Date(today);
    from.setUTCDate(today.getUTCDate() - (isoDay - 1));
    const to = new Date(from);
    to.setUTCDate(from.getUTCDate() + 7);
    return { from, to };
  }
  if (period === 'monthly') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return { from, to };
  }
  return null;
}

export default async function RankingPage({ searchParams }: Props) {
  const sp = await searchParams;
  const authState = await getAuthState();
  const member = authState.kind === 'ACTIVE' ? authState.member : null;

  const sb = await getServerSupabase();

  const metaRes = await sb.from('games').select('id, name, ranking_active').eq('ranking_active', true).order('sort_order');
  const meta = (metaRes.data ?? []) as unknown as GameRow[];

  // sp.game 이 없거나 빈 문자열이면 "전체" 모드
  const gameId = sp.game ?? '';
  const period = (sp.period as 'weekly' | 'monthly' | 'all') ?? 'weekly';

  let rankings: RankRow[] = [];

  if (gameId) {
    // 특정 게임 랭킹
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = await (sb.rpc as any)('compute_ranking', { p_game_id: gameId, p_period: period });
    if (!rpc.error) {
      rankings = (rpc.data ?? []) as RankRow[];
    }
  } else if (meta.length > 0) {
    // 전체 모드 — 모든 게임의 랭킹을 합산 후 베이지안 재계산
    type Acc = { member_id: string; nickname: string; title: RankRow['title']; total_games: number; wins: number };
    const memberMap = new Map<string, Acc>();

    for (const game of meta) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = await (sb.rpc as any)('compute_ranking', { p_game_id: game.id, p_period: period });
      if (rpc.error || !rpc.data) continue;
      for (const row of rpc.data as RankRow[]) {
        const ex = memberMap.get(row.member_id);
        if (ex) {
          ex.total_games += row.total_games;
          ex.wins += row.wins;
        } else {
          memberMap.set(row.member_id, {
            member_id: row.member_id,
            nickname: row.nickname,
            title: row.title,
            total_games: row.total_games,
            wins: row.wins,
          });
        }
      }
    }

    if (memberMap.size > 0) {
      const entries = Array.from(memberMap.values());
      const totalWins = entries.reduce((s, v) => s + v.wins, 0);
      const totalGames = entries.reduce((s, v) => s + v.total_games, 0);
      const globalMean = totalGames > 0 ? totalWins / totalGames : 0.5;
      const C = 10;

      rankings = entries
        .map((v) => ({
          ...v,
          win_rate: v.total_games > 0 ? v.wins / v.total_games : 0,
          score: (v.wins + C * globalMean) / (v.total_games + C),
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score || b.total_games - a.total_games || b.wins - a.wins)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    }
  }

  const range = periodKstRange(period);

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">랭킹</h1>
        </header>

        <RankingTabs
          games={meta.map((m) => ({ id: m.id, name: m.name }))}
          activeGame={gameId || null}
          activePeriod={period}
        />

        {range && (
          <p className="mb-3 text-xs text-cdm-fg-muted">
            기간: {range.from.toLocaleDateString('ko-KR')} ~{' '}
            {new Date(range.to.getTime() - 1).toLocaleDateString('ko-KR')} (KST)
          </p>
        )}

        {rankings.length === 0 ? (
          <EmptyState
            title="아직 집계된 랭킹이 없어요"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rankings.map((r) => {
              const isMe = member != null && r.member_id === member.id;
              return (
                <Card
                  key={r.member_id}
                  variant={isMe ? 'highlight' : 'default'}
                  accent="primary"
                  className="!p-3 flex items-center gap-3"
                >
                  <span className={`w-10 text-center text-lg font-bold tabular-nums ${
                    r.rank === 1 ? 'text-cdm-highlight' : r.rank <= 3 ? 'text-cdm-primary' : 'text-cdm-fg-muted'
                  }`}>
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {r.title && (
                        <TitleBadge name={r.title.name} color={r.title.color} size="sm" />
                      )}
                      <span className="truncate font-semibold text-cdm-fg">
                        {r.nickname}
                        {isMe && <span className="ml-1 text-xs text-cdm-fg-muted">(나)</span>}
                      </span>
                    </div>
                    <p className="text-xs text-cdm-fg-muted">
                      {r.total_games}판 · 승률 {Math.round((r.win_rate ?? 0) * 1000) / 10}%
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
