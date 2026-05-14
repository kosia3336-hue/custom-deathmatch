import type { Metadata } from 'next';
import { GNB } from '@/components/cdm/GNB';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getAuthState } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { TitleColor } from '@/lib/supabase/database.types';
import TitlesClient from './TitlesClient';

export const metadata: Metadata = {
  title: '칭호',
  description: '현재 보유자가 있는 공개 칭호 목록이에요.',
  robots: { index: true, follow: true },
};

interface PublicTitleRow {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  condition_text: string | null;
  is_system: boolean;
  holder_count: number;
  first_granted_at: string | null;
}

interface ShopTitleRow {
  payload: Record<string, unknown> | null;
}

export default async function TitlesPage() {
  const authState = await getAuthState();
  const member = authState.kind === 'ACTIVE' ? authState.member : null;

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('list_public_titles');
  const titles = (error ? [] : (data ?? [])) as PublicTitleRow[];

  // 상점에서 현재 구매 가능한 칭호의 title_id 집합
  const nowIso = new Date().toISOString();
  const purchasableRes = await sb
    .from('shop_items')
    .select('payload')
    .eq('type', 'title')
    .eq('is_active', true)
    .or(`available_from.is.null,available_from.lte.${nowIso}`)
    .or(`available_until.is.null,available_until.gt.${nowIso}`);

  const purchasableTitleIds = new Set<string>();
  for (const r of (purchasableRes.data ?? []) as unknown as ShopTitleRow[]) {
    const tid = (r.payload as { title_id?: string } | null)?.title_id;
    if (typeof tid === 'string' && tid) purchasableTitleIds.add(tid);
  }

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">🎖 칭호</h1>
        </header>

        {titles.length === 0 ? (
          <EmptyState
            title="아직 공개된 칭호가 없어요"
            description="첫 번째 보유자가 나타나면 여기에 표시됩니다."
          />
        ) : (
          <TitlesClient titles={titles} purchasableIds={Array.from(purchasableTitleIds)} />
        )}
      </main>
    </>
  );
}
