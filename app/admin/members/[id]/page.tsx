import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { MemberStatusChip } from '@/components/cdm/StatusChip';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import MemberAdminActions from '@/app/admin/MemberAdminActions';
import MemberDetailClient from './MemberDetailClient';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type {
  MemberTitleData,
  TitleData,
  NicknameHistoryData,
  SanctionData,
  GameStatData,
  ReportData,
  InquiryData,
} from './types';
import type {
  MemberStatus,
  TitleColor,
  SanctionKind,
  ReportCategory,
  ReportStatus,
} from '@/lib/supabase/database.types';

export const metadata: Metadata = { title: '회원 상세', robots: { index: false } };

// ── raw row 타입 ──────────────────────────────
interface RawMember {
  id: string;
  nickname: string;
  created_at: string;
  withdrawn_at: string | null;
  displayed_title_id: string | null;
}
interface RawPriv {
  role: 'user' | 'admin';
  status: MemberStatus;
  last_login_at: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
  banned_reason: string | null;
}
interface RawMemberTitle {
  id: number;
  title_id: string;
  granted_at: string;
  granted_by: string | null;
  reason: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
}
interface RawSanction {
  id: number;
  kind: SanctionKind;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  issued_by: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}
interface RawGameStat {
  game_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  resigns: number;
  last_played_at: string | null;
}
interface RawReport {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  created_at: string;
  target_snapshot: unknown;
  reporter_snapshot: unknown;
}
interface RawTitle {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
}
interface RawGame {
  id: string;
  name: string;
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    nicknamePage?: string;
    sanctionsPage?: string;
    reportsReceivedPage?: string;
    reportsSentPage?: string;
    inquiriesPage?: string;
  }>;
}

