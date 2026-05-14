import { NextResponse } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { callRpc } from '@/lib/supabase/rpc';

export async function POST(req: Request) {
  const admin = await requireAdminMember();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: 'service_role not configured' }, { status: 503 });
  }

  let body: { memberId?: string; seasonId?: number; delta?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const memberId = body.memberId;
  const seasonId = Number(body.seasonId);
  const delta = Number(body.delta);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!memberId || !reason || reason.length < 3) {
    return NextResponse.json({ error: 'memberId 및 사유(3자 이상)가 필요합니다.' }, { status: 400 });
  }
  if (!Number.isFinite(seasonId) || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: 'seasonId 및 변경량(delta)이 필요합니다.' }, { status: 400 });
  }

  try {
    const sb = getSupabaseServiceRole();
    await callRpc(sb, 'admin_adjust_rank_rp', {
      p_actor_id: admin.id,
      p_member_id: memberId,
      p_season_id: seasonId,
      p_delta: Math.trunc(delta),
      p_reason: reason,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
