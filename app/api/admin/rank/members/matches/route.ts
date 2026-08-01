import { NextResponse } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import { getServerSupabase } from '@/lib/supabase/server';

/** 특정 회원의 최근 랭크 전적 조회 (기본 활성 시즌, 최대 20건) */
export async function POST(req: Request) {
  const admin = await requireAdminMember();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { memberId?: string; seasonId?: number; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const memberId = body.memberId;
  if (!memberId) {
    return NextResponse.json({ error: 'memberId 가 필요합니다.' }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  let seasonId = Number(body.seasonId);
  if (!Number.isFinite(seasonId)) {
    const { data: season } = await db
      .from('rank_seasons')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    if (!season) {
      return NextResponse.json({ error: '활성 시즌이 없습니다.', rows: [] }, { status: 400 });
    }
    seasonId = season.id as number;
  }

  const { data, error } = await db
    .from('rank_match_history')
    .select(
      'id, season_id, winner_id, loser_id, winner_rp_gain, loser_rp_loss, winner_promoted, loser_demoted, game_id, is_forfeit, played_at',
    )
    .eq('season_id', seasonId)
    .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`)
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];

  // 상대 닉네임 붙이기
  const opponentIds = Array.from(
    new Set(
      rows.map((r) => (r.winner_id === memberId ? String(r.loser_id) : String(r.winner_id))),
    ),
  );
  const nameMap = new Map<string, string>();
  if (opponentIds.length > 0) {
    const { data: members } = await db
      .from('members')
      .select('id, nickname')
      .in('id', opponentIds);
    (members ?? []).forEach((m: { id: string; nickname: string }) =>
      nameMap.set(m.id, m.nickname),
    );
  }

  return NextResponse.json({
    seasonId,
    rows: rows.map((r) => {
      const won = r.winner_id === memberId;
      const opponentId = won ? String(r.loser_id) : String(r.winner_id);
      return {
        id: String(r.id),
        playedAt: String(r.played_at),
        result: won ? ('win' as const) : ('loss' as const),
        rpDelta: won ? Number(r.winner_rp_gain) : -Number(r.loser_rp_loss),
        tierChanged: won ? Boolean(r.winner_promoted) : Boolean(r.loser_demoted),
        gameId: String(r.game_id),
        isForfeit: Boolean(r.is_forfeit),
        opponentId,
        opponentName: nameMap.get(opponentId) ?? '(탈퇴)',
      };
    }),
  });
}
