import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { Card } from '@/components/cdm/Card';
import { GNB } from '@/components/cdm/GNB';
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
  is_active: boolean;
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

export default async function TitleOwnersPage({
  params,
}: {
  params: Promise<{ titleId: string }>;
}) {
  const { titleId } = await params;

  const me = await getActiveMember();
  if (!me || me.role !== 'admin') redirect('/');

  const sb = await getServerSupabase();

  const { data: titleData } = await sb
    .from('titles')
    .select('id, name, color, description, is_active')
    .eq('id', titleId)
    .maybeSingle();

  if (!titleData) notFound();
  const title = titleData as unknown as TitleRow;

  const { data: ownersData } = await sb
    .from('member_titles')
    .select('id, member_id, granted_at, granted_by, reason')
    .eq('title_id', titleId)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });

  const owners = (ownersData ?? []) as unknown as OwnerRow[];

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
              <TitleBadge name={title.name} color={title.color} size="lg" />
              {!title.is_active && (
                <span className="text-xs text-cdm-fg-subtle">비활성</span>
              )}
              <span className="text-sm text-cdm-fg-muted">보유자 {owners.length}명</span>
            </div>
            <div className="flex items-center gap-2">
              <TitleGrantButton
                titleId={title.id}
                titleName={title.name}
                titleColor={title.color}
                titleDescription={title.description}
                activeOwnerIds={owners.map((o) => o.member_id)}
              />
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
                activeOwnerCount={owners.length}
              />
            </div>
          </div>
          {title.description && (
            <p className="mt-2 text-sm text-cdm-fg-muted">{title.description}</p>
          )}
        </div>

        {/* 보유자 목록 */}
        {owners.length === 0 ? (
          <p className="text-sm text-cdm-fg-subtle">현재 이 칭호를 보유한 회원이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
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
          </div>
        )}
      </main>
    </div>
  );
}
