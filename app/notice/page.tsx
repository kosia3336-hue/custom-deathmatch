import type { Metadata } from 'next';
import Link from 'next/link';
import { GNB } from '@/components/cdm/GNB';
import { Card } from '@/components/cdm/Card';
import { EmptyState } from '@/components/cdm/EmptyState';
import { RoutePagination } from '@/components/cdm/Pagination';
import { NoticeCategoryChip, NOTICE_CATEGORIES } from '@/components/cdm/NoticeCategoryChip';
import { getAuthState } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { NoticeCategory } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: '공지사항',
  description: '운영진의 공식 안내를 확인하세요.',
  robots: { index: true, follow: true },
};

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>;
}

interface ListRow {
  id: string;
  category: NoticeCategory;
  title: string;
  is_pinned: boolean;
  published_at: string;
  created_by: string | null;
}

interface NoticeReadRow {
  notice_id: string;
}

interface AuthorRow {
  id: string;
  nickname: string;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

function isCategory(v: string | undefined): v is NoticeCategory {
  return !!v && (NOTICE_CATEGORIES as string[]).includes(v);
}

function formatKstDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function NoticeListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = isCategory(sp.category) ? sp.category : undefined;
  const page = parsePageParam(sp.page);
  const { from, to } = getRange(page, PAGE_SIZE);

  const authState = await getAuthState();
  const member = authState.kind === 'ACTIVE' ? authState.member : null;

  const sb = await getServerSupabase();
  let q = sb
    .from('notices')
    .select('id, category, title, is_pinned, published_at, created_by', { count: 'exact' })
    .eq('is_published', true);
  if (category) q = q.eq('category', category);
  q = q
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .range(from, to);

  const res = await q;
  const rows = (res.data ?? []) as unknown as ListRow[];
  const totalCount = res.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  // 현재 페이지 공지 읽음 여부 조회 (로그인 사용자만)
  let readIds = new Set<string>();
  if (member && rows.length > 0) {
    const noticeIds = rows.map((r) => r.id);
    const { data: reads } = await sb
      .from('notice_reads')
      .select('notice_id')
      .eq('member_id', member.id)
      .in('notice_id', noticeIds);
    readIds = new Set((reads ?? []).map((r) => (r as unknown as NoticeReadRow).notice_id));
  }

  // 작성자 닉네임 조회
  const authorIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)),
  );
  const authorsRes = authorIds.length
    ? await sb.from('members').select('id, nickname').in('id', authorIds)
    : { data: [] };
  const authorMap = new Map(
    ((authorsRes.data ?? []) as unknown as AuthorRow[]).map((a) => [a.id, a.nickname]),
  );

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">📢 공지사항</h1>
          <p className="text-sm text-cdm-fg-muted">운영진의 공식 안내를 확인하세요.</p>
        </header>

        <CategoryFilter active={category} />

        {rows.length === 0 ? (
          <EmptyState
            title={category ? '해당 카테고리의 공지가 없어요' : '공지사항이 없어요'}
            description={
              category ? '다른 카테고리를 확인해보세요.' : '새로운 공지가 등록되면 여기에 표시됩니다.'
            }
            action={
              category ? (
                <Link
                  href="/notice"
                  className="text-sm font-semibold text-cdm-primary hover:text-cdm-primary-strong"
                >
                  전체 보기 →
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-cdm-fg-muted">
              총 {totalCount}건{totalPages > 1 && ` · ${page} / ${totalPages} 페이지`}
            </p>

            {/* 데스크탑 테이블식 행 + 모바일 카드 — 동일 마크업으로 처리 */}
            <ul className="flex flex-col gap-2">
              {rows.map((row) => {
                const authorName = row.created_by
                  ? (authorMap.get(row.created_by) ?? '운영진')
                  : '운영진';
                const isUnread = member ? !readIds.has(row.id) : false;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/notice/${row.id}`}
                      className="block focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)] rounded-cdm-lg"
                    >
                      <Card
                        variant="interactive"
                        className={cn(
                          'p-4!',
                          row.is_pinned && 'border-l-2 border-l-cdm-primary',
                        )}
                      >
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            {row.is_pinned && (
                              <span aria-label="상단 고정" title="상단 고정" className="text-cdm-primary">
                                📌
                              </span>
                            )}
                            <NoticeCategoryChip category={row.category} size="sm" />
                            {isUnread && (
                              <span className="rounded-full bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="flex-1 truncate text-[15px] font-semibold text-cdm-fg">
                            {row.title}
                          </p>
                          <div className="flex items-center gap-2 shrink-0 text-[11px] text-cdm-fg-subtle sm:text-xs">
                            <span>{authorName}</span>
                            <span>·</span>
                            <time dateTime={row.published_at} className="tabular-nums">
                              {formatKstDate(row.published_at)}
                            </time>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <RoutePagination totalPages={totalPages} />
          </div>
        )}
      </main>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// 카테고리 필터 — 가로 스크롤 칩 (모바일/데스크탑 동일)
// ──────────────────────────────────────────────────────────────────

function CategoryFilter({ active }: { active: NoticeCategory | undefined }) {
  return (
    <div
      role="tablist"
      aria-label="카테고리 필터"
      className="mb-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex gap-2 whitespace-nowrap">
        <FilterPill href="/notice" label="전체" active={active === undefined} />
        {NOTICE_CATEGORIES.map((cat) => (
          <FilterPill
            key={cat}
            href={`/notice?category=${cat}`}
            label={LABELS[cat]}
            active={active === cat}
          />
        ))}
      </div>
    </div>
  );
}

const LABELS: Record<NoticeCategory, string> = {
  general: '일반',
  maintenance: '점검',
  update: '업데이트',
  event: '이벤트',
  urgent: '긴급',
};

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors',
        active
          ? 'bg-cdm-primary text-white border-cdm-primary'
          : 'border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg',
      )}
    >
      {label}
    </Link>
  );
}
