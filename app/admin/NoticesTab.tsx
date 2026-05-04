import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { EmptyState } from '@/components/cdm/EmptyState';
import { RoutePagination } from '@/components/cdm/Pagination';
import { NoticeCategoryChip } from '@/components/cdm/NoticeCategoryChip';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { NoticeCategory, TitleColor } from '@/lib/supabase/database.types';
import NoticeRowActions from './NoticeRowActions';

interface Row {
  id: string;
  category: NoticeCategory;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string;
  updated_at: string;
  created_at: string;
  created_by: string | null;
}

interface AuthorRow {
  id: string;
  nickname: string;
  displayed_title_id: string | null;
}

interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function NoticesTab({ page: pageParam }: { page: string | undefined }) {
  const sb = await getServerSupabase();
  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);

  const res = await sb
    .from('notices')
    .select(
      'id, category, title, body, is_pinned, is_published, published_at, updated_at, created_at, created_by',
      { count: 'exact' },
    )
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .range(from, to);
  const rows = (res.data ?? []) as unknown as Row[];
  const totalCount = res.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  // 작성자 정보 동시 로드
  const authorIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)),
  );
  const authorsRes = authorIds.length
    ? await sb
        .from('members')
        .select('id, nickname, displayed_title_id')
        .in('id', authorIds)
    : { data: [] };
  const authors = (authorsRes.data ?? []) as unknown as AuthorRow[];

  const titleIds = authors
    .map((a) => a.displayed_title_id)
    .filter((v): v is string => !!v);
  const titlesRes = titleIds.length
    ? await sb.from('titles').select('id, name, color').in('id', titleIds)
    : { data: [] };
  const titles = (titlesRes.data ?? []) as unknown as TitleRow[];

  const authorOf = (id: string | null) =>
    id ? authors.find((a) => a.id === id) ?? null : null;
  const titleOf = (titleId: string | null | undefined) =>
    titleId ? titles.find((t) => t.id === titleId) ?? null : null;

  const pinnedCount = rows.filter((r) => r.is_pinned && r.is_published).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href="/admin/notices/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-cdm-md bg-cdm-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-cdm-primary-strong"
        >
          + 새 공지 작성
        </Link>
      </div>

      {totalCount === 0 ? (
        <EmptyState title="등록된 공지가 없어요" description="위 버튼으로 첫 공지를 작성하세요." />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-cdm-fg-muted">
            총 {totalCount}건{totalPages > 1 && ` · ${page} / ${totalPages} 페이지`} · 핀{' '}
            {pinnedCount}건
          </p>

          {rows.map((row) => {
            const author = authorOf(row.created_by);
            const title = titleOf(author?.displayed_title_id ?? null);
            return (
              <Card key={row.id} className="p-3!">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.is_pinned && (
                      <span aria-label="상단 고정" title="상단 고정" className="text-cdm-primary">
                        📌
                      </span>
                    )}
                    <NoticeCategoryChip category={row.category} size="sm" />
                    {!row.is_published && (
                      <span className="inline-flex items-center rounded-full bg-cdm-bg-elev-2 px-2 py-[3px] text-[11px] font-semibold text-cdm-fg-muted">
                        비공개
                      </span>
                    )}
                    <p className="flex-1 truncate text-sm font-semibold text-cdm-fg">
                      {row.title}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-cdm-fg-subtle">
                    <span className="inline-flex items-center gap-1">
                      {title && <TitleBadge name={title.name} color={title.color} size="sm" />}
                      <span className="font-medium text-cdm-fg-muted">
                        {author?.nickname ?? '(탈퇴)'}
                      </span>
                    </span>
                    <span>·</span>
                    <time dateTime={row.published_at}>
                      게시 {new Date(row.published_at).toLocaleString('ko-KR')}
                    </time>
                    {row.updated_at !== row.created_at && (
                      <>
                        <span>·</span>
                        <time dateTime={row.updated_at}>
                          수정 {new Date(row.updated_at).toLocaleString('ko-KR')}
                        </time>
                      </>
                    )}
                  </div>

                  <NoticeRowActions
                    notice={{
                      id: row.id,
                      category: row.category,
                      title: row.title,
                      body: row.body,
                      isPinned: row.is_pinned,
                      isPublished: row.is_published,
                    }}
                    pinnedCount={pinnedCount}
                  />
                </div>
              </Card>
            );
          })}

          <RoutePagination totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
