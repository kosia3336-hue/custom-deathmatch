import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { Card } from '@/components/cdm/Card';
import { getActiveMember } from '@/lib/auth/server';
import NoticeForm from '@/app/admin/NoticeForm';

export const metadata: Metadata = { title: '공지 작성', robots: { index: false } };

export default async function NewNoticePage() {
  const member = await getActiveMember();
  if (!member) redirect('/login');
  if (member.role !== 'admin') redirect('/');

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
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            공지 목록
          </Link>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-bold text-cdm-fg">새 공지 작성</h1>
        </header>

        <Card>
          <NoticeForm mode="create" afterSaveHref="/admin?tab=notices" />
        </Card>
      </main>
    </>
  );
}
