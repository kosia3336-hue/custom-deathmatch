import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** GET /api/event/coupons — 내 이벤트 쿠폰 현황 + 쿠폰함 상태 */
export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없어요.' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;

  const [{ data: box }, held, deposited] = await Promise.all([
    db.from('event_coupon_box').select('title, is_open').eq('id', 1).maybeSingle(),
    db
      .from('event_coupons')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.id)
      .is('deposited_at', null),
    db
      .from('event_coupons')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.id)
      .not('deposited_at', 'is', null),
  ]);

  return NextResponse.json({
    boxOpen: Boolean(box?.is_open),
    title: box?.title ?? '이벤트 쿠폰함',
    held: held.count ?? 0,
    deposited: deposited.count ?? 0,
  });
}
