import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import GameStatsCharts from './GameStatsCharts';
import type { BanPickLogRow } from './GameStatsCharts';

type RawBanEntry = { game_id: string; banned_by: string; is_timeout: boolean };
type RawBanPickLog = { picked_game_id: string; bans: RawBanEntry[]; season_id: number };

/** PostgREST 한 번 조회 상한. 넘는 만큼은 조용히 잘려 나간다. */
const PAGE = 1000;

/**
 * 밴픽 로그 전량.
 *
 * 그냥 select 하면 1000 건에서 끊긴다 — 경고도 없이 앞쪽만 온다. 통계가 옛 시즌에
 * 멈춰 보였던 원인이다(1000 건이 전부 시즌 1~2 였다). 끝까지 넘겨 받는다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllBanPickLogs(sb: any): Promise<RawBanPickLog[]> {
  const all: RawBanPickLog[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('rank_ban_pick_log')
      .select('picked_game_id, bans, season_id')
      /* 페이지가 겹치거나 빠지지 않도록 순서를 고정한다 */
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('[admin:game-stats] 밴픽 로그 조회 실패:', error.message);
      break;
    }
    const page = (data ?? []) as RawBanPickLog[];
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

export default async function GameStatsTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseServiceRole() as any;

  const [gamesRes, seasonsRes, rawBanPickLogs] = await Promise.all([
    sb.from('games').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    sb.from('rank_seasons').select('id, name, is_active').order('id', { ascending: false }),
    fetchAllBanPickLogs(sb),
  ]);

  type RawGame = { id: string; name: string; sort_order: number };
  type RawSeason = { id: number; name: string; is_active: boolean | null };

  const games = (gamesRes.data ?? []) as RawGame[];
  const seasons = (seasonsRes.data ?? []) as RawSeason[];

  const banPickLogs: BanPickLogRow[] = rawBanPickLogs.map((l) => ({
    pickedGameId: l.picked_game_id,
    seasonId: l.season_id,
    bans: (l.bans ?? []).map((b) => ({
      gameId: b.game_id,
      bannedBy: b.banned_by,
      isTimeout: b.is_timeout,
    })),
  }));

  return (
    <GameStatsCharts
      games={games.map((g) => ({ id: g.id, name: g.name }))}
      seasons={seasons.map((s) => ({ id: s.id, name: s.name, isActive: s.is_active ?? false }))}
      banPickLogs={banPickLogs}
    />
  );
}
