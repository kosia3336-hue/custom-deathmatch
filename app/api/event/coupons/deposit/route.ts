import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** POST /api/event/coupons/deposit { count } — 보유 쿠폰을 쿠폰함에 투입 */
export async function POST(req: Request) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없어요.' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { count?: unknown };
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    return NextResponse.json({ error: '투입할 쿠폰 수가 올바르지 않아요.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('deposit_event_coupons', {
    p_member_id: member.id,
    p_count: count,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    if (msg.includes('box_closed')) {
      return NextResponse.json({ error: '쿠폰함이 닫혀 있어요. 이벤트가 종료되었습니다.' }, { status: 409 });
    }
    if (msg.includes('no_coupons')) {
      return NextResponse.json({ error: '투입할 수 있는 쿠폰이 없어요.' }, { status: 409 });
    }
    console.error('[event/coupons/deposit]', msg);
    return NextResponse.json({ error: '쿠폰 투입에 실패했어요.' }, { status: 500 });
  }

  return NextResponse.json({ deposited: Number(data ?? 0) });
}
