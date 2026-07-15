/**
 * #3 일일 랭크 승리 보너스 — 하루 첫 승리 1회 100 CDP.
 * claim_daily_rank_win RPC 를 호출하고, 지급됐으면 본인 소켓에 cdp:granted emit.
 * 실패는 무시(결과 화면·매치 CDP 흐름을 막지 않음).
 */
import type { IO } from '../socket/types.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import { sessions } from '../store/sessions.js';

interface DailyRankWinRow {
  granted: boolean;
  cdp_amount: number;
  new_balance: number;
  win_count: number;
  box_granted: boolean;
}

export async function claimDailyRankWin(io: IO | null, memberId: string | null): Promise<void> {
  if (!isSupabaseConfigured() || !memberId) return;
  const sb = getSupabaseAdmin();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('claim_daily_rank_win', {
      p_member_id: memberId,
    });
    if (error) throw error;

    const row: DailyRankWinRow | undefined = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    console.log(
      `[cdp:daily] member=${memberId} granted=${row.granted} amount=${row.cdp_amount} balance=${row.new_balance} winCount=${row.win_count} boxGranted=${row.box_granted}`,
    );

    if ((!row.granted && !row.box_granted) || !io) return;

    const token = sessions.getTokenByMemberId(memberId);
    if (!token) return;
    const sid = sessions.getSocketByToken(token);
    if (!sid) return;
    const sock = io.sockets.sockets.get(sid);
    if (!sock) return;

    // #3 첫 승리 100 CDP
    if (row.granted) {
      sock.emit('cdp:granted', {
        rankMatchId: '',
        amount: Number(row.cdp_amount),
        newBalance: Number(row.new_balance),
        reason: 'daily_rank_win',
        breakdown: { base: Number(row.cdp_amount), tierBonus: 0, tierAtGrant: 'unranked' },
      });
    }

    // #4 하루 5승 뽑기 박스 → 인벤토리 갱신 통보 (박스 잔량 조회)
    if (row.box_granted) {
      const { data: invRow } = await sb
        .from('shop_consumable_inventory')
        .select('count')
        .eq('member_id', memberId)
        .eq('kind', 'gacha_box')
        .maybeSingle();
      sock.emit('inventory:updated', {
        kind: 'gacha_box',
        countAfter: Number((invRow as { count?: number } | null)?.count ?? 0),
        reason: 'daily_reward',
        ref: { kind: 'daily_rank', id: memberId },
      });
    }
  } catch (err) {
    console.warn('[cdp:daily] 실패(무시):', (err as Error).message);
  }
}
