import { Card } from '@/components/cdm/Card';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import type { TitleColor } from '@/lib/supabase/database.types';
import TitleActions from './TitleActions';

interface OwnedTitleRow {
  id: number;
  title_id: string;
  granted_at: string;
}

interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
}

export default async function TitlesTab({
  memberId,
  displayedTitleId,
}: {
  memberId: string;
  displayedTitleId: string | null;
}) {
  const sb = await getServerSupabase();

  const ownedRes = await sb
    .from('member_titles')
    .select('id, title_id, granted_at')
    .eq('member_id', memberId)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });
  const owned = (ownedRes.data ?? []) as unknown as OwnedTitleRow[];

  if (owned.length === 0) {
    return (
      <EmptyState title="아직 받은 칭호가 없어요" />
    );
  }

  const titleIds = owned.map((o) => o.title_id);
  const titlesRes = await sb
    .from('titles')
    .select('id, name, color, description')
    .in('id', titleIds);
  const titlesMap = ((titlesRes.data ?? []) as unknown as TitleRow[]).reduce<Record<string, TitleRow>>(
    (acc, t) => {
      acc[t.id] = t;
      return acc;
    },
    {},
  );

  const displayed = displayedTitleId ? titlesMap[displayedTitleId] : null;

  return (
    <div className="flex flex-col gap-4">
      {displayed && (
        <Card variant="highlight" accent="highlight">
          <h2 className="text-xs font-semibold text-cdm-fg-muted">표시 칭호</h2>
          <div className="mt-2 flex items-center gap-2">
            <TitleBadge name={displayed.name} color={displayed.color} size="lg" />
          </div>
          {displayed.description && (
            <p className="mt-2 text-sm text-cdm-fg-muted">{displayed.description}</p>
          )}
          <div className="mt-3">
            <TitleActions kind="unset" />
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          보유 칭호 ({owned.length})
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {owned.map((o) => {
            const t = titlesMap[o.title_id];
            if (!t) return null;
            const isDisplayed = t.id === displayedTitleId;
            return (
              <Card key={o.id} className="!p-4">
                <div className="flex items-center justify-between gap-2">
                  <TitleBadge name={t.name} color={t.color} size="md" />
                  {isDisplayed && (
                    <span className="text-xs font-semibold text-cdm-primary">표시 중</span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-2 text-xs text-cdm-fg-muted">{t.description}</p>
                )}
                <p className="mt-2 text-[11px] text-cdm-fg-subtle">
                  발급 {new Date(o.granted_at).toLocaleDateString('ko-KR')}
                </p>
                {!isDisplayed && (
                  <div className="mt-3">
                    <TitleActions kind="set" titleId={t.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
