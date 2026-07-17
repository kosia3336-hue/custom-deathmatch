import type { Metadata } from 'next';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import AdminTabs from './AdminTabs';
import DashboardTab from './DashboardTab';
import MembersTab from './MembersTab';
import TitlesTab from './TitlesTab';
import ReportsTab from './ReportsTab';
import InquiriesTab from './InquiriesTab';
import NoticesTab from './NoticesTab';
import AdminRankTab from './AdminRankTab';
import GameStatsTab from './GameStatsTab';
import GameRulesTab from './GameRulesTab';
import AuditTab from './AuditTab';
import AdminShopTab from './AdminShopTab';
import EventCouponsTab from './EventCouponsTab';

export const metadata: Metadata = { title: '관리자', robots: { index: false } };

interface Props {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    sort?: string;
    actionKind?: string;
    actor?: string;
    shopSubTab?: string;
    shopLogsPage?: string;
    inquiryStatus?: string;
  }>;
}

export default async function AdminPage({ searchParams }: Props) {
  const member = await getActiveMember();
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
          {tab === 'members' && <MembersTab query={sp.q ?? ''} page={sp.page} sort={sp.sort} />}
          {tab === 'titles' && <TitlesTab page={sp.page} />}
          {tab === 'rank' && <AdminRankTab />}
          {tab === 'shop' && <AdminShopTab subTab={sp.shopSubTab} shopLogsPage={sp.shopLogsPage} />}
          {tab === 'game-stats' && <GameStatsTab />}
          {tab === 'game-rules' && <GameRulesTab />}
          {tab === 'reports' && <ReportsTab page={sp.page} />}
          {tab === 'inquiries' && <InquiriesTab page={sp.page} statusFilter={sp.inquiryStatus} />}
          {tab === 'notices' && <NoticesTab page={sp.page} />}
          {tab === 'event-coupons' && <EventCouponsTab />}
          {tab === 'audit' && (
            <AuditTab page={sp.page} actionKind={sp.actionKind} actor={sp.actor} />
          )}
        </section>
      </main>
    </>
  );
}
