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

  /*
    연동된 회원 찾기.

    1) linked_accounts — 기존 커데매 회원이 직접 연동한 경우
    2) 그게 없으면, 계정 서비스를 거쳐 만들어진 계정인지 본다.
       그런 계정의 인증 메일은 ds_<드림샵 id>@dreamshop.internal 로 정해져 있어
       연동 기록 없이도 같은 사람임을 알 수 있다. 기록이 늦게 생기더라도
       (가입 완료 시점과 어긋나는 등) 조회가 끊기지 않게 한다.
       확인되면 그 자리에서 연동 기록도 채워 둔다.
  */
  let memberId: string | null = null;

  const { data: link } = await sb
    .from('linked_accounts')
    .select('member_id')
    .eq('dreamshop_user_id', dreamshopUserId)
    .maybeSingle();

  if (link) {
    memberId = link.member_id as string;
  } else {
    const derivedEmail = `ds_${dreamshopUserId}@dreamshop.internal`;
    const { data: list } = await sb.auth.admin.listUsers();
    const authUser = (list?.users ?? []).find(
      (u: { email?: string }) => u.email === derivedEmail,
    );

    if (authUser) {
      const { data: member } = await sb
        .from('members')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (member) {
        memberId = member.id as string;
        // 빠져 있던 연동 기록을 채운다 (경합으로 실패하면 무시)
        await sb
          .from('linked_accounts')
          .insert({
            member_id: memberId,
            dreamshop_user_id: dreamshopUserId,
            linked_via: 'explicit',
          })
          .then(
            () => undefined,
            () => undefined,
          );
      }
    }
  }

  if (!memberId) {
    return NextResponse.json({ error: 'not_linked' }, { status: 404 });
  }

  const { data: cdp } = await sb
    .from('member_cdp')
    .select('balance')
    .eq('member_id', memberId)
    .maybeSingle();

  // 연동은 됐지만 CDP 행이 아직 없는 회원은 0 으로 본다
  return NextResponse.json({ balance: (cdp?.balance as number | undefined) ?? 0 });
}
