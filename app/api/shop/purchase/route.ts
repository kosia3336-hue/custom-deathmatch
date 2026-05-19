import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import {
  notifyCdpAdjusted,
  notifyHiddenTitleCheck,
  notifyInvalidateBiasTitles,
  notifyInvalidateOwnedTitles,
  notifyInventoryUpdated,
  notifyShopItemChanged,
} from '@/lib/cdp/notify';
import type { ConsumableKind, PurchaseErrorCode } from '@/lib/cdp/types';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface PurchaseBody {
  itemId?: string;
}

interface PurchaseRpcRow {
  purchase_id: string;
  new_balance: number;
  price_paid: number;
  price_original?: number | null;
  discount_applied?: number | null;
  stock_after: number | null;
  granted_title_id: string | null;
  consumable_kind?: ConsumableKind | null;
  consumable_added?: number | null;
}

const ERROR_HTTP: Record<string, { code: PurchaseErrorCode; status: number; msg: string }> = {
  forbidden: { code: 'forbidden', status: 403, msg: '권한이 없습니다.' },
  member_not_active: { code: 'member_not_active', status: 403, msg: '정상 회원만 구매할 수 있어요.' },
  item_not_found: { code: 'item_not_found', status: 404, msg: '아이템을 찾을 수 없어요.' },
  item_inactive: { code: 'item_inactive', status: 409, msg: '판매 종료된 아이템이에요.' },
  item_not_available_yet: {
    code: 'item_not_available_yet',
    status: 409,
    msg: '아직 판매 시작 전이에요.',
  },
  item_expired: { code: 'item_expired', status: 409, msg: '판매가 종료됐어요.' },
  out_of_stock: { code: 'out_of_stock', status: 409, msg: '방금 품절됐어요.' },
  insufficient_balance: {
    code: 'insufficient_balance',
    status: 402,
    msg: 'CDP가 부족해요.',
  },
  already_owned: { code: 'already_owned', status: 409, msg: '이미 보유하고 있어요.' },
};

function mapRpcError(message: string | undefined | null): {
  code: PurchaseErrorCode;
  status: number;
  msg: string;
} {
  if (!message) return { code: 'internal_error', status: 500, msg: '구매 중 오류가 발생했어요.' };
  // PostgREST 는 RAISE EXCEPTION 메시지를 그대로 message 로 노출
  for (const key of Object.keys(ERROR_HTTP)) {
    if (message.includes(key)) return ERROR_HTTP[key]!;
  }
  return { code: 'internal_error', status: 500, msg: '구매 중 오류가 발생했어요.' };
}

/**
 * POST /api/shop/purchase
 * body: { itemId: uuid }
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

  let body: PurchaseBody;
  try {
    body = (await req.json()) as PurchaseBody;
  } catch {
    return NextResponse.json(
      { error: '잘못된 요청이에요.', code: 'invalid_request' as const },
      { status: 400 },
    );
  }

  const itemId = String(body.itemId ?? '').trim();
  if (!UUID_RE.test(itemId)) {
    return NextResponse.json(
      { error: '잘못된 아이템 ID 입니다.', code: 'invalid_request' as const },
      { status: 400 },
    );
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('purchase_shop_item', {
    p_member_id: member.id,
    p_item_id: itemId,
  });

  if (error) {
    const mapped = mapRpcError((error as { message?: string }).message ?? '');
    console.warn(`[shop:purchase] 실패 code=${mapped.code} member=${member.id} item=${itemId}`);
    return NextResponse.json({ error: mapped.msg, code: mapped.code }, { status: mapped.status });
  }

  const row: PurchaseRpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      { error: '구매 응답이 비었어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  const priceOriginal = Number(row.price_original ?? row.price_paid);
  const discountApplied = Number(row.discount_applied ?? 0);
  const consumableKind = (row.consumable_kind ?? null) as ConsumableKind | null;
  const consumableAdded = Number(row.consumable_added ?? 0);

  console.log(
    `[shop:purchase] member=${member.id} item=${itemId} price=${row.price_paid}/${priceOriginal} discount=${discountApplied} newBalance=${row.new_balance} stockAfter=${row.stock_after} kind=${consumableKind ?? '-'} added=${consumableAdded}`,
  );

  // 소켓 통보 (실패 무시)
  void notifyCdpAdjusted({
    memberId: member.id,
    newBalance: Number(row.new_balance),
    delta: -Number(row.price_paid),
    reason: 'shop_purchase',
    ref: { kind: 'shop_purchase', id: row.purchase_id },
  });
  void notifyShopItemChanged({
    itemId,
    stock: row.stock_after,
    isActive: true,
  });

  // 소모성 인벤토리 갱신 통보
  if (consumableKind && consumableAdded > 0) {
    // 구매 후 잔여 수량 — 현재 잔량을 RPC 가 직접 돌려주지 않으므로 한 번 조회.
    try {
      const { data: invRow } = await sb
        .from('shop_consumable_inventory')
        .select('count')
        .eq('member_id', member.id)
        .eq('kind', consumableKind)
        .maybeSingle();
      const countAfter = Number((invRow as { count?: number } | null)?.count ?? 0);
      void notifyInventoryUpdated({
        memberId: member.id,
        kind: consumableKind,
        countAfter,
        reason: 'purchase',
        ref: { kind: 'shop_purchase', id: row.purchase_id },
      });
    } catch (err) {
      console.warn('[shop:purchase] inventory count 조회 실패:', (err as Error).message);
    }
  }

  // 칭호 부여 시 — bias 칭호일 수 있으므로 캐시 invalidate (서버 비용 ↓ 위해 무조건 호출).
  // 그리고 회원의 owned-titles 캐시도 무효화.
  if (row.granted_title_id) {
    void notifyInvalidateBiasTitles();
    void notifyInvalidateOwnedTitles(member.id);
  }

  // 히든 칭호 판정 (플렉스) — fire-and-forget
  void notifyHiddenTitleCheck('shop_purchase', member.id);

  return NextResponse.json({
    ok: true,
    purchaseId: row.purchase_id,
    newBalance: Number(row.new_balance),
    pricePaid: Number(row.price_paid),
    priceOriginal,
    discountApplied,
    stockAfter: row.stock_after,
    grantedTitleId: row.granted_title_id ?? null,
    consumableKind,
    consumableAdded,
  });
}
