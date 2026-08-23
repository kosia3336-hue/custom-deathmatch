/**
 * 지난 주/월 길드 랭킹 정산. 현재 기간은 건드리지 않는다.
 * 지급은 랭크 종료 시각 01:00~01:59 KST. GET /api/guild2 도 그 시간에만 같은 RPC.
 */
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import { isGuildRankSettleHourKst } from '@shared/rank/kst.js';

const SETTLE_MS = 60_000;

let running = false;
let started = false;

export async function settleDueGuildRanksV4(): Promise<void> {
  if (!isSupabaseConfigured() || running) return;
  running = true;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)('settle_due_guild_ranks_v4', {});
    if (error) {
      console.warn('[guild:rankSettle] 실패(무시):', error.message);
      return;
    }
    const n = typeof data === 'number' ? data : Number(data ?? 0);
    if (n > 0) console.log(`[guild:rankSettle] ${n}개 기간 정산`);
  } catch (err) {
    console.warn('[guild:rankSettle] 호출 실패(무시):', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startGuildRankSettleLoop(): void {
  if (started) return;
  started = true;
  const tick = () => {
    if (!isGuildRankSettleHourKst()) return;
    void settleDueGuildRanksV4();
  };
  tick();
  const t = setInterval(tick, SETTLE_MS);
  t.unref?.();
}
