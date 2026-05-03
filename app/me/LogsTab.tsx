import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { Tag } from '@/components/cdm/Tag';
import { TurnBadge } from '@/components/cdm/TurnBadge';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import type { TitleColor } from '@/lib/supabase/database.types';
import { formatTime } from '@/lib/utils';

const PAGE_SIZE = 20;

interface LogParticipant {
  position: 'first' | 'second';
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
  member_id: string | null;
  nickname_snapshot: string;
  title_snapshot: { id: string; name: string; color: TitleColor } | null;
}

interface LogRow {
  id: string;
  game_id: string;
  mode: 'multi' | 'com' | 'solo';
  played_at: string;
  play_time_seconds: number;
  total_turns: number;
  counts_for_stats: boolean;
  room_snapshot: { gameName?: string };
  participants: LogParticipant[];
}

async function loadLogs(memberId: string): Promise<LogRow[]> {
  const sb = await getServerSupabase();

  // 본인이 참가한 game_log_participants → game_log 매칭
  const partRes = await sb
    .from('game_log_participants')
    .select('game_log_id')
    .eq('member_id', memberId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE * 2); // 한 게임당 2 행이므로 넉넉히
  const partRows = (partRes.data ?? []) as unknown as { game_log_id: string }[];

  const ids = Array.from(new Set(partRows.map((r) => r.game_log_id))).slice(0, PAGE_SIZE);
  if (ids.length === 0) return [];

  const logsRes = await sb
    .from('game_logs')
    .select(
      'id, game_id, mode, played_at, play_time_seconds, total_turns, counts_for_stats, room_snapshot',
    )
    .in('id', ids)
    .order('played_at', { ascending: false });
  const logRows = (logsRes.data ?? []) as unknown as Omit<LogRow, 'participants'>[];

  // 각 로그의 참가자
  const participantsRes = await sb
    .from('game_log_participants')
    .select(
      'game_log_id, position, is_winner, is_draw, is_resign, member_id, nickname_snapshot, title_snapshot',
    )
    .in('game_log_id', ids);
  const partAll = (participantsRes.data ?? []) as unknown as (LogParticipant & { game_log_id: string })[];

  return logRows.map((row) => ({
    ...row,
    participants: partAll.filter((p) => p.game_log_id === row.id),
  }));
}

export default async function LogsTab({ memberId }: { memberId: string }) {
  const logs = await loadLogs(memberId);

  if (logs.length === 0) {
    return (
      <EmptyState title="아직 게임 로그가 없어요" />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log) => {
        const me = log.participants.find((p) => p.member_id === memberId);
        const opponent = log.participants.find((p) => p.member_id !== memberId);
        if (!me) return null;

        const result = me.is_draw
          ? '무승부'
          : me.is_winner === true
            ? '승리'
            : me.is_resign
              ? '기권'
              : '패배';

        const resultColor = me.is_draw
          ? 'text-cdm-highlight'
          : me.is_winner === true
            ? 'text-cdm-accent'
            : 'text-cdm-fg-muted';

        return (
          <Card key={log.id} variant="interactive" className="!p-4">
            <Link href={`/me/log/${log.id}`} className="block">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-cdm-fg-muted">
                  <span>{new Date(log.played_at).toLocaleString('ko-KR')}</span>
                  <Tag>{log.room_snapshot?.gameName ?? log.game_id}</Tag>
                  {log.mode !== 'multi' && (
                    <Tag>{log.mode === 'com' ? 'COM' : '솔로'}</Tag>
                  )}
                  {!log.counts_for_stats && (
                    <span className="text-cdm-fg-subtle">* 통계 미반영</span>
                  )}
                </div>
                <span className={`text-sm font-bold ${resultColor}`}>{result}</span>
              </div>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-cdm-fg-muted">본인</span>
                  <TurnBadge turn={me.position} size="sm" />
                </div>
                <span className="text-cdm-fg-subtle">vs</span>
                <div className="flex items-center gap-1.5">
                  {opponent?.title_snapshot && (
                    <TitleBadge
                      name={opponent.title_snapshot.name}
                      color={opponent.title_snapshot.color}
                      size="sm"
                    />
                  )}
                  <span className="text-sm font-semibold text-cdm-fg">
                    {opponent?.nickname_snapshot ?? '탈퇴 회원'}
                  </span>
                  {opponent && <TurnBadge turn={opponent.position} size="sm" />}
                </div>
              </div>

              <div className="mt-2 flex gap-3 text-xs text-cdm-fg-muted">
                <span>⏱ {formatTime(log.play_time_seconds * 1000)}</span>
                <span>{log.total_turns}턴</span>
              </div>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
