import { getAdminSupabase } from '@/lib/supabase/admin';

/** 이번 해달별 이벤트 1회분 — DB season_id FK용 (UI 시즌 선택 없음) */
export function getSmsEventSeasonId(): string | null {
  return process.env.EVENT_SMS_SEASON_ID?.trim() || null;
}

export interface EventLeaderboardRow {
  member_id: string;
  total_score: number;
  rounds_played: number;
  rounds_won: number;
  updated_at: string;
}

export async function loadEventLeaderboard(
  limit: number,
  offset: number,
): Promise<{ rows: EventLeaderboardRow[]; total: number }> {
  const seasonId = getSmsEventSeasonId();
  if (!seasonId) return { rows: [], total: 0 };

  const sb = getAdminSupabase();
  if (!sb) return { rows: [], total: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = (sb.from as any)('member_event_scores')
    .select('member_id, total_score, rounds_played, rounds_won, updated_at', { count: 'exact' })
    .eq('season_id', seasonId)
    .order('total_score', { ascending: false })
    .order('updated_at', { ascending: true });

  const { data, error, count } = await base.range(offset, offset + limit - 1);

  if (error) {
    console.error('[event-leaderboard] scores', error.message);
    return { rows: [], total: 0 };
  }

  return {
    rows: (data ?? []) as EventLeaderboardRow[],
    total: count ?? 0,
  };
}
