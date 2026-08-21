import { getActiveSeasonId } from '../../db/rankStats.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../../db/supabase.js';
import type { GameWl } from '../banpick.js';
import { setDummyRecords } from '../records.js';

export async function hydrateLiveDummyRecords(dummyPlayerId: string, memberId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const seasonId = await getActiveSeasonId();
  if (seasonId == null) return;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('rank_match_history')
    .select('game_id, winner_id, loser_id')
    .eq('season_id', seasonId)
    .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`);
  if (error || !data) return;

  const rec: Record<string, GameWl> = {};
  for (const row of data as Array<{ game_id: string; winner_id: string; loser_id: string }>) {
    const slot = rec[row.game_id] ?? { wins: 0, losses: 0 };
    if (row.winner_id === memberId) slot.wins += 1;
    if (row.loser_id === memberId) slot.losses += 1;
    rec[row.game_id] = slot;
  }
  setDummyRecords(dummyPlayerId, rec);
}
