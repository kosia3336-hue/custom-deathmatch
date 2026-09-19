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
      'id, played_at, game_id, is_forfeit, winner_id, loser_id, winner_tier, loser_tier, winner_rp_before, winner_rp_after, loser_rp_before, loser_rp_after, winner_rp_gain, loser_rp_loss, winner_promoted, loser_demoted',
    )
    .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`)
    .order('played_at', { ascending: false })
    .limit(10);

  /* game-002 로는 무슨 게임인지 읽을 수 없어 이름을 같이 내려 준다. */
  const rows = (history ?? []) as Record<string, unknown>[];
  const gameIds = Array.from(new Set(rows.map((r) => String(r.game_id))));
  const gameNames: Record<string, string> = {};
  if (gameIds.length > 0) {
    const { data: gameRows } = await db.from('games').select('id, name').in('id', gameIds);
    (gameRows ?? []).forEach((g: { id: string; name: string }) => {
      gameNames[g.id] = g.name;
    });
  }

  return NextResponse.json({
    seasons: seasons ?? [],
    activeSeason,
    stats,
    history: rows,
    gameNames,
  });
}
