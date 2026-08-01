import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { notifyCdpAdjusted } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/me/event-chips/exchange
 * body: { chips: number (>=10) }
 *
 * 이벤트 칩 → CDP 역환전 (10% 수수료, 1칩=5CDP 기준).
 * - 반환 CDP = floor(chips × 5 × 0.9)
 * - 최소 환전 단위: 10칩
 */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: '서비스 설정이 없습니다.', code: 'service_unavailable' },
      { status: 503 },
    );
  }

  let body: { chips?: number };
  try {
    body = (await req.json()) as { chips?: number };
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.', code: 'invalid_request' }, { status: 400 });
  }
  const chips = Math.trunc(Number(body.chips ?? 0));
  if (!Number.isFinite(chips) || chips < 10) {
    return NextResponse.json(
      { error: '최소 10칩부터 환전할 수 있습니다.', code: 'below_minimum' },
      { status: 400 },
    );
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('exchange_event_chips_to_cdp', {
    p_member_id: member.id,
    p_chips: chips,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    let code = 'internal_error';
    let userMsg = '환전 중 오류가 발생했습니다.';
    let status = 500;
    if (msg.includes('below_minimum_exchange')) {
      code = 'below_minimum';
      userMsg = '최소 10칩부터 환전할 수 있습니다.';
      status = 400;
    } else if (msg.includes('insufficient_chips')) {
      code = 'insufficient_chips';
      userMsg = '칩이 부족합니다.';
      status = 409;
    } else if (msg.includes('chip_account_not_found')) {
      code = 'no_chip_account';
      userMsg = '환전할 칩이 없습니다.';
      status = 409;
    }
    console.warn(`[api:event-chips:exchange] 실패 ${code} member=${member.id} chips=${chips} msg=${msg}`);
    return NextResponse.json({ error: userMsg, code }, { status });
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    returned_cdp: number;
    fee_cdp: number;
    new_cdp_balance: number;
    new_chip_balance: number;
  };

  console.log(
    `[api:event-chips:exchange] member=${member.id} chips=-${chips} cdp=+${row.returned_cdp} fee=${row.fee_cdp}`,
  );

  // CDP 변동 소켓 통보 (실패 무시)
  void notifyCdpAdjusted({
    memberId: member.id,
    newBalance: Number(row.new_cdp_balance),
    delta: Number(row.returned_cdp),
    reason: 'admin_adjust', // 적절한 reason 추가까지 필요 시 events.ts 확장
    ref: { kind: 'event_chip_exchange', id: `${chips}` },
  });

  return NextResponse.json({
    ok: true,
    chipsExchanged: chips,
    returnedCdp: Number(row.returned_cdp),
    feeCdp: Number(row.fee_cdp),
    newCdpBalance: Number(row.new_cdp_balance),
    newChipBalance: Number(row.new_chip_balance),
  });
}
