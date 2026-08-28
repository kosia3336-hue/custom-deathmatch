/**
 * 길드 랭킹 점수 v4 — 양수 재료 M을 인원 보정해서 주간/월간에 더한다.
 * S += M / max(n, 3)^0.65. M ≤ 0 이면 no-op. 미가입이면 RPC no-op.
 */
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';

/** 패배 재료 = 잃은 RP × 이 비율 (승보다 훨씬 적게). */
export const GUILD_RANK_LOSS_RP_RATIO = 0.2;
/** 무승부 고정 재료. GP 무승부(5)와 맞춤. */
export const GUILD_RANK_DRAW_RP = 5;

export function guildRankScoreMaterial(kind: 'win' | 'loss' | 'draw', rpAbs: number): number {
  if (kind === 'draw') return GUILD_RANK_DRAW_RP;
  if (kind === 'win') return Math.max(0, Math.round(rpAbs));
  if (rpAbs <= 0) return 0;
  return Math.max(1, Math.round(rpAbs * GUILD_RANK_LOSS_RP_RATIO));
}

export async function applyGuildRankDeltaV4(memberId: string, rpDelta: number): Promise<void> {
  if (!isSupabaseConfigured() || !memberId || rpDelta <= 0) return;
  const sb = getSupabaseAdmin();
  try {
    const { error } = await (sb.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)('apply_guild_rank_delta_v4', {
      p_member: memberId,
      p_rp_delta: rpDelta,
    });
    if (error) console.warn('[guild:rankDelta] 적립 실패(무시):', error.message);
  } catch (err) {
    console.warn('[guild:rankDelta] 적립 호출 실패(무시):', (err as Error).message);
  }
}
