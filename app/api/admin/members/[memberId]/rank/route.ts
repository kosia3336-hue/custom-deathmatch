import { NextResponse } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ memberId: string }> },
) {
  const admin = await requireAdminMember();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { memberId } = await ctx.params;
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: seasons } = await db
    .from('rank_seasons')
    .select('id, name, is_active, started_at, ended_at')
    .order('id', { ascending: false })
    .limit(24);

  const { data: activeSeason } = await db
    .from('rank_seasons')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle();

  let stats: Record<string, unknown> | null = null;
  if (activeSeason) {
    const { data: st } = await db
      .from('rank_stats')
      .select('*')
      .eq('season_id', activeSeason.id)
      .eq('member_id', memberId)
      .maybeSingle();
    stats = st ?? null;
  }

  const { data: history } = await db
    .from('rank_match_history')
    .select(
      'id, played_at, game_id, is_forfeit, winner_id, loser_id, winner_tier, loser_tier, winner_rp_before, winner_rp_after, loser_rp_before, loser_rp_after',
    )
    .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`)
    .order('played_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    seasons: seasons ?? [],
    activeSeason,
    stats,
    history: history ?? [],
  });
}
