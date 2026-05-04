import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { MemberStatusChip } from '@/components/cdm/StatusChip';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { RoutePagination } from '@/components/cdm/Pagination';
import { getServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_PAGE_SIZE, getRange, getTotalPages, parsePageParam } from '@/lib/pagination';
import type { MemberStatus, TitleColor } from '@/lib/supabase/database.types';
import MemberSearch from './MemberSearch';

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
  suspended_until: string | null;
}
interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function MembersTab({
  query,
  page: pageParam,
}: {
  query: string;
  page: string | undefined;
}) {
  const sb = await getServerSupabase();
  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);

  let q = sb
    .from('members')
    .select('id, nickname, created_at, withdrawn_at, displayed_title_id', { count: 'exact' });
  if (query.trim()) {
    q = q.ilike('nickname', `%${query.trim()}%`);
  }
  const membersRes = await q.order('created_at', { ascending: false }).range(from, to);
  const members = (membersRes.data ?? []) as unknown as MemberListRow[];
  const totalCount = membersRes.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  if (members.length === 0) {
    return (
      <>
        <MemberSearch initial={query} />
        <p className="mt-4 text-sm text-cdm-fg-muted">결과가 없습니다.</p>
      </>
    );
  }

  const ids = members.map((m) => m.id);
  const privsRes = await sb
    .from('members_private')
    .select('member_id, status, role, suspended_until')
    .in('member_id', ids);
  const privs = (privsRes.data ?? []) as unknown as PrivRow[];

  const titleIds = members.map((m) => m.displayed_title_id).filter(Boolean) as string[];
  const titlesRes = titleIds.length
    ? await sb.from('titles').select('id, name, color').in('id', titleIds)
    : { data: [] };
  const titles = (titlesRes.data ?? []) as unknown as TitleRow[];

  return (
    <div className="flex flex-col gap-3">
      <MemberSearch initial={query} />
      <p className="text-xs text-cdm-fg-muted">
        총 {totalCount}명 · {page} / {totalPages} 페이지
      </p>
      {members.map((m) => {
        const priv = privs.find((p) => p.member_id === m.id);
        const title = m.displayed_title_id
          ? titles.find((t) => t.id === m.displayed_title_id)
          : null;
        const isWithdrawn = !!m.withdrawn_at;
        const status: MemberStatus = isWithdrawn ? 'withdrawn' : priv?.status ?? 'active';
        return (
          <Link key={m.id} href={`/admin/members/${m.id}`} className="block">
            <Card variant="interactive" className="p-3!">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {title && <TitleBadge name={title.name} color={title.color} size="sm" />}
                  <span className="font-semibold text-cdm-fg truncate">{m.nickname}</span>
                  <MemberStatusChip status={status} />
                  {priv?.role === 'admin' && (
                    <span className="rounded-cdm-sm bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-cdm-fg-subtle">
                  <span className="text-[11px]">
                    가입 {new Date(m.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