const SECTION_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function MemberDetailPage({ params, searchParams }: Props) {
  const me = await getActiveMember();
  if (!me) redirect('/login');
  if (me.role !== 'admin') redirect('/lobby');

  const { id } = await params;
  const sp = await searchParams;
  const defaultTab = sp.tab;
  const sb = await getServerSupabase();

  // 각 섹션 페이지
  const nicknamePage = parsePageParam(sp.nicknamePage);
  const sanctionsPage = parsePageParam(sp.sanctionsPage);
  const reportsReceivedPage = parsePageParam(sp.reportsReceivedPage);
  const reportsSentPage = parsePageParam(sp.reportsSentPage);
  const inquiriesPage = parsePageParam(sp.inquiriesPage);

  const nicknameRange = getRange(nicknamePage, SECTION_PAGE_SIZE);
  const sanctionsRange = getRange(sanctionsPage, SECTION_PAGE_SIZE);
  const reportsReceivedRange = getRange(reportsReceivedPage, SECTION_PAGE_SIZE);
  const reportsSentRange = getRange(reportsSentPage, SECTION_PAGE_SIZE);
  const inquiriesRange = getRange(inquiriesPage, SECTION_PAGE_SIZE);

  // ─── Phase 1: 주요 데이터 병렬 패칭 ─────────────────────────────
  const [
    memberRes,
    privRes,
    memberTitlesRawRes,
    allActiveTitlesRes,
    nicknameHistoryRes,
    sanctionsRawRes,
    gameStatsRawRes,
    receivedReportsRawRes,
    sentReportsRawRes,
    inquiriesRes,
  ] = await Promise.all([
    sb
      .from('members')
      .select('id, nickname, created_at, withdrawn_at, displayed_title_id')
      .eq('id', id)
      .maybeSingle(),
    sb
      .from('members_private')
      .select('role, status, last_login_at, suspended_until, suspended_reason, banned_reason')
      .eq('member_id', id)
      .maybeSingle(),
    sb
      .from('member_titles')
      .select('id, title_id, granted_at, granted_by, reason, revoked_at, revoked_by, revoked_reason')
      .eq('member_id', id)
      .order('granted_at', { ascending: false }),
    sb.from('titles').select('id, name, color, description').eq('is_active', true).order('name'),
    sb
      .from('nickname_history')
      .select('id, old_nickname, new_nickname, changed_at', { count: 'exact' })
      .eq('member_id', id)
      .order('changed_at', { ascending: false })
      .range(nicknameRange.from, nicknameRange.to),
    sb
      .from('sanctions')
      .select(
        'id, kind, reason, starts_at, ends_at, issued_by, revoked_at, revoked_reason, created_at',
        { count: 'exact' },
      )
      .eq('member_id', id)
      .order('created_at', { ascending: false })
      .range(sanctionsRange.from, sanctionsRange.to),
    sb
      .from('member_game_stats')
      .select('game_id, total_games, wins, losses, draws, resigns, last_played_at')
      .eq('member_id', id),
    sb
      .from('reports')
      .select('id, category, status, created_at, reporter_snapshot', { count: 'exact' })
      .eq('target_id', id)
      .order('created_at', { ascending: false })
      .range(reportsReceivedRange.from, reportsReceivedRange.to),
    sb
      .from('reports')
      .select('id, category, status, created_at, target_snapshot', { count: 'exact' })
      .eq('reporter_id', id)
      .order('created_at', { ascending: false })
      .range(reportsSentRange.from, reportsSentRange.to),
    sb
      .from('inquiries')
      .select(
        'id, title, category, status, created_at, body, answer_body, answered_at',
        { count: 'exact' },
      )
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .range(inquiriesRange.from, inquiriesRange.to),
  ]);

  const nicknameTotal = nicknameHistoryRes.count ?? 0;
  const sanctionsTotal = sanctionsRawRes.count ?? 0;
  const receivedReportsTotal = receivedReportsRawRes.count ?? 0;
  const sentReportsTotal = sentReportsRawRes.count ?? 0;
  const inquiriesTotal = inquiriesRes.count ?? 0;

  if (!memberRes.data) notFound();

  const member = memberRes.data as unknown as RawMember;
  const priv = privRes.data as unknown as RawPriv | null;
  const memberTitlesRaw = (memberTitlesRawRes.data ?? []) as unknown as RawMemberTitle[];
  const sanctionsRaw = (sanctionsRawRes.data ?? []) as unknown as RawSanction[];
  const gameStatsRaw = (gameStatsRawRes.data ?? []) as unknown as RawGameStat[];

  // ─── Phase 2: 보조 ID 수집 ──────────────────────────────────────
  const titleIdsNeeded = [...new Set(memberTitlesRaw.map((t) => t.title_id))];
  const memberIdsNeeded = [
    ...new Set([
      ...(memberTitlesRaw.map((t) => t.granted_by).filter(Boolean) as string[]),
      ...(memberTitlesRaw.map((t) => t.revoked_by).filter(Boolean) as string[]),
      ...(sanctionsRaw.map((s) => s.issued_by)),
    ]),
  ];
  const gameIdsNeeded = gameStatsRaw.map((g) => g.game_id);

  // ─── Phase 2: 보조 조회 ──────────────────────────────────────────
  const [titleInfoRes, memberNamesRes, gameNamesRes] = await Promise.all([
    titleIdsNeeded.length
      ? sb.from('titles').select('id, name, color, description').in('id', titleIdsNeeded)
      : { data: [] as RawTitle[] },
    memberIdsNeeded.length
      ? sb.from('members').select('id, nickname').in('id', memberIdsNeeded)
      : { data: [] as { id: string; nickname: string }[] },
    gameIdsNeeded.length
      ? sb.from('games').select('id, name').in('id', gameIdsNeeded)
      : { data: [] as RawGame[] },
  ]);

  // ─── 맵 빌드 ────────────────────────────────────────────────────
  const titleMap = new Map<string, RawTitle>(
    (titleInfoRes.data as unknown as RawTitle[] ?? []).map((t) => [t.id, t]),
  );
  const nameMap = new Map<string, string>(
    (memberNamesRes.data as unknown as { id: string; nickname: string }[] ?? []).map((m) => [
      m.id,
      m.nickname,
    ]),
  );
  const gameNameMap = new Map<string, string>(
    (gameNamesRes.data as unknown as RawGame[] ?? []).map((g) => [g.id, g.name]),
  );

  // ─── 표시 칭호 ────────────────────────────────────────────────
  let displayedTitle: TitleData | null = null;
  if (member.displayed_title_id) {
    displayedTitle = (titleMap.get(member.displayed_title_id) as TitleData | undefined) ?? null;
    if (!displayedTitle) {
      const r = await sb
        .from('titles')
        .select('id, name, color, description')
        .eq('id', member.displayed_title_id)
        .maybeSingle();
      displayedTitle = r.data as unknown as TitleData | null;
    }
  }

  // ─── 최종 데이터 조립 ─────────────────────────────────────────
  const memberTitles: MemberTitleData[] = memberTitlesRaw.map((t) => ({
    ...t,
    title: titleMap.get(t.title_id) ?? ({ id: t.title_id, name: '?', color: 'slate' as TitleColor, description: null }),
    granter_nickname: t.granted_by ? (nameMap.get(t.granted_by) ?? null) : null,
    revoker_nickname: t.revoked_by ? (nameMap.get(t.revoked_by) ?? null) : null,
  }));

  const allActiveTitles = (allActiveTitlesRes.data ?? []) as unknown as TitleData[];

  const nicknameHistory = (nicknameHistoryRes.data ?? []) as unknown as NicknameHistoryData[];

  const sanctions: SanctionData[] = sanctionsRaw.map((s) => ({
    ...s,
    issuer_nickname: nameMap.get(s.issued_by) ?? null,
  }));

  const gameStats: GameStatData[] = gameStatsRaw.map((g) => ({
    ...g,
    game_name: gameNameMap.get(g.game_id) ?? g.game_id,
  }));

  const receivedReports: ReportData[] = (
    receivedReportsRawRes.data as unknown as RawReport[] ?? []
  ).map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    created_at: r.created_at,
    other_nickname: (r.reporter_snapshot as Record<string, string>)?.nickname ?? '알 수 없음',
  }));

  const sentReports: ReportData[] = (
    sentReportsRawRes.data as unknown as RawReport[] ?? []
  ).map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    created_at: r.created_at,
    other_nickname: (r.target_snapshot as Record<string, string>)?.nickname ?? '알 수 없음',
  }));

  const inquiries = (inquiriesRes.data ?? []) as unknown as InquiryData[];

  const isWithdrawn = !!member.withdrawn_at;
  const status: MemberStatus = isWithdrawn ? 'withdrawn' : (priv?.status ?? 'active');

  return (
    <>
      <GNB member={me} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* 뒤로가기 */}
        <Link
          href="/admin?tab=members"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-cdm-fg-muted hover:text-cdm-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          회원 목록
        </Link>

        {/* 헤더 카드 */}
        <div className="mb-4 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-4 sm:p-5">
          {isWithdrawn && (
            <div className="mb-3 rounded-cdm-md bg-cdm-bg-elev-2 px-3 py-2 text-xs text-cdm-fg-muted">
              탈퇴 회원
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              {/* 닉네임 + 칭호 + 상태 */}
              <div className="flex flex-wrap items-center gap-2">
                {displayedTitle && (
                  <TitleBadge
                    name={displayedTitle.name}
                    color={displayedTitle.color}
                    size="md"
                  />
                )}
                <h1 className="text-xl font-bold text-cdm-fg">{member.nickname}</h1>
                <MemberStatusChip status={status} />
                {priv?.role === 'admin' && (
                  <span className="rounded-cdm-sm bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                    ADMIN
                  </span>
                )}
              </div>

              {/* 메타 정보 */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-cdm-fg-muted">
                <span>가입 {new Date(member.created_at).toLocaleDateString('ko-KR')}</span>
                {priv?.last_login_at && (
                  <span>
                    최근 로그인 {new Date(priv.last_login_at).toLocaleString('ko-KR')}
                  </span>
                )}
                {priv?.status === 'suspended' && priv.suspended_until && (
                  <span className="text-cdm-highlight">
                    정지 종료 {new Date(priv.suspended_until).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          {(isWithdrawn || priv) && (
            <div className="mt-3 border-t border-cdm-border pt-3">
              <MemberAdminActions
                memberId={member.id}
                nickname={member.nickname}
                currentStatus={priv?.status ?? 'active'}
                currentRole={priv?.role ?? 'user'}
                isWithdrawn={isWithdrawn}
              />
            </div>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        <MemberDetailClient
          memberId={member.id}
          nickname={member.nickname}
          isWithdrawn={isWithdrawn}
          memberTitles={memberTitles}
          allActiveTitles={allActiveTitles}
          nicknameHistory={nicknameHistory}
          nicknamePage={nicknamePage}
          nicknameTotalPages={getTotalPages(nicknameTotal, SECTION_PAGE_SIZE)}
          nicknameTotalCount={nicknameTotal}
          sanctions={sanctions}
          sanctionsPage={sanctionsPage}
          sanctionsTotalPages={getTotalPages(sanctionsTotal, SECTION_PAGE_SIZE)}
          sanctionsTotalCount={sanctionsTotal}
          gameStats={gameStats}
          receivedReports={receivedReports}
          receivedReportsPage={reportsReceivedPage}
          receivedReportsTotalPages={getTotalPages(receivedReportsTotal, SECTION_PAGE_SIZE)}
          receivedReportsTotalCount={receivedReportsTotal}
          sentReports={sentReports}
          sentReportsPage={reportsSentPage}
          sentReportsTotalPages={getTotalPages(sentReportsTotal, SECTION_PAGE_SIZE)}
          sentReportsTotalCount={sentReportsTotal}
          inquiries={inquiries}
          inquiriesPage={inquiriesPage}
          inquiriesTotalPages={getTotalPages(inquiriesTotal, SECTION_PAGE_SIZE)}
          inquiriesTotalCount={inquiriesTotal}
          defaultTab={defaultTab}
        />
      </main>
    </>
  );
}
