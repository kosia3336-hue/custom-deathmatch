import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import { DEFAULT_PAGE_SIZE, getTotalPages, parsePageParam } from '@/lib/pagination';
import { EmptyState } from '@/components/cdm/EmptyState';
import AdminGuildSearch from './AdminGuildSearch';
import { AdminGuildTable, type AdminGuildListRow } from './AdminGuildTable';

type StatusFilter = 'active' | 'disbanded' | 'all';

interface GuildRow {
  id: string;
  name: string;
  owner_id: string;
  capacity: number;
  points: number;
  created_at: string;
  disbanded_at: string | null;
  mark_url: string | null;
  buff_cdp_level: number | null;
}

export default async function AdminGuildTab({
  query,
  page: pageParam,
  status: statusParam,
}: {
  query: string;
  page: string | undefined;
  status: string | undefined;
}) {
  const status: StatusFilter =
    statusParam === 'disbanded' || statusParam === 'all' ? statusParam : 'active';

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  let q = db
    .from('guilds')
    .select('id, name, owner_id, capacity, points, created_at, disbanded_at, mark_url, buff_cdp_level');
  if (status === 'active') q = q.is('disbanded_at', null);
  if (status === 'disbanded') q = q.not('disbanded_at', 'is', null);
  if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);

  const { data } = await q.order('created_at', { ascending: false });
  const guilds = (data ?? []) as GuildRow[];
  const ids = guilds.map((g) => g.id);

  const [membersRes, pendingRes, ownersRes] = await Promise.all([
    ids.length
      ? db.from('guild_members').select('guild_id').in('guild_id', ids)
      : { data: [] },
    ids.length
      ? db.from('guild_join_requests').select('guild_id').in('guild_id', ids).eq('status', 'pending')
      : { data: [] },
    guilds.length
      ? sb
          .from('members')
          .select('id, nickname')
          .in('id', [...new Set(guilds.map((g) => g.owner_id))])
      : { data: [] },
  ]);

  const memberCount = new Map<string, number>();
  for (const r of (membersRes.data ?? []) as { guild_id: string }[]) {
    memberCount.set(r.guild_id, (memberCount.get(r.guild_id) ?? 0) + 1);
  }
  const pendingCount = new Map<string, number>();
  for (const r of (pendingRes.data ?? []) as { guild_id: string }[]) {
    pendingCount.set(r.guild_id, (pendingCount.get(r.guild_id) ?? 0) + 1);
  }
  const nicks = new Map(
    ((ownersRes.data ?? []) as { id: string; nickname: string }[]).map((m) => [m.id, m.nickname]),
  );

  const allRows: AdminGuildListRow[] = guilds.map((g) => ({
    id: g.id,
    name: g.name,
    markUrl: g.mark_url,
    ownerNickname: nicks.get(g.owner_id) ?? '',
    memberCount: memberCount.get(g.id) ?? 0,
    capacity: g.capacity,
    points: Number(g.points),
    buffCdpLevel: Number(g.buff_cdp_level ?? 0),
    pendingJoins: pendingCount.get(g.id) ?? 0,
    createdAt: g.created_at,
    disbandedAt: g.disbanded_at,
  }));

  const totalCount = allRows.length;
  const totalPages = getTotalPages(totalCount, DEFAULT_PAGE_SIZE);
  const page = parsePageParam(pageParam, totalPages);
  const start = (page - 1) * DEFAULT_PAGE_SIZE;
  const rows = allRows.slice(start, start + DEFAULT_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <AdminGuildSearch initial={query} status={status} />
      {rows.length === 0 ? (
        <EmptyState title="길드가 없습니다" />
      ) : (
        <AdminGuildTable rows={rows} totalCount={totalCount} totalPages={totalPages} />
      )}
    </div>
  );
}
