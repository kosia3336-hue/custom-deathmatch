import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import { DEFAULT_PAGE_SIZE, getTotalPages, parsePageParam } from '@/lib/pagination';
import type { MemberStatus, TitleColor } from '@/lib/supabase/database.types';
import type { RankTier } from '@/shared/types/rank';
import MemberSearch from './MemberSearch';
import { MembersTableClient, type MemberTableRow } from './MembersTableClient';

interface MemberListRow {
  id: string;
  nickname: string;
  created_at: string;
  withdrawn_at: string | null;
  displayed_title_id: string | null;
}
interface PrivRow {
  member_id: string;
  status: MemberStatus;
  role: 'user' | 'admin';
}
interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
}
interface RankRow {
  member_id: string;
  tier: string;
  rp: number;
}
interface CdpRow {
  member_id: string;
  balance: number;
}
interface GameStatsRow {
  member_id: string;
  total_games: number;
}

export type SortKey = 'created_at' | 'games' | 'tier' | 'cdp';

const TIER_NUM: Record<string, number> = {
  diamond: 4, gold: 3, silver: 2, bronze: 1, unranked: 0,
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function MembersTab({
  query,
  page: pageParam,
  sort: sortParam,
}: {
  query: string;
  page: string | undefined;
  sort: string | undefined;
}) {
  const sort: SortKey = (['created_at', 'games', 'tier', 'cdp'] as const).includes(
    sortParam as SortKey,
  )
    ? (sortParam as SortKey)
    : 'created_at';

  const sb = getSupabaseServiceRole();

  let q = sb
    .from('members')
    .select('id, nickname, created_at, withdrawn_at, displayed_title_id');
  if (query.trim()) {
    q = q.ilike('nickname', `%${query.trim()}%`);
  }
  const membersRes = await q.order('created_at', { ascending: false });
  const members = (membersRes.data ?? []) as unknown as MemberListRow[];

  const ids = members.map((m) => m.id);

  const [privsRes, seasonRes, cdpRes, gameStatsRes] = await Promise.all([
    sb.from('members_private').select('member_id, status, role').in('member_id', ids),
    sb.from('rank_seasons').select('id').eq('is_active', true).maybeSingle(),
    sb.from('member_cdp').select('member_id, balance').in('member_id', ids),
    sb.from('member_game_stats').select('member_id, total_games').in('member_id', ids),
  ]);

  const activeSeason = (seasonRes.data as { id: number } | null)?.id;
  const rankRes = activeSeason
    ? await sb
        .from('rank_stats')
        .select('member_id, tier, rp')
        .eq('season_id', activeSeason)
        .in('member_id', ids)
    : { data: [] };

  const titleIds = [...new Set(
    members.map((m) => m.displayed_title_id).filter(Boolean) as string[],
  )];
  const titlesRes = titleIds.length
    ? await sb.from('titles').select('id, name, color').in('id', titleIds)
    : { data: [] };

  const privs = (privsRes.data ?? []) as unknown as PrivRow[];
  const rankRows = (rankRes.data ?? []) as unknown as RankRow[];
  const cdpRows = (cdpRes.data ?? []) as unknown as CdpRow[];
  const gameStatsRows = (gameStatsRes.data ?? []) as unknown as GameStatsRow[];
  const titles = (titlesRes.data ?? []) as unknown as TitleRow[];

  const privMap = new Map(privs.map((p) => [p.member_id, p]));
  const titleMap = new Map(titles.map((t) => [t.id, t]));
  const rankMap = new Map(rankRows.map((r) => [r.member_id, r]));
  const cdpMap = new Map(cdpRows.map((c) => [c.member_id, c.balance]));
  const gameStatsMap = new Map<string, number>();
  for (const r of gameStatsRows) {
    gameStatsMap.set(r.member_id, (gameStatsMap.get(r.member_id) ?? 0) + r.total_games);
  }

  const enriched: MemberTableRow[] = members.map((m) => {
    const priv = privMap.get(m.id);
    const rank = rankMap.get(m.id);
    const isWithdrawn = !!m.withdrawn_at;
    const status: MemberStatus = isWithdrawn ? 'withdrawn' : (priv?.status ?? 'active');
    return {
      id: m.id,
      nickname: m.nickname,
      created_at: m.created_at,
      status,
      role: priv?.role ?? 'user',
      title: m.displayed_title_id
        ? (titleMap.get(m.displayed_title_id) ?? null)
        : null,
      tier: (rank?.tier ?? 'unranked') as RankTier,
      rp: rank?.rp ?? 0,
      cdp: cdpMap.get(m.id) ?? 0,
      totalGames: gameStatsMap.get(m.id) ?? 0,
    };
  });

  const sorted = [...enriched];
  if (sort === 'games') {
    sorted.sort((a, b) => b.totalGames - a.totalGames);
  } else if (sort === 'tier') {
    sorted.sort((a, b) => {
      const td = (TIER_NUM[b.tier] ?? 0) - (TIER_NUM[a.tier] ?? 0);
      return td !== 0 ? td : b.rp - a.rp;
    });
  } else if (sort === 'cdp') {
    sorted.sort((a, b) => b.cdp - a.cdp);
  }

  const page = parsePageParam(pageParam);
  const totalCount = sorted.length;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const pageMembers = sorted.slice(from, from + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <MemberSearch initial={query} sort={sort} />
      {pageMembers.length === 0 ? (
        <p className="text-sm text-cdm-fg-muted">결과가 없습니다.</p>
      ) : (
        <MembersTableClient
          members={pageMembers}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}
