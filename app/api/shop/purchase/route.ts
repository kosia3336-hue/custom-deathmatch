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
import { hasMerchantDiscount } from '@/lib/cdp/merchant';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface PurchaseBody {
  itemId?: string;
  /** 소모품 수량 (기본 1, 1~99) */
  quantity?: number;
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
  const quantity = Math.floor(Number(body.quantity ?? 1));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
    return NextResponse.json(
      { error: '수량은 1~99개까지 가능해요.', code: 'invalid_request' as const },
      { status: 400 },
    );
  }

  const sb = getSupabaseServiceRole();

  // ── 이벤트 칩 팩 분기: purchase_event_chip_pack RPC 호출 ─────────────
  // shop_items.payload.kind === 'event_chip_pack' 이면 별도 처리 (이중 거래 ledger 기록)
  try {
    const { data: itemRow } = await sb
      .from('shop_items')
      .select('id, type, payload')
      .eq('id', itemId)
      .maybeSingle();
    const payload = (itemRow as { payload?: { kind?: string } } | null)?.payload ?? {};

    // 길드 창설권: 길드 가입자는 구매 불가
    if (payload.kind === 'guild_charter') {
      const { data: gm } = await sb
        .from('guild_members')
        .select('guild_id')
        .eq('member_id', member.id)
        .maybeSingle();
      if (gm) {
        return NextResponse.json(
          {
            error: '이미 길드에 가입되어 있어 창설권을 구매할 수 없어요.',
            code: 'forbidden' as const,
          },
          { status: 409 },
        );
      }
    }

    // ── 소모품: 수량 구매 RPC (대량 할인 5개↑10% / 20개↑20% + 거상 10%) ──
    const itemType = (itemRow as { type?: string } | null)?.type;
    if (itemType === 'consumable' && payload.kind !== 'event_chip_pack') {
      const merchant = await hasMerchantDiscount(sb, member.id).catch(() => false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cqData, error: cqErr } = await (sb.rpc as any)('purchase_consumable_qty', {
        p_member_id: member.id,
        p_item_id: itemId,
        p_quantity: quantity,
        p_merchant: merchant,
      });
      if (cqErr) {
        const mapped = mapRpcError((cqErr as { message?: string }).message ?? '');
        console.warn(`[shop:purchase:qty] 실패 code=${mapped.code} member=${member.id} item=${itemId} qty=${quantity}`);
        return NextResponse.json({ error: mapped.msg, code: mapped.code }, { status: mapped.status });
      }
      const cq = (Array.isArray(cqData) ? cqData[0] : cqData) as {
        purchase_id: string;
        new_balance: number;
        price_paid: number;
        price_original: number;
        discount_applied: number;
        consumable_kind: string;
        consumable_added: number;
        count_after: number;
        stock_after: number | null;
      };
      console.log(
        `[shop:purchase:qty] member=${member.id} item=${itemId} qty=${quantity} price=${cq.price_paid}/${cq.price_original} newBalance=${cq.new_balance}`,
      );

      void notifyCdpAdjusted({
        memberId: member.id,
        newBalance: Number(cq.new_balance),
        delta: -Number(cq.price_paid),
        reason: 'shop_purchase',
        ref: { kind: 'shop_purchase', id: cq.purchase_id },
      });
      void notifyShopItemChanged({ itemId, stock: cq.stock_after, isActive: true });
      void notifyInventoryUpdated({
        memberId: member.id,
        kind: cq.consumable_kind as ConsumableKind,
        countAfter: Number(cq.count_after),
        reason: 'purchase',
        ref: { kind: 'shop_purchase', id: cq.purchase_id },
      });

      return NextResponse.json({
        ok: true,
        newBalance: Number(cq.new_balance),
        pricePaid: Number(cq.price_paid),
        priceOriginal: Number(cq.price_original),
        discountApplied: Number(cq.discount_applied),
        stockAfter: cq.stock_after,
        grantedTitleId: null,
        consumableKind: cq.consumable_kind as ConsumableKind,
        consumableAdded: Number(cq.consumable_added),
      });
    }

    if (payload.kind === 'event_chip_pack') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: epData, error: epErr } = await (sb.rpc as any)('purchase_event_chip_pack', {
        p_member_id: member.id,
        p_shop_item_id: itemId,
      });
      if (epErr) {
        const msg = (epErr as { message?: string }).message ?? '';
        let code: PurchaseErrorCode = 'internal_error';
        let userMsg = '구매 중 오류가 발생했어요.';
        let status = 500;
        if (msg.includes('insufficient_balance')) {
          code = 'insufficient_balance';
          userMsg = 'CDP가 부족해요.';
          status = 402;
        } else if (msg.includes('item_not_found')) {
          code = 'item_not_found';
          userMsg = '아이템을 찾을 수 없어요.';
          status = 404;
        }
        console.warn(
          `[shop:purchase:event_chip] 실패 ${code} member=${member.id} item=${itemId} msg=${msg}`,
        );
        return NextResponse.json({ error: userMsg, code }, { status });
      }
      const epRow = (Array.isArray(epData) ? epData[0] : epData) as {
        new_cdp_balance: number;
        new_chip_balance: number;
        granted_chips: number;
        price_paid: number;
      };
      console.log(
        `[shop:purchase:event_chip] member=${member.id} chips=+${epRow.granted_chips} cdp=-${epRow.price_paid} newCdp=${epRow.new_cdp_balance} newChip=${epRow.new_chip_balance}`,
      );

      void notifyCdpAdjusted({
        memberId: member.id,
        newBalance: Number(epRow.new_cdp_balance),
        delta: -Number(epRow.price_paid),
        reason: 'shop_purchase',
        ref: { kind: 'event_chip_pack', id: itemId },
      });

      return NextResponse.json({
        ok: true,
        kind: 'event_chip_pack',
        newBalance: Number(epRow.new_cdp_balance),
        pricePaid: Number(epRow.price_paid),
        priceOriginal: Number(epRow.price_paid),
        discountApplied: 0,
        stockAfter: null,
        grantedChips: Number(epRow.granted_chips),
        newChipBalance: Number(epRow.new_chip_balance),
        grantedTitleId: null,
        consumableKind: null,
        consumableAdded: 0,
      });
    }
  } catch (err) {
    console.warn('[shop:purchase] event chip 분기 검사 실패:', (err as Error).message);
    // 실패해도 기본 흐름으로 진행
  }

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
    // 수집가 연쇄 체크 — 상점 칭호 구매로 5개 이상이 됐을 수 있음
    void notifyHiddenTitleCheck('title_granted', member.id);
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
