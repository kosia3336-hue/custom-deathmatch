import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';

/** 현재 시즌 + 본인 rank_stats (테이블 미구성 시 빈 응답) */
export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  try {
    const { data: season, error: seasonErr } = await db
      .from('rank_seasons')
      .select('id, name, started_at, ended_at')
      .eq('is_active', true)
      .maybeSingle();

    if (seasonErr || !season) {
      return NextResponse.json({ season: null, stats: null });
    }

    const { data: stats, error: statsErr } = await db
      .from('rank_stats')
      .select(
        'tier, rp, placement_done, placement_games, placement_wins, win_streak, loss_streak, season_wins, season_losses, season_draws, season_peak_tier',
      )
      .eq('season_id', season.id)
      .eq('member_id', member.id)
      .maybeSingle();

    if (statsErr) {
      return NextResponse.json({ season: null, stats: null });
    }

    return NextResponse.json({ season, stats: stats ?? null });
  } catch {
    return NextResponse.json({ season: null, stats: null });
  }
}
