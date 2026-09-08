import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { Button } from '@/components/cdm/Button';
import { getActiveMember } from '@/lib/auth/server';
import { CONTAINER_READ } from '@/lib/layout';
import { getServerSupabase } from '@/lib/supabase/server';
import GameLogView from '@/components/game/GameLogView';
import type { GameLogPlayer, GameLogMeta } from '@/components/game/GameLogView';
import type { GameRecordFile } from '@/shared/types/archive';
import type { PlayMode } from '@/shared/types/room';
import { maskGameRecordNicknames } from '@/lib/maskGameRecord';
import type { TitleColor } from '@/lib/supabase/database.types';

export const metadata: Metadata = {
  title: '슈퍼 AI 기보',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ logId: string }>;
  searchParams: Promise<{ member?: string; game?: string }>;
}

interface ParticipantRow {
  position: 'first' | 'second';
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
  member_id: string | null;
  nickname_snapshot: string;
  title_snapshot: { id: string; name: string; color: TitleColor } | null;
  anonymized: boolean;
}

interface LogRow {
  id: string;
  game_id: string;
  mode: 'multi' | 'com' | 'solo' | 'tutorial';
  played_at: string;
  play_time_seconds: number;
  total_turns: number;
  counts_for_stats: boolean;
  game_record: unknown;
  room_snapshot: { gameName?: string; playMode?: string };
}

export default async function SuperAiOpLogPage({ params, searchParams }: Props) {
  const { logId } = await params;
  const { member, game } = await searchParams;
  const me = await getActiveMember();
  if (!me) redirect(`/login?next=/super-ai/log/${logId}`);

  const sb = await getServerSupabase();
  const [logRes, partRes] = await Promise.all([
    sb
      .from('game_logs')
      .select(
        'id, game_id, mode, played_at, play_time_seconds, total_turns, counts_for_stats, game_record, room_snapshot',
      )
      .eq('id', logId)
      .maybeSingle(),
    sb
      .from('game_log_participants')
      .select(
        'position, is_winner, is_draw, is_resign, member_id, nickname_snapshot, title_snapshot, anonymized',
      )
      .eq('game_log_id', logId)
      .order('position'),
  ]);

  const log = logRes.data as unknown as LogRow | null;
  if (!log) notFound();

  const participants = (partRes.data ?? []) as unknown as ParticipantRow[];
  const isAdmin = me.role === 'admin';
  const isParticipant = participants.some((p) => p.member_id === me.id);
  if (!isAdmin && !isParticipant) notFound();

  const hideNames = !isAdmin;
  const hiddenNicknames = hideNames
    ? participants
        .filter((p) => p.anonymized && p.member_id !== me.id)
        .map((p) => p.nickname_snapshot)
        .filter((nickname): nickname is string => Boolean(nickname))
    : [];

  const players: GameLogPlayer[] = participants.map((p) => {
    const masked = hideNames && p.anonymized && p.member_id !== me.id;
    return {
      nickname: masked ? '???' : p.nickname_snapshot,
      title: masked ? null : p.title_snapshot,
      turn: p.position,
      isWinner: p.is_winner === true,
      isDraw: p.is_draw,
      isResign: p.is_resign,
    };
  });

  const meta: GameLogMeta = {
    gameId: log.game_id,
    gameName: log.room_snapshot?.gameName ?? log.game_id,
    playedAt: log.played_at,
    playTimeMs: log.play_time_seconds * 1000,
    totalTurns: log.total_turns,
    mode: log.mode,
    countsForStats: log.counts_for_stats,
  };

  const record: GameRecordFile = {
    version: '2',
    gameId: log.game_id,
    gameName: log.room_snapshot?.gameName ?? log.game_id,
    playedAt: log.played_at,
    playMode: (log.room_snapshot?.playMode ?? log.mode) as PlayMode,
    players: participants.reduce<Record<string, { nickname: string }>>((acc, p) => {
      const masked = hideNames && p.anonymized && p.member_id !== me.id;
      const nick = masked ? '???' : p.nickname_snapshot;
      acc[p.member_id ?? p.nickname_snapshot] = { nickname: nick };
      return acc;
    }, {}),
    result: {
      rankings: participants.map((p) => ({
        nickname:
          hideNames && p.anonymized && p.member_id !== me.id ? '???' : p.nickname_snapshot,
        rank: p.is_winner ? 1 : p.is_draw ? 1 : 2,
        score: 0,
      })),
      playTime: log.play_time_seconds * 1000,
      totalTurns: log.total_turns,
    },
    gameRecord: maskGameRecordNicknames(log.game_record, hiddenNicknames),
  };

  const back = new URLSearchParams();
  back.set('tab', 'kifu');
  if (member) back.set('member', member);
  if (game) back.set('game', game);
  const mePart = participants.find((p) => p.member_id === me.id);

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB member={me} />
      <main className={`${CONTAINER_READ} flex-1 px-4 py-6 sm:px-6`}>
        <div className="mb-4">
          <Link href={`/super-ai?${back.toString()}`}>
            <Button variant="ghost" size="sm">← 기보</Button>
          </Link>
        </div>
        <GameLogView
          players={players}
          meta={meta}
          record={record}
          viewingAs={isAdmin ? 'admin' : 'self'}
          selfNickname={mePart?.nickname_snapshot}
        />
      </main>
    </div>
  );
}
