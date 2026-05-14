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

  let body: { name?: string | null };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = typeof body.name === 'string' ? body.name.trim() || null : null;

  try {
    const sb = getSupabaseServiceRole();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = await callRpc(sb, 'admin_start_season', (name ? { p_name: name } : {}) as any);
    return NextResponse.json({ ok: true, seasonId: id });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
