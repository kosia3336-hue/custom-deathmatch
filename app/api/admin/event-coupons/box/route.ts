import { NextResponse } from 'next/server';
import { getAuthState } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** POST /api/admin/event-coupons/box { isOpen } — 쿠폰함 열기/닫기 (관리자) */
export async function POST(req: Request) {
  const auth = await getAuthState();
  if (auth.kind !== 'ACTIVE' || auth.member.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { isOpen?: unknown };
  if (typeof body.isOpen !== 'boolean') {
    return NextResponse.json({ error: 'isOpen(boolean)이 필요합니다.' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;
  const { error } = await db
    .from('event_coupon_box')
    .update({ is_open: body.isOpen, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    console.error('[admin/event-coupons/box]', error.message);
    return NextResponse.json({ error: '쿠폰함 상태 변경에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ isOpen: body.isOpen });
}
