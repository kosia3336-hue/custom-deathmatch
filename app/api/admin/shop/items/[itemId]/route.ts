import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyInvalidateBiasTitles, notifyShopItemChanged } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface PatchBody {
  name?: string;
  description?: string;
  price?: number | string;
  payload?: Record<string, unknown>;
  /** 빈 문자열도 허용 (폼에서 입력 안 한 경우) */
  stock?: number | string | null;
  isLimited?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  sortOrder?: number | string;
}

interface ItemSel {
  id: string;
  name: string;
  description: string;
  price: number;
  payload: Record<string, unknown> | null;
  stock: number | null;
  is_active: boolean;
  is_limited: boolean;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** PATCH /api/admin/shop/items/[itemId] — 부분 업데이트 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없어요.', 503);

  const { itemId } = await params;
  if (!UUID_RE.test(itemId)) return err('잘못된 itemId');

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return err('잘못된 JSON');
  }

  const sb = getSupabaseServiceRole();

  const { data: cur, error: selErr } = await sb
    .from('shop_items')
    .select(
      'id, name, description, price, payload, stock, is_active, is_limited, available_from, available_until, sort_order',
    )
    .eq('id', itemId)
    .maybeSingle();
  if (selErr || !cur) return err('아이템 없음', 404);
  const c = cur as unknown as ItemSel;

  const name = body.name === undefined ? c.name : String(body.name).trim();
  const description = body.description === undefined ? c.description : String(body.description).trim();
  const price = body.price === undefined ? c.price : Number(body.price);
  const payload = body.payload === undefined ? (c.payload ?? {}) : body.payload;
  const stock =
    body.stock === undefined
      ? c.stock
      : body.stock === null || body.stock === ''
        ? null
        : Number(body.stock);
  const isLimited = body.isLimited === undefined ? c.is_limited : Boolean(body.isLimited);
  const availableFrom =
    body.availableFrom === undefined ? c.available_from : (body.availableFrom || null);
  const availableUntil =
    body.availableUntil === undefined ? c.available_until : (body.availableUntil || null);
  const sortOrder =
    body.sortOrder === undefined ? c.sort_order : Number(body.sortOrder ?? 0);

  if (name.length < 1 || name.length > 60) return err('name 1~60자');
  if (description.length > 500) return err('설명 500자 이하');
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return err('price 범위 오류');
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000))
    return err('stock 범위 오류');
  if (availableFrom && availableUntil && new Date(availableFrom) >= new Date(availableUntil))
    return err('availableFrom < availableUntil');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (sb.rpc as any)('admin_update_shop_item', {
    p_actor_id: admin.id,
    p_item_id: itemId,
    p_name: name,
    p_description: description,
    p_price: price,
    p_payload: payload,
    p_stock: stock,
    p_is_limited: isLimited,
    p_available_from: availableFrom,
    p_available_until: availableUntil,
    p_sort_order: sortOrder,
  });

  if (updErr) {
    console.warn('[admin/shop/items] update 실패', updErr.message);
    return err('수정 실패', 500);
  }

  // 재고 변경 broadcast (stock 이 바뀌었을 때만이라도)
  void notifyShopItemChanged({ itemId, stock, isActive: c.is_active });

  // bias 칭호 변경일 가능성 — 캐시 invalidate.
  const subtypeBefore = (c.payload ?? {}) as { subtype?: string };
  const subtypeAfter = (payload ?? {}) as { subtype?: string };
  if (subtypeBefore.subtype === 'bias' || subtypeAfter.subtype === 'bias') {
    void notifyInvalidateBiasTitles();
  }

  return NextResponse.json({ ok: true });
}
