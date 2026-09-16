import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GNB } from '@/components/cdm/GNB';
import { EmptyState } from '@/components/cdm/EmptyState';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { RoutePagination } from '@/components/cdm/Pagination';
import { RankCardShell } from '@/components/ranking/RankCardShell';
import { getAuthState } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { loadResolvedDisplayedTitles } from '@shared/titles/resolve-displayed';
import {
  DEFAULT_PAGE_SIZE,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import {
  RANKING_LIST_SCAN_LIMIT,
  findMemberIdsByNickname,
  parseRankingNicknameQuery,
} from '@/lib/rank/nicknameSearch';
import RankingTabs from './RankingTabs';
import RankingBoardTabs, { type RankingBoard } from './RankingBoardTabs';
import RankSeasonLeaderboard from './RankSeasonLeaderboard';
import { loadGuildMarksForMembers, loadRankCardSkinsForMembers } from './loadGuildMarks';
import type { GuildMarkInfo } from '@/components/cdm/GuildMark';
import { OpenGuildInfoMark } from '@/components/guild-v4/OpenGuildInfoMark';
import type { TitleColor } from '@/lib/supabase/database.types';
import { CONTAINER_READ } from '@/lib/layout';
import type { RankCardShopSkinId } from '@shared/rank-card-skins';

export const metadata: Metadata = {
  title: '랭킹',
  description:
    '게임별 주간·월간·전체 랭킹. 베이지안 평균 점수로 공정하게 집계된 1:1 보드·카드 게임 순위를 확인하세요.',
  alternates: { canonical: '/ranking' },
  openGraph: {
    title: '랭킹 — 커스텀 데스매치',
    description: '게임별 주간·월간·전체 랭킹. 베이지안 평균 점수로 공정 집계.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

interface Props {
  searchParams: Promise<{
    game?: string;
    period?: string;
    page?: string;
    board?: string;
    season?: string;
    q?: string;
  }>;
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
  title: { id: string; name: string; color: TitleColor; effect?: string | null } | null;
  total_games: number;
  wins: number;
  draws: number;
  win_rate: number;
  score: number;
  total_count: number;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

function formatKstDate(date: Date): string {
  const kstOffsetMin = 9 * 60;
  const kst = new Date(date.getTime() + kstOffsetMin * 60_000);
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const board: RankingBoard = sp.board === 'game' ? 'game' : 'rank';

  let seasons: { id: number; name: string; is_active: boolean | null }[] = [];
  if (board === 'rank') {
    const { data } = await db
      .from('rank_seasons')
      .select('id, name, is_active')
      .order('id', { ascending: false });
    seasons = (data ?? []) as typeof seasons;
  }

  let seasonIdNum: number | null = null;
  if (board === 'rank' && seasons.length > 0) {
    const parsed = sp.season ? Number(sp.season) : NaN;
    if (!Number.isNaN(parsed) && seasons.some((s) => s.id === parsed)) {
      seasonIdNum = parsed;
    } else {
      seasonIdNum = seasons.find((s) => s.is_active)?.id ?? seasons[0].id;
    }
  }

  const metaRes = await sb
    .from('games')
    .select('id, name, ranking_active')
    .eq('ranking_active', true)
    .order('sort_order');
  const meta = (metaRes.data ?? []) as unknown as GameRow[];

  const gameId = sp.game ?? '';
  const period = (sp.period as 'weekly' | 'monthly' | 'all') ?? 'weekly';
  const page = parsePageParam(sp.page);
  const offset = (page - 1) * PAGE_SIZE;
  const nicknameQuery = parseRankingNicknameQuery(sp.q);
  const matchIds = nicknameQuery
    ? new Set(await findMemberIdsByNickname(db, nicknameQuery))
    : null;

  let rankings: RankRow[] = [];
  let totalCount = 0;
  let guildMarks = new Map<string, GuildMarkInfo>();
  let rankCardSkins = new Map<string, RankCardShopSkinId>();

  if (board === 'game') {
    const searching = matchIds != null;
    try {
      if (searching && matchIds.size === 0) {
        rankings = [];
        totalCount = 0;
      } else {
        const rpcLimit = searching ? RANKING_LIST_SCAN_LIMIT : PAGE_SIZE;
        const rpcOffset = searching ? 0 : offset;
        if (gameId) {
          const data = await callRpc(sb, 'compute_ranking', {
            p_game_id: gameId,
            p_period: period,
            p_limit: rpcLimit,
            p_offset: rpcOffset,
          });
          rankings = (data ?? []) as unknown as RankRow[];
        } else if (meta.length > 0) {
          const data = await callRpc(sb, 'compute_ranking_all', {
            p_period: period,
            p_limit: rpcLimit,
            p_offset: rpcOffset,
          });
          rankings = (data ?? []) as unknown as RankRow[];
        }
        if (matchIds) {
          rankings = rankings.filter((r) => matchIds.has(r.member_id));
          totalCount = rankings.length;
          rankings = rankings.slice(offset, offset + PAGE_SIZE);
        } else {
          totalCount = rankings.length > 0 ? rankings[0].total_count : 0;
        }
      }
    } catch (e) {
      console.error('[ranking] RPC error', e);
    }

    if (rankings.length > 0) {
      const { data: mems } = await sb
        .from('members')
        .select('id, nickname, displayed_title_id, displayed_effect_id')
        .in('id', rankings.map((r) => r.member_id));
      const memberRows = (mems ?? []) as Array<{
        id: string;
        nickname: string;
        displayed_title_id: string | null;
        displayed_effect_id: string | null;
      }>;
      const nickMap = new Map(memberRows.map((m) => [m.id, m.nickname]));
      const resolved = await loadResolvedDisplayedTitles(sb, memberRows);
      rankings = rankings.map((r) => {
        const t = resolved.get(r.member_id);
        return {
          ...r,
          nickname: nickMap.get(r.member_id) ?? r.nickname,
          title: t
            ? { id: t.id, name: t.name, color: t.color as TitleColor, effect: t.effect }
            : null,
        };
      });
      const memberIds = rankings.map((r) => r.member_id);
      [guildMarks, rankCardSkins] = await Promise.all([
        loadGuildMarksForMembers(sb, memberIds),
        loadRankCardSkinsForMembers(sb, memberIds),
      ]);
    }
  }

  const totalPages = getTotalPages(totalCount, PAGE_SIZE);
  const range = periodKstRange(period);

  return (
    <>
      <GNB member={member} />
      <main className={`${CONTAINER_READ} flex-1 px-4 py-6 md:px-6`}>
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">랭킹</h1>
        </header>

        <Suspense fallback={<div className="mb-4 h-12 animate-pulse rounded-cdm-md bg-cdm-bg-elev-2" />}>
          <RankingBoardTabs board={board} seasons={seasons} defaultSeasonId={seasonIdNum} />
        </Suspense>

        {board === 'game' && (
          <>
            <RankingTabs
              games={meta.map((m) => ({ id: m.id, name: m.name }))}
              activeGame={gameId || null}
              activePeriod={period}
            />

            {range && (
              <p className="mb-3 text-xs text-cdm-fg-muted">
                기간: {formatKstDate(range.from)} ~ {formatKstDate(new Date(range.to.getTime() - 24 * 60 * 60 * 1000))}{' '}
                (KST)
              </p>
            )}

            {rankings.length === 0 ? (
              <EmptyState
                title={
                  nicknameQuery
                    ? `"${nicknameQuery}"에 해당하는 플레이어가 없습니다`
                    : '아직 집계된 랭킹이 없습니다'
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-cdm-fg-muted">
                  총 {totalCount}명
                  {nicknameQuery ? ` · "${nicknameQuery}" 검색` : ''}
                  {' · '}
                  {page} / {totalPages} 페이지
                </p>
                {rankings.map((r) => {
                  const isMe = member != null && r.member_id === member.id;
                  return (
                    <RankCardShell
                      key={r.member_id}
                      skin={rankCardSkins.get(r.member_id)}
                      highlight={isMe}
                      className="!p-3"
                      bodyClassName="flex items-center gap-3"
                    >
                      <span
                        className={`w-10 text-center text-lg font-bold tabular-nums ${
                          r.rank === 1
                            ? 'text-cdm-highlight'
                            : r.rank <= 3
                              ? 'text-cdm-primary'
                              : 'text-cdm-fg-muted'
                        }`}
                      >
                        {r.rank}
                      </span>
                      <OpenGuildInfoMark mark={guildMarks.get(r.member_id)} size="xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {r.title && (
                            <TitleBadge name={r.title.name} color={r.title.color} effect={r.title.effect as TitleEffect | null} size="sm" />
                          )}
                          <span className="truncate font-semibold text-cdm-fg">
                            {r.nickname}
                            {isMe && <span className="ml-1 text-xs text-cdm-fg-muted">(나)</span>}
                          </span>
                        </div>
                        <p className="text-xs text-cdm-fg-muted">
                          {r.total_games}판 · {r.wins}승 {r.draws}무 {r.total_games - r.wins - r.draws}패 · 승률{' '}
                          {Math.round((r.win_rate ?? 0) * 1000) / 10}%
                        </p>
                      </div>
                    </RankCardShell>
                  );
                })}
                <RoutePagination totalPages={totalPages} />
              </div>
            )}
          </>
        )}

        {board === 'rank' && (
          <>
            {seasonIdNum == null ? (
              <EmptyState title="랭크 시즌이 아직 없습니다" />
            ) : (
              <RankSeasonLeaderboard
                seasonId={seasonIdNum}
                page={page}
                memberId={member?.id ?? null}
                nicknameQuery={nicknameQuery}
                matchIds={matchIds}
              />
            )}
          </>
        )}

      </main>
    </>
  );
}
