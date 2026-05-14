import { NextResponse } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import { getServerSupabase } from '@/lib/supabase/server';

/** 활성 시즌 기준 닉네임 부분 검색 — 최대 30건 */
export async function POST(req: Request) {
  const admin = await requireAdminMember();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const q = (body.query ?? '').trim();
  const safe = q.replace(/%/g, '').replace(/_/g, '').slice(0, 32);
  if (safe.length < 2) {
    return NextResponse.json({ error: '닉네임 2자 이상 입력하세요.' }, { status: 400 });
  }

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: season, error: sErr } = await db
    .from('rank_seasons')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (sErr || !season) {
    return NextResponse.json({ error: '활성 시즌이 없습니다.', rows: [] }, { status: 400 });
  }

  const seasonId = season.id as number;

  const { data: members, error: mErr } = await db
    .from('members')
    .select('id, nickname')
    .ilike('nickname', `%${safe}%`)
    .limit(30);

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 400 });
  }

  const ids = (members ?? []).map((m: { id: string }) => m.id);
  if (ids.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const { data: stats, error: stErr } = await db
    .from('rank_stats')
    .select(
      'member_id, tier, rp, win_streak, loss_streak, placement_done, season_wins, season_losses',
    )
    .eq('season_id', seasonId)
    .in('member_id', ids);

  if (stErr) {
    return NextResponse.json({ error: stErr.message }, { status: 400 });
  }

  const statMap = new Map<string, Record<string, unknown>>(
    (stats ?? []).map((r: Record<string, unknown>) => [r.member_id as string, r]),
  );

  const rows = (members ?? []).map((m: { id: string; nickname: string }) => {
    const st = statMap.get(m.id);
    return {
      memberId: m.id,
      nickname: m.nickname,
      tier: st ? String(st.tier) : null,
      rp: st ? Number(st.rp) : null,
      winStreak: st ? Number(st.win_streak) : null,
      placementDone: st ? Boolean(st.placement_done) : false,
      seasonWins: st ? Number(st.season_wins) : null,
      seasonLosses: st ? Number(st.season_losses) : null,
      missingStats: !st,
    };
  });

  return NextResponse.json({ rows });
}
