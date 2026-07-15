import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyInventoryUpdated } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

interface OpenRpcRow {
  tickets_granted: number;
  box_count_after: number;
  ticket_count_after: number;
}

/**
 * POST /api/shop/gacha-box/open
 * 뽑기 박스 1개를 개봉하여 뽑기권 1~5장을 랜덤 지급.
 */
export async function POST() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { error: '로그인이 필요해요.', code: 'unauthorized' as const },
      { status: 401 },
    );
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: '서비스 설정이 없어요.', code: 'service_unavailable' as const },
      { status: 503 },
    );
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('open_gacha_box', {
    p_member_id: member.id,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    if (msg.includes('no_box')) {
      return NextResponse.json(
        { error: '개봉할 뽑기 박스가 없어요.', code: 'no_box' as const },
        { status: 409 },
      );
    }
    console.warn(`[gacha-box:open] 실패 member=${member.id} msg=${msg}`);
    return NextResponse.json(
      { error: '개봉 중 오류가 발생했어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  const row: OpenRpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      { error: '개봉 응답이 비었어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  console.log(
    `[gacha-box:open] member=${member.id} tickets=+${row.tickets_granted} boxAfter=${row.box_count_after} ticketAfter=${row.ticket_count_after}`,
  );

  // 다른 탭·GNB 인벤 표시 동기화
  void notifyInventoryUpdated({
    memberId: member.id,
    kind: 'gacha_box',
    countAfter: Number(row.box_count_after),
    reason: 'purchase',
    ref: { kind: 'gacha_box_open', id: member.id },
  });
  void notifyInventoryUpdated({
    memberId: member.id,
    kind: 'gacha_ticket',
    countAfter: Number(row.ticket_count_after),
    reason: 'purchase',
    ref: { kind: 'gacha_box_open', id: member.id },
  });

  return NextResponse.json({
    ok: true,
    ticketsGranted: Number(row.tickets_granted),
    boxCountAfter: Number(row.box_count_after),
    ticketCountAfter: Number(row.ticket_count_after),
  });
}
