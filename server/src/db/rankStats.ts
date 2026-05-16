import type { RankTier } from '@shared/types/rank.js';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

export interface RankStatsSnapshot {
  tier: RankTier;
  rp: number;
  placement_done: boolean;
  placement_games: number;
  placement_wins: number;
  win_streak: number;
  loss_streak: number;
}

function asTier(v: string): RankTier {
  if (
    v === 'unranked'
    || v === 'bronze'
    || v === 'silver'
    || v === 'gold'
    || v === 'diamond'
    || v === 'challenger'
  ) {
    return v;
  }
  return 'unranked';
}

export async function getActiveSeasonId(): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('rank_seasons').select('id').eq('is_active', true).maybeSingle();
  if (error || !data) return null;
  return data.id as number;
}

/**
 * 활성 시즌의 rank_stats 조회. 없으면 기본 행 insert 후 반환.
 */
export async function ensureRankStatsRow(memberId: string): Promise<
  | { ok: true; seasonId: number; stats: RankStatsSnapshot }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) return { ok: false, error: '서버 DB 설정이 없습니다.' };

  const seasonId = await getActiveSeasonId();
  if (seasonId == null) return { ok: false, error: '진행 중인 랭크 시즌이 없습니다.' };

  const sb = getSupabaseAdmin();

  const first = await sb
    .from('rank_stats')
    .select(
      'tier, rp, placement_done, placement_games, placement_wins, win_streak, loss_streak',
    )
    .eq('season_id', seasonId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (first.error) return { ok: false, error: first.error.message };

  if (first.data) {
    const row = first.data as Record<string, unknown>;
    return {
      ok: true,
      seasonId,
      stats: {
        tier: asTier(String(row.tier)),
        rp: Number(row.rp ?? 0),
        placement_done: Boolean(row.placement_done),
        placement_games: Number(row.placement_games ?? 0),
        placement_wins: Number(row.placement_wins ?? 0),
        win_streak: Number(row.win_streak ?? 0),
        loss_streak: Number(row.loss_streak ?? 0),
      },
    };
  }

  const ins = await sb
    .from('rank_stats')
    .insert({ season_id: seasonId, member_id: memberId })
    .select(
      'tier, rp, placement_done, placement_games, placement_wins, win_streak, loss_streak',
    )
    .single();

  if (ins.error) return { ok: false, error: ins.error.message };

  const row = ins.data as Record<string, unknown>;
  return {
    ok: true,
    seasonId,
    stats: {
      tier: asTier(String(row.tier)),
      rp: Number(row.rp ?? 0),
      placement_done: Boolean(row.placement_done),
      placement_games: Number(row.placement_games ?? 0),
      placement_wins: Number(row.placement_wins ?? 0),
      win_streak: Number(row.win_streak ?? 0),
      loss_streak: Number(row.loss_streak ?? 0),
    },
  };
}
