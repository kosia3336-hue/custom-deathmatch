import Link from 'next/link';
import ResultShareButton from '@/components/game/ResultShareButton';
import { Card } from '@/components/cdm/Card';
import { Icon } from '@/components/cdm/Icon';
import { Tag } from '@/components/cdm/Tag';
import { TurnBadge } from '@/components/cdm/TurnBadge';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { EmptyState } from '@/components/cdm/EmptyState';
import { RoutePagination } from '@/components/cdm/Pagination';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { TitleColor } from '@/lib/supabase/database.types';
import { PLAY_MODE_LABEL } from '@/shared/types';
import { formatTime } from '@/lib/utils';

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

interface LogParticipant {
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
  room_snapshot: { gameName?: string; title?: string };
  participants: LogParticipant[];
  /** 랭크전 판인지 — 결과 카드의 '랭크전' 표시 */
  isRanked: boolean;
}

async function loadLogs(
  memberId: string,
  page: number,
): Promise<{ logs: LogRow[]; totalCount: number }> {
  const sb = await getServerSupabase();
  const { from, to } = getRange(page, PAGE_SIZE);

  // 본인이 참가한 game_log_participants → game_log 매칭 (페이지네이션은 본인 행 기준)
  const partRes = await sb
    .from('game_log_participants')
    .select('game_log_id', { count: 'exact' })
    .eq('member_id', memberId)
    .order('id', { ascending: false })
    .range(from, to);
  const partRows = (partRes.data ?? []) as unknown as { game_log_id: string }[];
  const totalCount = partRes.count ?? 0;

  const ids = Array.from(new Set(partRows.map((r) => r.game_log_id)));
  if (ids.length === 0) return { logs: [], totalCount };

  const logsRes = await sb
    .from('game_logs')
    .select(
      'id, game_id, mode, played_at, play_time_seconds, total_turns, counts_for_stats, room_snapshot',
    )
    .in('id', ids)
    .order('played_at', { ascending: false });
  const logRows = (logsRes.data ?? []) as unknown as Omit<LogRow, 'participants' | 'isRanked'>[];

  // 각 로그의 참가자, 랭크전 기록(서로 의존하지 않으므로 함께 보낸다)
  const [participantsRes, rankRes] = await Promise.all([
    sb
      .from('game_log_participants')
      .select(
        'game_log_id, position, is_winner, is_draw, is_resign, member_id, nickname_snapshot, title_snapshot, anonymized',
      )
      .in('game_log_id', ids),
    sb.from('rank_match_history').select('game_log_id').in('game_log_id', ids),
  ]);
  const partAll = (participantsRes.data ?? []) as unknown as (LogParticipant & { game_log_id: string })[];
  const rankedIds = new Set(
    ((rankRes.data ?? []) as unknown as { game_log_id: string | null }[]).map((r) => r.game_log_id),
  );

  const logs = logRows.map((row) => ({
    ...row,
    participants: partAll.filter((p) => p.game_log_id === row.id),
    // 무승부 랭크전은 rank_match_history 에 남지 않아 방 제목('[랭크] …')으로도 본다
    isRanked: rankedIds.has(row.id) || /^\[랭크\]/.test(row.room_snapshot?.title ?? ''),
  }));

  return { logs, totalCount };
}

export default async function LogsTab({
  memberId,
  page: pageParam,
}: {
  memberId: string;
  page: string | undefined;
}) {
  const page = parsePageParam(pageParam);
  const { logs, totalCount } = await loadLogs(memberId, page);
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  if (totalCount === 0) {
    return <EmptyState title="아직 게임 로그가 없습니다" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-cdm-fg-muted">
        총 {totalCount}판 · {page} / {totalPages} 페이지
      </p>
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
                    <Tag>{PLAY_MODE_LABEL[log.mode]}</Tag>
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
                  {opponent?.title_snapshot && !opponent.anonymized && (
                    <TitleBadge
                      name={opponent.title_snapshot.name}
                      color={opponent.title_snapshot.color}
                      size="sm"
                    />
                  )}
                  <span className="text-sm font-semibold text-cdm-fg">
                    {opponent?.anonymized ? '???' : (opponent?.nickname_snapshot ?? '탈퇴 회원')}
                  </span>
                  {opponent && <TurnBadge turn={opponent.position} size="sm" />}
                </div>
              </div>

              <div className="mt-2 flex gap-3 text-xs text-cdm-fg-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon name="clock" size="sm" className="h-3.5 w-3.5" />
                  {formatTime(log.play_time_seconds * 1000)}
                </span>
                <span>{log.total_turns}턴</span>
              </div>
            </Link>
            <div className="mt-3 flex justify-end">
              <ResultShareButton
                summary={{
                  gameName: log.room_snapshot?.gameName ?? log.game_id,
                  result,
                  playTimeMs: log.play_time_seconds * 1000,
                  totalTurns: log.total_turns,
                  selfName: me.nickname_snapshot,
                  isRanked: log.isRanked,
                  opponents: log.participants
                    .filter((p) => p.member_id !== memberId)
                    .map((p) => ({
                      name: p.anonymized ? '???' : p.nickname_snapshot || '탈퇴 회원',
                      won: p.is_winner === true && !p.is_draw,
                    })),
                  playedAt: log.played_at,
                }}
              />
            </div>
          </Card>
        );
      })}
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
