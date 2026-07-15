/**
 * 길드 포인트 적립 — 랭크 게임 종료 시 호출.
 * 길드 미가입 회원은 RPC 내부에서 no-op.
 * 적립량: 승리 +10 / 무승부 +5 / 패배 +4 (db/guilds.sql grant_guild_points)
 */
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';

export const GUILD_POINTS = { rankWin: 10, rankDraw: 5, rankLoss: 4 } as const;

export interface GuildPointInput {
  memberId: string;
  amount: number;
  reason: 'rank_win' | 'rank_loss' | 'rank_draw';
  ref?: string | null;
}

export async function grantGuildPoints(inputs: GuildPointInput[]): Promise<void> {
  if (!isSupabaseConfigured() || inputs.length === 0) return;
  const sb = getSupabaseAdmin();

  for (const inp of inputs) {
    if (inp.amount <= 0) continue;
    try {
      const { error } = await (sb.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>)('grant_guild_points', {
        p_member: inp.memberId,
        p_delta: inp.amount,
        p_reason: inp.reason,
        p_ref: inp.ref ?? null,
      });
      if (error && !error.message.includes('function')) {
        console.warn('[guild:points] 적립 실패(무시):', error.message);
      }
    } catch (err) {
      console.warn('[guild:points] 적립 호출 실패(무시):', (err as Error).message);
    }
  }
}
