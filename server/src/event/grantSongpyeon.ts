import type { IO } from '../socket/types.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import { sessions } from '../store/sessions.js';
import { songpyeonForRankedResult } from '@shared/event/chuseok.js';

export async function grantSongpyeonForRankedGame(
  io: IO | null,
  gameLogId: string | null,
  grants: Array<{ memberId: string; outcome: 'win' | 'loss' | 'draw'; forfeit: boolean }>,
): Promise<void> {
  if (!isSupabaseConfigured() || !gameLogId) return;
  const sb = getSupabaseAdmin();
  for (const grant of grants) {
    const amount = songpyeonForRankedResult(grant);
    if (amount <= 0) continue;
    const reason = grant.outcome === 'win' ? 'rank_win' : grant.outcome === 'draw' ? 'rank_draw' : 'rank_loss';
    try {
      const { data, error } = await (sb.rpc as any)('grant_songpyeon_for_rank', {
        p_member_id: grant.memberId,
        p_game_log_id: gameLogId,
        p_amount: amount,
        p_reason: reason,
      });
      if (error) throw error;
      const balance = Number(data ?? 0);
      if (!io) continue;
      const token = sessions.getTokenByMemberId(grant.memberId);
      if (!token) continue;
      const sid = sessions.getSocketByToken(token);
      const sock = sid ? io.sockets.sockets.get(sid) : undefined;
      sock?.emit('songpyeon:granted', { amount, balance, reason });
    } catch (err) {
      console.warn('[songpyeon:grant] 실패:', (err as Error).message, grant.memberId);
    }
  }
}
