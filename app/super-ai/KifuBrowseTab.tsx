'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, EmptyState, Pagination, Tag, TextInput } from '@/components/cdm';
import { usePagination } from '@/hooks/usePagination';
import { getRange, getTotalPages } from '@/lib/pagination';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { cn, formatTime } from '@/lib/utils';
import { PLAY_MODE_LABEL, type PlayMode } from '@/shared/types';

const PAGE_SIZE = 50;

export type SuperAiMemberOption = {
  id: string;
  nickname: string;
};

export type SuperAiGameOption = {
  id: string;
  name: string;
};

type KifuRow = {
  logId: string;
  gameId: string;
  gameName: string;
  mode: PlayMode;
  playedAt: string;
  playTimeSeconds: number;
  totalTurns: number;
  position: 'first' | 'second';
  isWinner: boolean | null;
  isDraw: boolean;
  isResign: boolean;
  opponentNickname: string;
};

interface JoinedRow {
  id: number;
  game_log_id: string;
  position: 'first' | 'second';
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
  game_logs: {
    game_id: string;
    mode: PlayMode;
    played_at: string;
    play_time_seconds: number;
    total_turns: number;
    room_snapshot: { gameName?: string } | null;
  };
}

export default function KifuBrowseTab({
  members,
  games,
  isAdmin,
  viewerId,
}: {
  members: SuperAiMemberOption[];
  games: SuperAiGameOption[];
  isAdmin: boolean;
  viewerId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get('member');
  const gameId = searchParams.get('game');
  const { page, setPage } = usePagination();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<KifuRow[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const selectedMember = members.find((m) => m.id === memberId) ?? null;
  const selectedGame = games.find((g) => g.id === gameId) ?? null;

  const filteredMembers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => m.nickname.toLowerCase().includes(needle));
  }, [members, q]);

  function patchQuery(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'kifu');
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.replace(`/super-ai?${params.toString()}`);
  }

  useEffect(() => {
    if (!memberId || !gameId || !games.some((g) => g.id === gameId)) {
      setRows(null);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchKifu(memberId, gameId, page, isAdmin, games)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotalCount(res.count);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setRows([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberId, gameId, page, isAdmin, games]);

  const totalPages = getTotalPages(totalCount, PAGE_SIZE);
  const otherMemberBlocked =
    !isAdmin && !!memberId && memberId !== viewerId && !loading && rows !== null && rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-cdm-fg-muted">
        회원을 누르고 게임을 누르면 그 조합의 운영 기보만 나온다. 최신 날짜가 위다.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-cdm-fg">회원</h2>
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임으로 찾기"
          aria-label="닉네임 검색"
        />
        {selectedMember && (
          <p className="text-xs text-cdm-fg-muted">선택: {selectedMember.nickname}</p>
        )}
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-cdm-md border border-cdm-border p-2">
          {filteredMembers.length === 0 ? (
            <p className="text-xs text-cdm-fg-subtle">맞는 닉네임이 없다.</p>
          ) : (
            filteredMembers.map((m) => (
              <PickChip
                key={m.id}
                label={m.nickname}
                selected={m.id === memberId}
                onClick={() => patchQuery({ member: m.id === memberId ? null : m.id })}
              />
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-cdm-fg">게임</h2>
        {selectedGame && (
          <p className="text-xs text-cdm-fg-muted">선택: {selectedGame.name}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {games.map((g) => (
            <PickChip
              key={g.id}
              label={g.name}
              selected={g.id === gameId}
              onClick={() => patchQuery({ game: g.id === gameId ? null : g.id })}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {!memberId || !selectedGame ? (
          <Card>
            <EmptyState
              title="회원과 게임을 누르세요"
              description="둘 다 고르면 그 기보만 최신순으로 쌓인다."
            />
          </Card>
        ) : loading ? (
          <p className="text-sm text-cdm-fg-muted">불러오는 중…</p>
        ) : otherMemberBlocked ? (
          <Card>
            <EmptyState
              title="이 회원의 기보는 볼 수 없다"
              description="다른 사람 운영 기보는 관리자만 연다. 본인 닉네임을 고르면 된다."
            />
          </Card>
        ) : rows !== null && rows.length === 0 ? (
          <Card>
            <EmptyState
              title="기보가 없다"
              description={`${selectedMember?.nickname ?? '이 회원'}의 ${selectedGame.name} 기록이 없다.`}
            />
          </Card>
        ) : (
          <>
            <p className="text-xs text-cdm-fg-muted">
              {selectedMember?.nickname} · {selectedGame.name} · 총 {totalCount}판
              {totalPages > 1 ? ` · ${page} / ${totalPages} 페이지` : ''} · 최신순
            </p>
            <ul className="flex flex-col gap-2">
              {(rows ?? []).map((row) => (
                <li key={row.logId}>
                  <Link
                    href={`/super-ai/log/${row.logId}?member=${memberId}&game=${gameId}`}
                  >
                    <Card variant="interactive" className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-sm font-semibold', resultClass(row))}>
                        {resultLabel(row)}
                      </span>
                      <Tag>{row.position === 'first' ? '선공' : '후공'}</Tag>
                      {row.mode !== 'multi' && <Tag>{PLAY_MODE_LABEL[row.mode]}</Tag>}
                      <span className="text-sm text-cdm-fg">vs {row.opponentNickname}</span>
                      <span className="text-xs text-cdm-fg-muted">
                        {row.totalTurns}턴 · {formatTime(row.playTimeSeconds * 1000)}
                      </span>
                      <span className="ml-auto text-xs text-cdm-fg-muted">
                        {new Date(row.playedAt).toLocaleString('ko-KR')}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
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

function PickChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-cdm-md border px-3 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'border-cdm-primary bg-cdm-primary text-white'
          : 'border-cdm-border bg-cdm-bg text-cdm-fg hover:bg-cdm-bg-elev-1',
      )}
    >
      {label}
    </button>
  );
}

function resultLabel(row: KifuRow): string {
  if (row.isResign) return '기권';
  if (row.isDraw) return '무승부';
  if (row.isWinner) return '승';
  return '패';
}

function resultClass(row: KifuRow): string {
  if (row.isDraw) return 'text-cdm-fg-muted';
  if (row.isWinner) return 'text-cdm-success';
  return 'text-cdm-fg-muted';
}

async function fetchKifu(
  memberId: string,
  filterGameId: string,
  page: number,
  isAdmin: boolean,
  games: SuperAiGameOption[],
): Promise<{ rows: KifuRow[]; count: number }> {
  const sb = getBrowserSupabase();
  const { from, to } = getRange(page, PAGE_SIZE);
  const gameName = games.find((g) => g.id === filterGameId)?.name ?? filterGameId;

  const res = await sb
    .from('game_log_participants')
    .select(
      'id, game_log_id, position, is_winner, is_draw, is_resign, game_logs!inner(game_id, mode, played_at, play_time_seconds, total_turns, room_snapshot)',
      { count: 'exact' },
    )
    .eq('member_id', memberId)
    .eq('game_logs.game_id', filterGameId)
    .order('played_at', { referencedTable: 'game_logs', ascending: false })
    .range(from, to);

  if (res.error) {
    throw new Error(res.error.message);
  }

  const data = (res.data ?? []) as unknown as JoinedRow[];
  const ids = data.map((r) => r.game_log_id);
  const oppByLog = new Map<string, string>();

  if (ids.length > 0) {
    const oppRes = await sb
      .from('game_log_participants')
      .select('game_log_id, member_id, nickname_snapshot, anonymized')
      .in('game_log_id', ids);
    const parts = (oppRes.data ?? []) as {
      game_log_id: string;
      member_id: string | null;
      nickname_snapshot: string;
      anonymized: boolean;
    }[];
    for (const p of parts) {
      if (p.member_id === memberId) continue;
      oppByLog.set(
        p.game_log_id,
        !isAdmin && p.anonymized ? '???' : p.nickname_snapshot,
      );
    }
  }

  const rows: KifuRow[] = data
    .filter((r) => r.game_logs)
    .map((r) => ({
      logId: r.game_log_id,
      gameId: r.game_logs.game_id,
      gameName: r.game_logs.room_snapshot?.gameName ?? gameName,
      mode: r.game_logs.mode,
      playedAt: r.game_logs.played_at,
      playTimeSeconds: r.game_logs.play_time_seconds,
      totalTurns: r.game_logs.total_turns,
      position: r.position,
      isWinner: r.is_winner,
      isDraw: r.is_draw,
      isResign: r.is_resign,
      opponentNickname: oppByLog.get(r.game_log_id) ?? '상대',
    }));

  rows.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  return { rows, count: res.count ?? 0 };
}
