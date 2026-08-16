import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { Card } from '@/components/cdm/Card';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import MyPageTabs from './MyPageTabs';
import OverviewTab from './OverviewTab';
import SettingsTab from './SettingsTab';
import LogsTab from './LogsTab';
import StatsTab from './StatsTab';
import TitlesTab from './TitlesTab';
import SkinsTab from './SkinsTab';
import SupportTab from './SupportTab';
import ShopTab from './ShopTab';
import RankTab from './RankTab';

export const metadata: Metadata = { title: '마이페이지' };

interface Props {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    rankSeason?: string;
    inquiriesPage?: string;
    reportsPage?: string;
    titleSub?: string;
  }>;
}

export default async function MyPage({ searchParams }: Props) {
  const member = await getActiveMember();
  if (!member) redirect('/login');

  const sp = await searchParams;
  const tab = sp.tab ?? 'overview';

  const accountAge = describeAccountAge(member.createdAt);

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        {/* 헤더 (Avatar 없음) */}
        <Card>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {member.displayedTitle && (
                <TitleBadge
                  name={member.displayedTitle.name}
                  color={member.displayedTitle.color}
                  effect={member.displayedTitle.effect as TitleEffect | null}
                  size="md"
                />
              )}
              <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">{member.nickname}</h1>
            </div>
            <p className="text-sm text-cdm-fg-muted">{accountAge}</p>
          </div>
        </Card>

        <Link
          href="/attendance"
          className="flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-4 py-3 transition-colors hover:bg-cdm-bg-elev-2"
        >
          <span className="text-sm font-semibold text-cdm-fg">출석판 — 매일 출석하고 보상 받기</span>
          <span aria-hidden className="text-cdm-fg-muted">›</span>
        </Link>

        <MyPageTabs current={tab} />

        <section>
          {tab === 'overview' && <OverviewTab member={member} />}
          {tab === 'logs' && <LogsTab memberId={member.id} page={sp.page} />}
          {tab === 'stats' && <StatsTab memberId={member.id} />}
          {tab === 'rank' && <RankTab memberId={member.id} seasonId={sp.rankSeason} />}
          {tab === 'titles' && (
            <TitlesTab
              memberId={member.id}
              displayedTitleId={member.displayedTitle?.id ?? null}
              displayedEffectId={member.displayedEffectId}
              titleSub={sp.titleSub}
            />
          )}
          {tab === 'skins' && <SkinsTab memberId={member.id} />}
          {tab === 'shop' && <ShopTab memberId={member.id} />}
          {tab === 'support' && (
            <SupportTab
              memberId={member.id}
              inquiriesPage={sp.inquiriesPage}
              reportsPage={sp.reportsPage}
            />
          )}
          {tab === 'settings' && <SettingsTab />}
        </section>
      </main>
    </>
  );
}

function describeAccountAge(iso: string): string {
  const created = new Date(iso);
  const date = created.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  });
  return `가입: ${date}`;
}
