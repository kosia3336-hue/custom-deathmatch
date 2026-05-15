import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { Button } from '@/components/cdm/Button';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import GameLogView from '@/components/game/GameLogView';
import type { GameLogPlayer, GameLogMeta } from '@/components/game/GameLogView';
import type { GameRecordFile } from '@/shared/types/archive';
import type { TitleColor } from '@/lib/supabase/database.types';

export const metadata: Metadata = { title: '게임 로그' };

interface Props {
  params: Promise<{ logId: string }>;
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
  mode: 'multi' | 'com' | 'solo';
  played_at: string;
  play_time_seconds: number;
  total_turns: number;
  counts_for_stats: boolean;
  game_record: unknown;
  room_snapshot: { gameName?: string; playMode?: string };
}

export default async function MeLogPage({ params }: Props) {
  const { logId } = await params;
  const member = await getActiveMember();
  if (!member) redirect('/login');

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
      .select('position, is_winner, is_draw, is_resign, member_id, nickname_snapshot, title_snapshot, anonymized')
      .eq('game_log_id', logId)
      .order('position'),
  ]);

  const log = logRes.data as unknown as LogRow | null;
  if (!log) notFound();

  const participants = (partRes.data ?? []) as unknown as ParticipantRow[];

  // 본인이 이 로그의 참가자인지 검증
  const isParticipant = participants.some((p) => p.member_id === member.id);
  if (!isParticipant) notFound();

  // GameLogView props 변환 — 본인 아닌 익명 참가자는 마스킹
  const players: GameLogPlayer[] = participants.map((p) => {
    const masked = p.anonymized && p.member_id !== member.id;
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
    playMode: (log.room_snapshot?.playMode ?? log.mode) as 'multi' | 'com' | 'solo',
    players: participants.reduce<Record<string, { nickname: string }>>((acc, p) => {
      const masked = p.anonymized && p.member_id !== member.id;
      const nick = masked ? '???' : p.nickname_snapshot;
      acc[p.member_id ?? p.nickname_snapshot] = { nickname: nick };
      return acc;
    }, {}),
    result: {
      rankings: participants.map((p) => ({
        nickname: p.anonymized && p.member_id !== member.id ? '???' : p.nickname_snapshot,
        rank: p.is_winner ? 1 : p.is_draw ? 1 : 2,
        score: 0,
      })),
      playTime: log.play_time_seconds * 1000,
      totalTurns: log.total_turns,
    },
    gameRecord: log.game_record,
  };

  const me = participants.find((p) => p.member_id === member.id);

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/me?tab=logs">
            <Button variant="ghost" size="sm">← 마이페이지</Button>
          </Link>
        </div>

        <GameLogView
          players={players}
          meta={meta}
          record={record}
          viewingAs="self"
          selfNickname={me?.nickname_snapshot}
        />
      </main>
    </>
  );
}
