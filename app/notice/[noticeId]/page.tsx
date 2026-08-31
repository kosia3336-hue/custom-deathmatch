import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { NoticeCategoryChip, getNoticeCategoryLabel } from '@/components/cdm/NoticeCategoryChip';
import { getAuthState } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { MarkdownView, extractPlainText } from '@/lib/markdown';
import { NoticeReadTracker } from '@/components/notice/NoticeReadTracker';
import type { NoticeCategory } from '@/lib/supabase/database.types';

interface Props {
  params: Promise<{ noticeId: string }>;
}

interface NoticeDetail {
  id: string;
  category: NoticeCategory;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
  updated_at: string;
  created_at: string;
  created_by: string | null;
}

interface SiblingRow {
  id: string;
  title: string;
  is_pinned: boolean;
  published_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadNotice(noticeId: string): Promise<NoticeDetail | null> {
  if (!UUID_RE.test(noticeId)) return null;
  const sb = await getServerSupabase();
  const res = await sb
    .from('notices')
    .select('id, category, title, body, is_pinned, published_at, updated_at, created_at, created_by')
    .eq('id', noticeId)
    .eq('is_published', true)
    .maybeSingle();
  return (res.data as unknown as NoticeDetail | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { noticeId } = await params;
  const notice = await loadNotice(noticeId);
  if (!notice) return { title: '공지사항' };
  const description = extractPlainText(notice.body, 150);
  return {
    title: notice.title,
    description: description || '운영진의 공식 안내',
    alternates: { canonical: `/notice/${notice.id}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${notice.title} — 공지사항`,
      description: description || undefined,
      type: 'article',
    },
  };
}

export default async function NoticeDetailPage({ params }: Props) {
  const { noticeId } = await params;
  const notice = await loadNotice(noticeId);
  if (!notice) notFound();

  const authState = await getAuthState();
  const member = authState.kind === 'ACTIVE' ? authState.member : null;

  const sb = await getServerSupabase();

  const authorName = notice.created_by
    ? await sb
        .from('members')
        .select('nickname')
        .eq('id', notice.created_by)
        .maybeSingle()
        .then((r) => (r.data as unknown as { nickname: string } | null)?.nickname ?? '운영진')
    : '운영진';

  // 이전/다음 공지 — 핀/published_at 정렬 기준에서 인접 행
  // 단순화: 같은 published_at 으로 인접 행만. 핀은 정렬 키지만 이전/다음에서는
  // 사용자가 자연스럽게 이동할 수 있도록 published_at 기준으로 결정.
  const [prevRes, nextRes] = await Promise.all([
    sb
      .from('notices')
      .select('id, title, is_pinned, published_at')
      .eq('is_published', true)
      .lt('published_at', notice.published_at)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('notices')
      .select('id, title, is_pinned, published_at')
      .eq('is_published', true)
      .gt('published_at', notice.published_at)
      .order('published_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const prev = (prevRes.data as unknown as SiblingRow | null) ?? null;
  const next = (nextRes.data as unknown as SiblingRow | null) ?? null;

  const publishedAt = formatKstDateTime(notice.published_at);
  const updated =
    notice.updated_at && notice.updated_at !== notice.created_at
      ? formatKstDateTime(notice.updated_at)
      : null;

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/notice"
          className="mb-4 inline-flex items-center gap-1 text-sm text-cdm-fg-muted hover:text-cdm-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          공지사항으로
        </Link>

        <article>
          <NoticeReadTracker noticeId={notice.id} enabled={!!member} />
          <header className="border-b border-cdm-border pb-4">
            <div className="mb-2 flex items-center gap-2">
              <NoticeCategoryChip category={notice.category} size="md" />
              {notice.is_pinned && (
                <span aria-label="상단 고정" title="상단 고정" className="text-cdm-primary">
                  📌
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-cdm-fg sm:text-2xl">
              <span className="sr-only">[{getNoticeCategoryLabel(notice.category)}]</span>
              {notice.title}
            </h1>
            <p className="mt-2 text-xs text-cdm-fg-muted">
              {authorName} · <time dateTime={notice.published_at}>{publishedAt}</time>
              {updated && (
                <span className="ml-2 text-cdm-fg-subtle">
                  (수정 <time dateTime={notice.updated_at}>{updated}</time>)
                </span>
              )}
            </p>
          </header>

          <div className="py-4 sm:py-6">
            <MarkdownView source={notice.body} />
          </div>
        </article>

        {(prev || next) && (
          <nav
            aria-label="공지 이동"
            className="mt-6 flex flex-col gap-2 border-t border-cdm-border pt-4 sm:flex-row sm:gap-3"
          >
            <SiblingLink direction="prev" notice={prev} />
            <SiblingLink direction="next" notice={next} />
          </nav>
        )}
      </main>
    </>
  );
}

function formatKstDateTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${M}-${D} ${h}:${m}`;
}

function SiblingLink({
  direction,
  notice,
}: {
  direction: 'prev' | 'next';
  notice: SiblingRow | null;
}) {
  const label = direction === 'prev' ? '이전 공지' : '다음 공지';
  if (!notice) {
    return (
      <span className="flex-1 inline-flex items-center justify-center rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2.5 text-sm text-cdm-fg-subtle">
        {direction === 'prev' ? '←' : '→'} {label} 없음
      </span>
    );
  }
  return (
    <Link
      href={`/notice/${notice.id}`}
      className="flex-1 inline-flex items-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2.5 text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
    >
      <span className="text-cdm-fg-muted shrink-0">
        {direction === 'prev' ? '←' : '→'} {label}
      </span>
      <span className="truncate text-cdm-fg-muted">·</span>
      <span className="truncate font-medium">{notice.title}</span>
    </Link>
  );
}
