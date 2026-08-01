import { getAdminSupabase } from '@/lib/supabase/admin';
import { getSmsEventSeasonId, loadEventLeaderboard } from '@/lib/event/leaderboard';
import { RoutePagination } from '@/components/cdm/Pagination';
import { EmptyState } from '@/components/cdm/EmptyState';
import { DEFAULT_PAGE_SIZE, getTotalPages } from '@/lib/pagination';
import EventLeaderRow from './EventLeaderRow';
import type { TitleColor } from '@/lib/supabase/database.types';

interface Props {
  page: number;
  memberId: string | null;
}

export default async function EventSeasonLeaderboard({ page, memberId }: Props) {
  if (!getSmsEventSeasonId()) {
    return (
      <EmptyState
        title="이벤트 랭킹을 불러올 수 없습니다"
        description="EVENT_SMS_SEASON_ID가 설정되지 않았습니다."
      />
    );
  }

  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const { rows, total } = await loadEventLeaderboard(DEFAULT_PAGE_SIZE, offset);

  if (!getAdminSupabase()) {
    return (
      <EmptyState
        title="이벤트 랭킹을 불러올 수 없습니다"
        description="서버 설정을 확인해 주세요."
      />
    );
  }

  if (total === 0) {
    return <EmptyState title="아직 집계된 이벤트 점수가 없습니다" />;
  }

  const totalPages = getTotalPages(total, DEFAULT_PAGE_SIZE);
  const ids = rows.map((r) => r.member_id);

  const sb = getAdminSupabase()!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (sb.from as any)('members')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: titles } = await (sb.from as any)('titles')
      .select('id, name, color, effect')
      .in('id', titleIds);
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

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-cdm-fg-muted">
        해달별 · 누적 점수 · 총 {total}명 · {page} / {totalPages} 페이지
      </p>
      {rows.map((row, i) => {
        const rank = offset + i + 1;
        return (
          <EventLeaderRow
            key={row.member_id}
            rank={rank}
            nickname={nickMap.get(row.member_id) ?? '(알 수 없음)'}
            title={titleFor(row.member_id)}
            totalScore={row.total_score}
            roundsPlayed={row.rounds_played}
            roundsWon={row.rounds_won}
            highlight={memberId != null && row.member_id === memberId}
          />
        );
      })}
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
