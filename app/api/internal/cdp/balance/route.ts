import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal/cdp/balance?dreamshop_user_id=<uuid> — 연동된 회원의 CDP 잔액.
 *
 * 계정 서비스가 **서버 간**으로 호출한다. 브라우저를 거치지 않으므로 키가
 * 노출되지 않는다.
 *
 * 잔액만 돌려준다. 원장(cdp_ledger)·전적은 주지 않고, 차감 API 도 두지 않는다 —
 * CDP 사용은 커스텀 데스매치 안에서만 일어나야 한다.
 */

function authorized(req: Request): boolean {
  const expected = process.env.CDP_READ_KEY ?? '';
  const given = req.headers.get('x-internal-key') ?? '';
  if (expected.length === 0 || given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  } catch {
    return false;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const dreamshopUserId = new URL(req.url).searchParams.get('dreamshop_user_id') ?? '';
  if (!UUID.test(dreamshopUserId)) {
    return NextResponse.json({ error: 'invalid_user_id' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseServiceRole() as any;

  // 연동되지 않은 계정은 조회 자체가 불가
  const { data: link } = await sb
    .from('linked_accounts')
    .select('member_id')
    .eq('dreamshop_user_id', dreamshopUserId)
    .maybeSingle();

  if (!link) {
    return NextResponse.json({ error: 'not_linked' }, { status: 404 });
  }

  const { data: cdp } = await sb
    .from('member_cdp')
    .select('balance')
    .eq('member_id', link.member_id)
    .maybeSingle();

  // 연동은 됐지만 CDP 행이 아직 없는 회원은 0 으로 본다
  return NextResponse.json({ balance: (cdp?.balance as number | undefined) ?? 0 });
}
