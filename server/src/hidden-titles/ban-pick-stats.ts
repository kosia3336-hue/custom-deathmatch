/**
 * 멀티 밴픽 추첨 후 실게임 승리 통계 (히든 전략가).
 */
import { getSupabaseAdmin } from '../db/supabase.js';

export async function incrementBanPickMultiWin(memberId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.rpc as any)('increment_ban_pick_multi_win', {
    p_member_id: memberId,
  });
  if (error) {
    console.warn('[hidden-titles] increment_ban_pick_multi_win:', error.message);
  }
}

export async function getBanPickMultiWinTotal(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('ban_pick_multi_wins')
    .select('wins')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) {
    console.warn('[hidden-titles] ban_pick_multi_wins select:', error.message);
    return 0;
  }
  return (data as { wins?: number } | null)?.wins ?? 0;
}
