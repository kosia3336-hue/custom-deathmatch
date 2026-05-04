'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pagination } from '@/components/cdm/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { DEFAULT_PAGE_SIZE, getRange, getTotalPages } from '@/lib/pagination';
import type { GameStatData } from './types';
import type { PlayMode } from '@/lib/supabase/database.types';
import { getBrowserSupabase } from '@/lib/supabase/client';

const MODE_LABELS: Record<string, string> = {
  multi: '멀티',
  com: 'AI',
  solo: '솔로',
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

interface GameLogEntry {
  game_log_id: string;
  game_id: string;
  game_name: string;
  position: string;
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
  played_at: string;
  play_time_seconds: number;
  mode: PlayMode;
}

interface Props {
  memberId: string;
  gameStats: GameStatData[];
}

export default function GamesSection({ memberId, gameStats }: Props) {
  const gameNameMap = useMemo(
    () => new Map(gameStats.map((g) => [g.game_id, g.game_name])),
    [gameStats],
  );

  const [selectedGameId, setSelectedGameId] = useState<'all' | string>('all');
  const { page, setPage } = usePagination({ paramKey: 'gamesPage' });
  const [logs, setLogs] = useState<GameLogEntry[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // setLoading 은 effect-동기 호출이지만 외부 비동기(fetch) 와의 동기화를 위한 정당한 케이스
    // (cascading render 가 발생하더라도 의도된 동작) — 룰을 한 줄 우회.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchLogs(memberId, selectedGameId, page, gameNameMap)
      .then(({ rows, count }) => {
        if (!cancelled) {
          setLogs(rows);
          setTotalCount(count);
        }
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setLogs([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, selectedGameId, page, gameNameMap]);

  // 게임 필터 변경 시 페이지 1로 리셋
  function changeGame(next: 'all' | string) {
    if (next === selectedGameId) return;
    setSelectedGameId(next);
    setPage(1);
  }

  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-sm font-semibold text-cdm-fg-muted">
            게임 로그
            {!loading && totalCount > 0 && (
              <span className="ml-2 text-xs font-normal text-cdm-fg-subtle">
                총 {totalCount}판 · {page} / {totalPages} 페이지
              </span>
            )}
          </h3>
          <div className="sm:min-w-[200px]">
            <select
              aria-label="로그 필터"
              value={selectedGameId}
              onChange={(e) => changeGame(e.target.value === 'all' ? 'all' : e.target.value)}
              disabled={loading}
              className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none focus:border-cdm-primary disabled:opacity-60"
            >
              <option value="all">전체</option>
              {gameStats.map((g) => (
                <option key={g.game_id} value={g.game_id}>
                  {g.game_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-xs text-cdm-fg-subtle">불러오는 중…</p>}
        {!loading && logs !== null && logs.length === 0 && (
          <p className="text-xs text-cdm-fg-subtle">해당 조건의 게임 로그가 없습니다.</p>
        )}
        {!loading && logs !== null && logs.length > 0 && (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] text-cdm-fg-subtle">최신 순 (플레이 시각 기준)</p>
              {logs.map((log) => (
                <GameLogRow
                  key={log.game_log_id}
                  game={log}
                  memberId={memberId}
                  showGameName={selectedGameId === 'all'}
                />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

interface JoinedRow {
  id: number;
  game_log_id: string;
  position: string;
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
  game_logs: {
    game_id: string;
    mode: PlayMode;
    played_at: string;
    play_time_seconds: number;
  };
}

async function fetchLogs(
  memberId: string,
  filterGameId: 'all' | string,
  page: number,
  gameNameMap: Map<string, string>,
): Promise<{ rows: GameLogEntry[]; count: number }> {
  const sb = getBrowserSupabase();
  const { from, to } = getRange(page, PAGE_SIZE);

  let query = sb
    .from('game_log_participants')
    .select(
      'id, game_log_id, position, is_winner, is_draw, is_resign, game_logs!inner(game_id, mode, played_at, play_time_seconds)',
      { count: 'exact' },
    )
    .eq('member_id', memberId);

  if (filterGameId !== 'all') {
    // PostgREST 의 inner join 컬럼 필터
    query = query.eq('game_logs.game_id', filterGameId);
  }

  const res = await query
    .order('id', { ascending: false })
    .range(from, to);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data ?? []) as any as JoinedRow[];

  const rows: GameLogEntry[] = data
    .filter((r) => !!r.game_logs)
    .map((r) => ({
      game_log_id: r.game_log_id,
      game_id: r.game_logs.game_id,
      game_name: gameNameMap.get(r.game_logs.game_id) ?? r.game_logs.game_id,
      position: r.position,
      is_winner: r.is_winner,
      is_draw: r.is_draw,
      is_resign: r.is_resign,
      played_at: r.game_logs.played_at,
      play_time_seconds: r.game_logs.play_time_seconds,
      mode: r.game_logs.mode,
    }));

  rows.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());

  return { rows, count: res.count ?? 0 };
}

function GameLogRow({
  game,
  memberId,
  showGameName,
}: {
  game: GameLogEntry;
  memberId: string;
  showGameName: boolean;
}) {
  const result = game.is_resign
    ? '기권'
    : game.is_draw
      ? '무승부'
      : game.is_winner
        ? '승'
        : '패';
  const resultColor =
    game.is_resign || game.is_winner === false
      ? 'text-[#be123c]'
      : game.is_draw
        ? 'text-cdm-fg-muted'
        : 'text-[#15803d]';
  const mins = Math.floor(game.play_time_seconds / 60);
  const secs = game.play_time_seconds % 60;
  const duration = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;

  return (
    <Link
      href={`/admin/logs/${game.game_log_id}?memberId=${memberId}`}
      className="flex items-center justify-between gap-2 rounded-cdm-md bg-cdm-bg-elev-1 px-3 py-2 text-xs flex-wrap hover:bg-cdm-bg-elev-2 transition-colors"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {showGameName && (
          <span className="max-w-[140px] truncate font-medium text-cdm-fg" title={game.game_name}>
            {game.game_name}
          </span>
        )}
        <span className="text-cdm-fg-muted">{MODE_LABELS[game.mode] ?? game.mode}</span>
        <span className={`font-bold ${resultColor}`}>{result}</span>
        <span className="text-cdm-fg-muted">{game.position === 'first' ? '선공' : '후공'}</span>
        <span className="text-cdm-fg-subtle">{duration}</span>
      </div>
      <span className="shrink-0 text-cdm-fg-subtle">
        {new Date(game.played_at).toLocaleString('ko-KR')}
      </span>
    </Link>
  );
}
