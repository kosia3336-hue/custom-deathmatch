'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { GameStatData } from './types';
import type { PlayMode } from '@/lib/supabase/database.types';
import { getBrowserSupabase } from '@/lib/supabase/client';

const MODE_LABELS: Record<string, string> = {
  multi: '멀티',
  com: 'AI',
  solo: '솔로',
};

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
  const [logs, setLogs] = useState<GameLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchLogs(memberId, selectedGameId, gameNameMap)
      .then((rows) => {
        if (!cancelled) setLogs(rows);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, selectedGameId, gameNameMap]);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-sm font-semibold text-cdm-fg-muted">게임 로그</h3>
          <div className="sm:min-w-[200px]">
            <select
              aria-label="로그 필터"
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value === 'all' ? 'all' : e.target.value)}
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
        )}
      </section>
    </div>
  );
}

async function fetchLogs(
  memberId: string,
  filterGameId: 'all' | string,
  gameNameMap: Map<string, string>,
): Promise<GameLogEntry[]> {
  const sb = getBrowserSupabase();

  const participantsRes = await sb
    .from('game_log_participants')
    .select('id, game_log_id, position, is_winner, is_draw, is_resign')
    .eq('member_id', memberId)
    .order('id', { ascending: false })
    .limit(100);

  const participants = (participantsRes.data ?? []) as {
    id: number;
    game_log_id: string;
    position: string;
    is_winner: boolean | null;
    is_draw: boolean;
    is_resign: boolean;
  }[];

  if (participants.length === 0) return [];

  const logIds = [...new Set(participants.map((p) => p.game_log_id))];

  const logsRes = await sb
    .from('game_logs')
    .select('id, game_id, mode, played_at, play_time_seconds')
    .in('id', logIds);

  const gameLogs = (logsRes.data ?? []) as {
    id: string;
    game_id: string;
    mode: PlayMode;
    played_at: string;
    play_time_seconds: number;
  }[];

  const logMap = new Map(gameLogs.map((l) => [l.id, l]));

  let rows: GameLogEntry[] = participants
    .filter((p) => logMap.has(p.game_log_id))
    .map((p) => {
      const log = logMap.get(p.game_log_id)!;
      return {
        game_log_id: p.game_log_id,
        game_id: log.game_id,
        game_name: gameNameMap.get(log.game_id) ?? log.game_id,
        position: p.position,
        is_winner: p.is_winner,
        is_draw: p.is_draw,
        is_resign: p.is_resign,
        played_at: log.played_at,
        play_time_seconds: log.play_time_seconds,
        mode: log.mode,
      };
    });

  if (filterGameId !== 'all') {
    rows = rows.filter((r) => r.game_id === filterGameId);
  }

  rows.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
  return rows;
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
