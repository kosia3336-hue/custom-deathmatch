import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import AdminTabs from './AdminTabs';
import DashboardTab from './DashboardTab';
import MembersTab from './MembersTab';
import TitlesTab from './TitlesTab';
import ReportsTab from './ReportsTab';
import InquiriesTab from './InquiriesTab';
import AuditTab from './AuditTab';

export const metadata: Metadata = { title: '관리자', robots: { index: false } };

interface Props {
  searchParams: Promise<{ tab?: string; q?: string }>;
}

export default async function AdminPage({ searchParams }: Props) {
  const member = await getActiveMember();
  if (!member) redirect('/login');
  if (member.role !== 'admin') redirect('/');

  const sp = await searchParams;
  const tab = sp.tab ?? 'dashboard';

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-cdm-fg">관리자</h1>
        </header>

        <AdminTabs current={tab} />

        <section className="mt-4">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'members' && <MembersTab query={sp.q ?? ''} />}
          {tab === 'titles' && <TitlesTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'inquiries' && <InquiriesTab />}
          {tab === 'audit' && <AuditTab />}
        </section>
      </main>
    </>
  );
}
