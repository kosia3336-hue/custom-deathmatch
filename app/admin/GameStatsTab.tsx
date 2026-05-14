import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import GameStatsCharts from './GameStatsCharts';
import type { BanPickLogRow } from './GameStatsCharts';

export default async function GameStatsTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseServiceRole() as any;

  const [gamesRes, seasonsRes, banPickRes] = await Promise.all([
    sb.from('games').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    sb.from('rank_seasons').select('id, name, is_active').order('id', { ascending: false }),
    sb.from('rank_ban_pick_log').select('picked_game_id, bans, season_id'),
  ]);

  type RawGame = { id: string; name: string; sort_order: number };
  type RawSeason = { id: number; name: string; is_active: boolean | null };
  type RawBanEntry = { game_id: string; banned_by: string; is_timeout: boolean };
  type RawBanPickLog = { picked_game_id: string; bans: RawBanEntry[]; season_id: number };

  const games = (gamesRes.data ?? []) as RawGame[];
  const seasons = (seasonsRes.data ?? []) as RawSeason[];
  const rawBanPickLogs = (banPickRes.data ?? []) as RawBanPickLog[];

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
