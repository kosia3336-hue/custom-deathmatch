import { getServerSupabase } from '@/lib/supabase/server';
import { compareRankRows, isChallengerSlot } from '@/lib/rank/leaderboard';
import { RoutePagination } from '@/components/cdm/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages } from '@/lib/pagination';
import RankLeaderRow from './RankLeaderRow';
import type { RankTier } from '@/shared/types/rank';
import type { TitleColor } from '@/lib/supabase/database.types';

interface StatsRow {
  member_id: string;
  tier: string;
  rp: number;
  placement_done: boolean;
  season_wins: number;
  season_losses: number;
  season_draws: number;
}

interface Props {
  seasonId: number;
  page: number;
  memberId: string | null;
  tierFilter: string | null;
}

export default async function RankSeasonLeaderboard({ seasonId, page, memberId, tierFilter }: Props) {
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: statsRows, error: statsErr } = await db
    .from('rank_stats')
    .select('member_id, tier, rp, placement_done, season_wins, season_losses, season_draws')
    .eq('season_id', seasonId)
    .limit(5000);

  if (statsErr || !statsRows?.length) {
    return <p className="text-sm text-cdm-fg-muted">아직 랭크 기록이 없습니다.</p>;
  }

  const stats = statsRows as StatsRow[];
  stats.sort((a, b) =>
    compareRankRows(
      { tier: a.tier as RankTier, rp: a.rp, wins: a.season_wins },
      { tier: b.tier as RankTier, rp: b.rp, wins: b.season_wins },
    ),
  );

  // 전체 정렬 기준으로 챌린저 여부를 미리 계산
  const statsWithMeta = stats.map((s, i) => ({
    ...s,
    isChallenger: isChallengerSlot(i + 1, s.tier as RankTier, s.rp),
  }));

  const filtered =
    tierFilter === 'challenger'
      ? statsWithMeta.filter((s) => s.isChallenger)
      : tierFilter === 'diamond'
        ? statsWithMeta.filter((s) => s.tier === 'diamond' && !s.isChallenger)
        : tierFilter
          ? statsWithMeta.filter((s) => s.tier === tierFilter)
          : statsWithMeta;

  const total = filtered.length;
  const totalPages = getTotalPages(total, DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const pageSlice = filtered.slice(offset, offset + DEFAULT_PAGE_SIZE);

  const myIndex = memberId ? filtered.findIndex((s) => s.member_id === memberId) : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const onCurrentPage =
    myRank != null
    && myRank > offset
    && myRank <= offset + DEFAULT_PAGE_SIZE;

  const extraIds = new Set(pageSlice.map((s) => s.member_id));
  if (memberId && myRank != null && myRank > 20 && !onCurrentPage && filtered[myIndex]) {
    extraIds.add(memberId);
  }

  const ids = [...extraIds];
  const { data: members } = await db
    .from('members')
    .select('id, nickname, displayed_title_id')
    .in('id', ids);

  const memberRows = (members ?? []) as {
    id: string;
    nickname: string;
    displayed_title_id: string | null;
  }[];

  const nickMap = new Map(memberRows.map((m) => [m.id, m.nickname]));
  const titleIds = [
    ...new Set(memberRows.map((m) => m.displayed_title_id).filter(Boolean)),
  ] as string[];

  let titleMap = new Map<string, { name: string; color: TitleColor; effect: string | null }>();
  if (titleIds.length > 0) {
    const { data: titles } = await db.from('titles').select('id, name, color, effect').in('id', titleIds);
    titleMap = new Map(
      (titles ?? []).map((t: { id: string; name: string; color: TitleColor; effect: string | null }) => [
        t.id,
        { name: t.name, color: t.color, effect: t.effect ?? null },
      ]),
    );
  }

  function titleFor(mid: string) {
    const m = memberRows.find((x) => x.id === mid);
    const tid = m?.displayed_title_id;
    if (!tid) return null;
    return titleMap.get(tid) ?? null;
  }

  let stickyRow: (StatsRow & { isChallenger: boolean }) | null = null;
  if (memberId && myRank != null && myRank > 20 && !onCurrentPage && myIndex >= 0) {
    stickyRow = filtered[myIndex]!;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-cdm-fg-muted">
        총 {total}명 · {page} / {totalPages} 페이지
      </p>
      {pageSlice.map((row, i) => {
        const rank = offset + i + 1;
        const nickname = nickMap.get(row.member_id) ?? '(알 수 없음)';
        return (
          <RankLeaderRow
            key={row.member_id}
            rank={rank}
            nickname={nickname}
            title={titleFor(row.member_id)}
            tier={row.tier as RankTier}
            rp={row.rp}
            placementDone={row.placement_done}
            wins={row.season_wins}
            losses={row.season_losses}
            draws={row.season_draws}
            isChallenger={row.isChallenger}
            highlight={memberId != null && row.member_id === memberId}
          />
        );
      })}
      {stickyRow ? (
        <>
          <p className="pt-2 text-xs font-medium text-cdm-fg-muted">내 순위 (20위 밖)</p>
          <RankLeaderRow
            rank={myRank!}
            nickname={nickMap.get(stickyRow.member_id) ?? '(알 수 없음)'}
            title={titleFor(stickyRow.member_id)}
            tier={stickyRow.tier as RankTier}
            rp={stickyRow.rp}
            placementDone={stickyRow.placement_done}
            wins={stickyRow.season_wins}
            losses={stickyRow.season_losses}
            draws={stickyRow.season_draws}
            isChallenger={stickyRow.isChallenger}
            highlight
          />
        </>
      ) : null}
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
