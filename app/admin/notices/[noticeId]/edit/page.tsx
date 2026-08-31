import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { Card } from '@/components/cdm/Card';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import NoticeForm from '@/app/admin/NoticeForm';
import type { NoticeCategory } from '@/lib/supabase/database.types';

export const metadata: Metadata = { title: '공지 편집', robots: { index: false } };

interface Props {
  params: Promise<{ noticeId: string }>;
}

interface NoticeRow {
  id: string;
  category: NoticeCategory;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditNoticePage({ params }: Props) {
  const { noticeId } = await params;

  const member = await getActiveMember();
  if (!member) redirect('/login');
  if (member.role !== 'admin') redirect('/lobby');

  if (!UUID_RE.test(noticeId)) notFound();

  const sb = await getServerSupabase();
  const res = await sb
    .from('notices')
    .select('id, category, title, body, is_pinned, is_published')
    .eq('id', noticeId)
    .maybeSingle();

  const notice = (res.data as unknown as NoticeRow | null) ?? null;
  if (!notice) notFound();

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4">
          <Link
            href="/admin?tab=notices"
            className="inline-flex items-center gap-1 text-sm text-cdm-fg-muted hover:text-cdm-fg"
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
            공지 목록
          </Link>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-bold text-cdm-fg">공지 편집</h1>
          <p className="mt-1 text-sm text-cdm-fg-muted truncate">{notice.title}</p>
        </header>

        <Card>
          <NoticeForm
            mode="edit"
            initial={{
              id: notice.id,
              title: notice.title,
              body: notice.body,
              category: notice.category,
              isPinned: notice.is_pinned,
              isPublished: notice.is_published,
            }}
            afterSaveHref="/admin?tab=notices"
          />
        </Card>
      </main>
    </>
  );
}
