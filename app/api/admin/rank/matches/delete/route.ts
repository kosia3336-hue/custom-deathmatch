import { NextResponse } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { recalcAfterMatchDelete, type MatchRow } from '@/lib/rank/recalcAfterMatchDelete';

const MATCH_COLUMNS =
  'id, season_id, winner_id, loser_id, winner_tier, winner_rp_before, winner_rp_gain, winner_promoted, loser_tier, loser_rp_before, loser_rp_loss, loser_demoted, played_at';

/**
 * 랭크 전적 1건 삭제 + 당사자 두 명의 RP·티어·연승/연패·시즌 승패 자동 역산.
 *
 * 역산은 rank_match_history 에 저장된 '경기 직전 스냅샷'에서 출발해
 * 이후 경기를 다시 적용하는 방식이라, 티어 경계를 넘나든 경우에도 값이 맞는다.
 */
export async function POST(req: Request) {
  const admin = await requireAdminMember();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: 'service_role not configured' }, { status: 503 });
  }

  let body: { matchId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const matchId = body.matchId;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!matchId) {
    return NextResponse.json({ error: 'matchId 가 필요합니다.' }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: '삭제 사유를 3자 이상 입력하세요.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  // 1) 삭제 대상 경기
  const { data: target, error: tErr } = await db
    .from('rank_match_history')
    .select(MATCH_COLUMNS)
    .eq('id', matchId)
    .maybeSingle();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });
  if (!target) return NextResponse.json({ error: '해당 전적을 찾을 수 없습니다.' }, { status: 404 });

  const deleted = target as MatchRow;
  const seasonId = Number(deleted.season_id);
  const memberIds = [deleted.winner_id, deleted.loser_id];

  // 2) 변경 전 스냅샷 (되돌릴 때 참고용으로 응답에 포함)
  const { data: beforeStats } = await db
    .from('rank_stats')
    .select('member_id, tier, rp, win_streak, loss_streak, season_wins, season_losses')
    .eq('season_id', seasonId)
    .in('member_id', memberIds);

  // 3) 실제 삭제
  const { error: dErr } = await db.from('rank_match_history').delete().eq('id', matchId);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });

  // 4) 남은 기록으로 두 사람 각각 역산
  const results = [];
  for (const memberId of memberIds) {
    const { data: rest } = await db
      .from('rank_match_history')
      .select(MATCH_COLUMNS)
      .eq('season_id', seasonId)
      .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`)
      .order('played_at', { ascending: true });

    const all = (rest ?? []) as MatchRow[];
    const later = all.filter((m) => m.played_at > deleted.played_at);

    const r = recalcAfterMatchDelete(memberId, deleted, later, all);

    const { error: uErr } = await db
      .from('rank_stats')
      .update({
        tier: r.tier,
        rp: r.rp,
        win_streak: r.winStreak,
        loss_streak: r.lossStreak,
        season_wins: r.seasonWins,
        season_losses: r.seasonLosses,
        updated_at: new Date().toISOString(),
      })
      .eq('season_id', seasonId)
      .eq('member_id', memberId);

    results.push({ ...r, updateError: uErr?.message ?? null });
  }

  return NextResponse.json({
    ok: true,
    seasonId,
    deletedMatch: deleted,
    before: beforeStats ?? [],
    results,
    note: 'season_peak_tier 는 과거 최고 기록이므로 변경하지 않았습니다.',
  });
}
