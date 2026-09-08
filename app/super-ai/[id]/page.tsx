import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { Button } from '@/components/cdm/Button';
import { getActiveMember } from '@/lib/auth/server';
import { CONTAINER_READ } from '@/lib/layout';
import { getServerSupabase } from '@/lib/supabase/server';
import GameLogView from '@/components/game/GameLogView';
import type { SuperAiGameRow } from '@/lib/super-ai/kifu';
import {
  toSuperAiGameLogMeta,
  toSuperAiGameLogPlayers,
  toSuperAiGameRecord,
} from '@/lib/super-ai/kifu';

export const metadata: Metadata = {
  title: '슈퍼 AI 기보',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SuperAiKifuPage({ params }: Props) {
  const { id } = await params;
  const member = await getActiveMember();
  if (!member) redirect(`/login?next=/super-ai/${id}`);

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('super_ai_games')
    .select(
      'id, game_id, winner_side, win_type, total_turns, play_time_seconds, ai_turns, finished, played_at, kifu',
    )
    .eq('id', id)
    .maybeSingle();

  const row = data as SuperAiGameRow | null;
  if (!row) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB member={member} />
      <main className={`${CONTAINER_READ} flex-1 px-4 py-6 sm:px-6`}>
        <div className="mb-4">
          <Link href="/super-ai">
            <Button variant="ghost" size="sm">← 슈퍼 AI</Button>
          </Link>
        </div>
        <GameLogView
          players={toSuperAiGameLogPlayers(row)}
          meta={toSuperAiGameLogMeta(row)}
          record={toSuperAiGameRecord(row)}
          viewingAs="self"
          selfNickname={member.nickname}
        />
      </main>
    </div>
  );
}
