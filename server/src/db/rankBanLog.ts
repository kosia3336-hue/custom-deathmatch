import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';
import type { BannedGame } from '@shared/types/ban-pick.js';

export async function saveRankBanPickLog(opts: {
  seasonId: number;
  firstMemberId: string | null;
  secondMemberId: string | null;
  pickedGameId: string;
  bannedGames: BannedGame[];
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const bans = opts.bannedGames.map((b, i) => ({
    order: i + 1,
    game_id: b.gameId,
    banned_by: b.bannedBy,
    is_timeout: b.isTimeout ?? false,
  }));

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('rank_ban_pick_log').insert({
    season_id: opts.seasonId,
    first_member_id: opts.firstMemberId,
    second_member_id: opts.secondMemberId,
    picked_game_id: opts.pickedGameId,
    bans,
  });

  if (error) {
    console.warn('[rankBanLog] 저장 실패:', error.message);
  }
}
