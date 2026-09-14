import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { CONTAINER_WIDE } from '@/lib/layout';
import { getServerSupabase } from '@/lib/supabase/server';
import type { SuperAiGameRow } from '@/lib/super-ai/kifu';
import { GAME_RULES } from '@/lib/gameRules';
import { SUPER_AI_GAMES } from '@/shared/types';
import SuperAiClient from './SuperAiClient';
import SuperAiTabs from './SuperAiTabs';
import KifuBrowseTab, {
  type SuperAiMemberOption,
  type SuperAiGameOption,
} from './KifuBrowseTab';

export const metadata: Metadata = {
  title: '슈퍼 AI',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

async function loadKifu(): Promise<SuperAiGameRow[]> {
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('super_ai_games')
    .select(
      'id, game_id, winner_side, win_type, total_turns, play_time_seconds, ai_turns, finished, played_at',
    )
    .order('played_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('[super-ai] 기보 목록 조회 실패:', error.message);
    return [];
  }
  return (data ?? []) as SuperAiGameRow[];
}

async function loadMembers(): Promise<SuperAiMemberOption[]> {
  const sb = await getServerSupabase();
  const { data, error } = await sb
    .from('members')
    .select('id, nickname')
    .is('withdrawn_at', null)
    .order('nickname');
  if (error) {
    console.warn('[super-ai] 회원 목록 조회 실패:', error.message);
    return [];
  }
  return (data ?? []) as SuperAiMemberOption[];
}

export default async function SuperAiPage({ searchParams }: Props) {
  const member = await getActiveMember();
  if (!member) redirect('/login?next=/super-ai');

  const sp = await searchParams;
  const tab = sp.tab === 'kifu' ? 'kifu' : 'play';

  const superIds = new Set<string>(SUPER_AI_GAMES.map((g) => g.id));
  const visible = GAME_RULES.filter((g) => !g.hiddenInLadder);
  const games: SuperAiGameOption[] = [
    ...visible.filter((g) => superIds.has(g.id)),
    ...visible.filter((g) => !superIds.has(g.id)),
  ].map((g) => ({ id: g.id, name: g.name }));

  const [kifu, members] = await Promise.all([
    tab === 'play' ? loadKifu() : Promise.resolve([] as SuperAiGameRow[]),
    tab === 'kifu' ? loadMembers() : Promise.resolve([] as SuperAiMemberOption[]),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB member={member} />
      <main className={`${CONTAINER_WIDE} flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10`}>
        <h1 className="text-xl font-bold text-cdm-fg">슈퍼 AI</h1>
        <Suspense fallback={null}>
          <SuperAiTabs current={tab} />
        </Suspense>
        {tab === 'kifu' ? (
          <Suspense fallback={<p className="text-sm text-cdm-fg-muted">불러오는 중…</p>}>
            <KifuBrowseTab
              members={members}
              games={games}
              isAdmin={member.role === 'admin'}
              viewerId={member.id}
            />
          </Suspense>
        ) : (
          <SuperAiClient nickname={member.nickname} kifu={kifu} />
        )}
      </main>
    </div>
  );
}
