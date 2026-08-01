import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { Card } from '@/components/cdm/Card';
import { GNB } from '@/components/cdm/GNB';
import { RoutePagination } from '@/components/cdm/Pagination';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { TitleColor } from '@/lib/supabase/database.types';
import TitleOwnerActions from './TitleOwnerActions';
import TitleDeleteButton from './TitleDeleteButton';
import TitleGrantButton from './TitleGrantButton';
import TitleEditButton from './TitleEditButton';

export const metadata: Metadata = { title: '칭호 보유자', robots: { index: false } };

interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  condition_text: string | null;
  is_system: boolean;
  is_active: boolean;
  effect: string | null;
}

interface OwnerRow {
  id: number;
  member_id: string;
  granted_at: string;
  granted_by: string | null;
  reason: string | null;
}

interface MemberRow {
  id: string;
  nickname: string;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function TitleOwnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ titleId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { titleId } = await params;
  const { page: pageParam } = await searchParams;

  const me = await getActiveMember();
  if (!me || me.role !== 'admin') redirect('/');

  const sb = await getServerSupabase();

  const { data: titleData } = await sb
    .from('titles')
    .select('id, name, color, description, condition_text, is_system, is_active, effect')
    .eq('id', titleId)
    .maybeSingle();

  if (!titleData) notFound();
  const title = titleData as unknown as TitleRow;

  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);

  const ownersRes = await sb
    .from('member_titles')
    .select('id, member_id, granted_at, granted_by, reason', { count: 'exact' })
    .eq('title_id', titleId)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false })
    .range(from, to);

  const owners = (ownersRes.data ?? []) as unknown as OwnerRow[];
  const totalOwners = ownersRes.count ?? 0;
  const totalPages = getTotalPages(totalOwners, PAGE_SIZE);

  const memberIds = owners.map((o) => o.member_id);
  const granterIds = owners.map((o) => o.granted_by).filter(Boolean) as string[];
  const allIds = [...new Set([...memberIds, ...granterIds])];

  let nameMap = new Map<string, string>();
  if (allIds.length > 0) {
    const { data: membersData } = await sb
      .from('members')
      .select('id, nickname')
      .in('id', allIds);
    nameMap = new Map(
      ((membersData ?? []) as unknown as MemberRow[]).map((m) => [m.id, m.nickname]),
    );
  }

  // 부여/압수 모달에 넘길 "이미 보유한 회원 ID" — 전체 보유자 ID 가 필요하므로 별도 조회.
  // 보유자 수가 매우 많을 경우 별도 RPC 필요할 수 있으나, 통상적인 운영 규모에선 충분.
  let activeOwnerIds: string[] = owners.map((o) => o.member_id);
  if (totalOwners > owners.length) {
    const allOwnersRes = await sb
      .from('member_titles')
      .select('member_id')
      .eq('title_id', titleId)
      .is('revoked_at', null);
    activeOwnerIds = ((allOwnersRes.data ?? []) as { member_id: string }[]).map(
      (r) => r.member_id,
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <GNB member={me} />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 flex flex-col gap-6">
        {/* 헤더 */}
        <div>
          <Link
            href="/admin?tab=titles"
            className="text-xs text-cdm-fg-muted hover:text-cdm-fg mb-3 inline-block"
          >
            ← 칭호 목록
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <TitleBadge name={title.name} color={title.color} effect={title.effect as 'legend' | null} size="lg" />
              {title.is_system && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-cdm-border px-2 py-px text-[11px] font-semibold text-cdm-fg-muted"
                  title="히든 시스템 칭호 — 조건은 서버 코드에서 관리"
                >
                  시스템
                </span>
              )}
              {!title.is_active && (
                <span className="text-xs text-cdm-fg-subtle">비활성</span>
              )}
              <span className="text-sm text-cdm-fg-muted">보유자 {totalOwners}명</span>
            </div>
            <div className="flex items-center gap-2">
              <TitleGrantButton
                titleId={title.id}
                titleName={title.name}
                titleColor={title.color}
                titleDescription={title.description}
                titleEffect={title.effect}
                activeOwnerIds={activeOwnerIds}
              />
              {!title.is_system && (
                <>
                  <TitleEditButton
                    titleId={title.id}
                    initialName={title.name}
                    initialColor={title.color}
                    initialDescription={title.description}
                    initialIsActive={title.is_active}
                  />
                  <TitleDeleteButton
                    titleId={title.id}
                    titleName={title.name}
                    activeOwnerCount={totalOwners}
                  />
                </>
              )}
            </div>
          </div>
          {title.description && (
            <p className="mt-2 text-sm text-cdm-fg-muted">{title.description}</p>
          )}
          {title.condition_text && (!title.is_system || totalOwners > 0) && (
            <p className="mt-1 text-xs text-cdm-fg-subtle">
              달성 조건(공개): {title.condition_text}
            </p>
          )}
          {title.is_system && (
            <p className="mt-1 text-xs text-cdm-fg-subtle">
              이 칭호는 시스템이 자동으로 부여한 히든 칭호입니다. 구체적인 달성 조건은 서버 코드에서만 관리되며,
              이 페이지에서는 편집/삭제할 수 없습니다.
            </p>
          )}
        </div>

        {/* 보유자 목록 */}
        {totalOwners === 0 ? (
          <p className="text-sm text-cdm-fg-subtle">현재 이 칭호를 보유한 회원이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-cdm-fg-muted">
              {page} / {totalPages} 페이지
            </p>
            {owners.map((o) => {
              const memberNickname = nameMap.get(o.member_id) ?? o.member_id;
              const granterNickname = o.granted_by ? (nameMap.get(o.granted_by) ?? o.granted_by) : null;
              return (
                <Card key={o.id} className="!p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <Link
                        href={`/admin/members/${o.member_id}`}
                        className="text-sm font-medium text-cdm-fg hover:text-cdm-primary"
                      >
                        {memberNickname}
                      </Link>
                      <p className="text-xs text-cdm-fg-muted mt-0.5">
                        부여 {new Date(o.granted_at).toLocaleDateString('ko-KR')}
                        {granterNickname && ` · by ${granterNickname}`}
                        {o.reason && ` · "${o.reason}"`}
                      </p>
                    </div>
                    <TitleOwnerActions
                      memberId={o.member_id}
                      memberNickname={memberNickname}
                      titleId={title.id}
                      titleName={title.name}
                      titleColor={title.color}
                    />
                  </div>
                </Card>
              );
            })}
            <RoutePagination totalPages={totalPages} />
          </div>
        )}
      </main>
    </div>
  );
}
