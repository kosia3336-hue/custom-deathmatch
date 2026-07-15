import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyCdpAdjusted, notifyInventoryUpdated } from '@/lib/cdp/notify';
import type { ConsumableKind } from '@/lib/cdp/types';

export const dynamic = 'force-dynamic';

/** 판매 가능한 소모성 종류 (상점에서 구입 가능한 6종) */
const SELLABLE_KINDS: readonly ConsumableKind[] = [
  'nickname_change',
  'rank_reset',
  'spectator_lock',
  'anonymity',
  'magnifier',
  'ban_eraser',
];

interface SellBody {
  kind?: string;
  quantity?: number;
}

interface SellRpcRow {
  refund: number;
  unit_refund: number;
  new_balance: number;
  count_after: number;
}

/**
 * POST /api/shop/sell
 * body: { kind: ConsumableKind, quantity?: number }
 * 소모성 아이템을 상점 가격의 80%로 판매하고 CDP 환급.
 */
export async function POST(req: NextRequest) {
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

  let body: SellBody;
  try {
    body = (await req.json()) as SellBody;
  } catch {
    return NextResponse.json(
      { error: '잘못된 요청이에요.', code: 'invalid_request' as const },
      { status: 400 },
    );
  }

  const kind = String(body.kind ?? '').trim() as ConsumableKind;
  if (!SELLABLE_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: '판매할 수 없는 아이템이에요.', code: 'invalid_request' as const },
      { status: 400 },
    );
  }

  const quantity = Math.trunc(Number(body.quantity ?? 1));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
    return NextResponse.json(
      { error: '판매 수량이 올바르지 않아요.', code: 'invalid_request' as const },
      { status: 400 },
    );
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('sell_shop_item', {
    p_member_id: member.id,
    p_kind: kind,
    p_quantity: quantity,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    if (msg.includes('not_enough')) {
      return NextResponse.json(
        { error: '보유 수량이 부족해요.', code: 'not_enough' as const },
        { status: 409 },
      );
    }
    if (msg.includes('item_not_found')) {
      return NextResponse.json(
        { error: '판매 가격을 찾을 수 없어요. (판매 종료된 아이템)', code: 'item_not_found' as const },
        { status: 404 },
      );
    }
    console.warn(`[shop:sell] 실패 member=${member.id} kind=${kind} msg=${msg}`);
    return NextResponse.json(
      { error: '판매 중 오류가 발생했어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  const row: SellRpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      { error: '판매 응답이 비었어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  console.log(
    `[shop:sell] member=${member.id} kind=${kind} qty=${quantity} refund=${row.refund} newBalance=${row.new_balance} countAfter=${row.count_after}`,
  );

  // 소켓 통보 (실패 무시)
  void notifyCdpAdjusted({
    memberId: member.id,
    newBalance: Number(row.new_balance),
    delta: Number(row.refund),
    reason: 'shop_sell',
    ref: { kind: 'shop_sell', id: kind },
  });
  void notifyInventoryUpdated({
    memberId: member.id,
    kind,
    countAfter: Number(row.count_after),
    reason: 'sell',
    ref: { kind: 'shop_sell', id: kind },
  });

  return NextResponse.json({
    ok: true,
    refund: Number(row.refund),
    unitRefund: Number(row.unit_refund),
    newBalance: Number(row.new_balance),
    countAfter: Number(row.count_after),
  });
}
