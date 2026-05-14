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

  let body: { seasonId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const seasonId = Number(body.seasonId);
  if (!Number.isFinite(seasonId)) {
    return NextResponse.json({ error: 'seasonId required' }, { status: 400 });
  }

  try {
    const sb = getSupabaseServiceRole();
    await callRpc(sb, 'admin_end_season', { p_season_id: seasonId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
