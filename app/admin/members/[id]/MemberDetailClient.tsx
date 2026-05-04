'use client';

import { useState } from 'react';
import { Tabs } from '@/components/cdm/Tabs';
import TitlesSection from './TitlesSection';
import LogSection from './LogSection';
import GamesSection from './GamesSection';
import ReportsSection from './ReportsSection';
import type {
  MemberTitleData,
  TitleData,
  NicknameHistoryData,
  SanctionData,
  GameStatData,
  ReportData,
  InquiryData,
} from './types';

const TABS = [
  { id: 'titles', label: '칭호' },
  { id: 'log', label: '이력' },
  { id: 'games', label: '게임' },
  { id: 'reports', label: '신고/문의' },
];

const VALID_TABS = new Set(TABS.map((t) => t.id));

interface Props {
  memberId: string;
  nickname: string;
  isWithdrawn: boolean;
  memberTitles: MemberTitleData[];
  allActiveTitles: TitleData[];
  nicknameHistory: NicknameHistoryData[];
  nicknamePage: number;
  nicknameTotalPages: number;
  nicknameTotalCount: number;
  sanctions: SanctionData[];
  sanctionsPage: number;
  sanctionsTotalPages: number;
  sanctionsTotalCount: number;
  gameStats: GameStatData[];
  receivedReports: ReportData[];
  receivedReportsPage: number;
  receivedReportsTotalPages: number;
  receivedReportsTotalCount: number;
  sentReports: ReportData[];
  sentReportsPage: number;
  sentReportsTotalPages: number;
  sentReportsTotalCount: number;
  inquiries: InquiryData[];
  inquiriesPage: number;
  inquiriesTotalPages: number;
  inquiriesTotalCount: number;
  defaultTab?: string;
}

export default function MemberDetailClient({
  memberId,
  nickname,
  isWithdrawn,
  memberTitles,
  allActiveTitles,
  nicknameHistory,
  nicknamePage,
  nicknameTotalPages,
  nicknameTotalCount,
  sanctions,
  sanctionsPage,
  sanctionsTotalPages,
  sanctionsTotalCount,
  gameStats,
  receivedReports,
  receivedReportsPage,
  receivedReportsTotalPages,
  receivedReportsTotalCount,
  sentReports,
  sentReportsPage,
  sentReportsTotalPages,
  sentReportsTotalCount,
  inquiries,
  inquiriesPage,
  inquiriesTotalPages,
  inquiriesTotalCount,
  defaultTab,
}: Props) {
  const [tab, setTab] = useState(() =>
    defaultTab && VALID_TABS.has(defaultTab) ? defaultTab : 'titles',
  );

  return (
    <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1">
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="p-4 sm:p-5">
        {tab === 'titles' && (
          <TitlesSection
            memberId={memberId}
            nickname={nickname}
            memberTitles={memberTitles}
            allActiveTitles={allActiveTitles}
            isWithdrawn={isWithdrawn}
          />
        )}
        {tab === 'log' && (
          <LogSection
            nicknameHistory={nicknameHistory}
            nicknamePage={nicknamePage}
            nicknameTotalPages={nicknameTotalPages}
            nicknameTotalCount={nicknameTotalCount}
            sanctions={sanctions}
            sanctionsPage={sanctionsPage}
            sanctionsTotalPages={sanctionsTotalPages}
            sanctionsTotalCount={sanctionsTotalCount}
          />
        )}
        {tab === 'games' && <GamesSection memberId={memberId} gameStats={gameStats} />}
        {tab === 'reports' && (
          <ReportsSection
            receivedReports={receivedReports}
            receivedReportsPage={receivedReportsPage}
            receivedReportsTotalPages={receivedReportsTotalPages}
            receivedReportsTotalCount={receivedReportsTotalCount}
            sentReports={sentReports}
            sentReportsPage={sentReportsPage}
            sentReportsTotalPages={sentReportsTotalPages}
            sentReportsTotalCount={sentReportsTotalCount}
            inquiries={inquiries}
            inquiriesPage={inquiriesPage}
            inquiriesTotalPages={inquiriesTotalPages}
            inquiriesTotalCount={inquiriesTotalCount}
          />
        )}
      </div>
    </div>
  );
}
