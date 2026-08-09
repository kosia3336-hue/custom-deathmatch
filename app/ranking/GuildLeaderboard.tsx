import { EmptyState } from '@/components/cdm/EmptyState';
import { RoutePagination } from '@/components/cdm/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages } from '@/lib/pagination';
import { listGuildRanking } from '@/lib/guild/server';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import GuildLeaderRow from './GuildLeaderRow';

interface Props {
  page: number;
  memberId: string | null;
}

/** 내가 속한 길드 id (미가입/비로그인이면 null) — 내 길드 줄을 강조하는 데만 쓴다 */
async function getMyGuildId(memberId: string | null): Promise<string | null> {
  if (!memberId) return null;
  const sb = getSupabaseServiceRole();
  const { data } = await sb
    .from('guild_members')
    .select('guild_id')
    .eq('member_id', memberId)
    .maybeSingle();
  return (data as { guild_id: string } | null)?.guild_id ?? null;
}

/** 길드 랭킹 — 길드 포인트 순 */
export default async function GuildLeaderboard({ page, memberId }: Props) {
  if (!isSupabaseServiceRoleConfigured()) {
    return <EmptyState title="길드 랭킹을 불러올 수 없습니다" description="서버 설정을 확인해 주세요." />;
  }

  const [all, myGuildId] = await Promise.all([listGuildRanking(), getMyGuildId(memberId)]);

  if (all.length === 0) {
    return (
      <EmptyState
        title="아직 창설된 길드가 없습니다"
        description="길드를 만들고 함께 게임하며 길드 포인트를 모아 보세요."
      />
    );
  }

  const totalPages = getTotalPages(all.length, DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const rows = all.slice(offset, offset + DEFAULT_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-cdm-fg-muted">
        길드 포인트 순 · 총 {all.length}개 · {page} / {totalPages} 페이지
      </p>
      {rows.map((g) => (
        <GuildLeaderRow
          key={g.id}
          rank={g.rank}
          name={g.name}
          ownerNickname={g.ownerNickname}
          memberCount={g.memberCount}
          capacity={g.capacity}
          points={g.points}
          markUrl={g.markUrl}
          buffCdpLevel={g.buffCdpLevel}
          highlight={myGuildId != null && g.id === myGuildId}
        />
      ))}
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
