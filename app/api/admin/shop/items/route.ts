import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyInvalidateBiasTitles } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

const TYPE_RE = /^[a-z][a-z0-9_]{0,31}$/;

interface CreateBody {
  type?: string;
  name?: string;
  description?: string;
  price?: number | string;
  payload?: Record<string, unknown>;
  /** 빈 문자열도 허용 (폼에서 입력 안 한 경우) */
  stock?: number | string | null;
  isActive?: boolean;
  isLimited?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  sortOrder?: number | string;
}

function err(msg: string, status = 400, code?: string) {
  return NextResponse.json({ error: msg, ...(code ? { code } : {}) }, { status });
}

/** GET /api/admin/shop/items — 어드민용 전체 목록 (활성/비활성 모두) */
export async function GET() {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403, 'forbidden');
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없어요.', 503);

  try {
    const sb = getSupabaseServiceRole();
    const { data, error } = await sb
      .from('shop_items')
      .select(
        'id, type, name, description, price, stock, is_active, is_limited, payload, available_from, available_until, sort_order, created_at, updated_at',
      )
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return err('목록 조회 실패', 500);
    return NextResponse.json({ items: data ?? [] });
  } catch {
    return err('목록 조회 실패', 500);
  }
}

/** POST /api/admin/shop/items — 새 아이템 생성 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403, 'forbidden');
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없어요.', 503);

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return err('잘못된 JSON');
  }

  const type = String(body.type ?? '').trim();
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const price = Number(body.price);
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const stockRaw = body.stock;
  const stock =
    stockRaw === null || stockRaw === undefined || stockRaw === ''
      ? null
      : Number(stockRaw);
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  const isLimited = Boolean(body.isLimited);
  const availableFrom = body.availableFrom || null;
  const availableUntil = body.availableUntil || null;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!TYPE_RE.test(type)) return err('type 은 영문 소문자/언더스코어 1~32자.');
  if (name.length < 1 || name.length > 60) return err('name 은 1~60 자.');
  if (description.length > 500) return err('설명은 500자 이하.');
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000)
    return err('price 는 0~1,000,000 정수.');
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000))
    return err('stock 은 비우거나 0~1,000,000 정수.');
  if (availableFrom && availableUntil && new Date(availableFrom) >= new Date(availableUntil))
    return err('availableFrom < availableUntil');

  try {
    const sb = getSupabaseServiceRole();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('admin_create_shop_item', {
      p_actor_id: admin.id,
      p_type: type,
      p_name: name,
      p_description: description,
      p_price: price,
      p_payload: payload,
      p_stock: stock,
      p_is_active: isActive,
      p_is_limited: isLimited,
      p_available_from: availableFrom,
      p_available_until: availableUntil,
      p_sort_order: sortOrder,
    });
    if (error) {
      console.warn('[admin/shop/items] create 실패', error.message);
      return err('생성 실패', 500);
    }
    const itemId = typeof data === 'string' ? data : Array.isArray(data) ? data[0] : data;
    // bias 칭호일 가능성이 있으면 캐시 무효화 — 비용이 작아 무조건 호출.
    if (type === 'title' && (payload as { subtype?: string }).subtype === 'bias') {
      void notifyInvalidateBiasTitles();
    }
    return NextResponse.json({ ok: true, itemId });
  } catch (e) {
    console.warn('[admin/shop/items] exception', (e as Error).message);
    return err('생성 실패', 500);
  }
}
