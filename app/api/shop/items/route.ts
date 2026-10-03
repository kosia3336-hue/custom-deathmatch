import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { ShopItem } from '@/lib/cdp/types';
import { isDevOnlyShopItem } from '@/lib/cdp/shop-filter';

export const dynamic = 'force-dynamic';

interface ShopItemRowSel {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  is_active: boolean;
  is_limited: boolean;
  payload: Record<string, unknown> | null;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
}

/**
 * GET /api/shop/items?type= — 활성 상점 아이템 목록.
 *  - 비로그인도 호출 가능하지만 /shop 페이지는 middleware 가 차단.
 *  - 비활성 / 시간대 만료 / 시작 전 아이템은 제외.
 *  - 품절 아이템은 노출하되 클라이언트에서 disabled 처리.
 */
export async function GET(req: NextRequest) {
  const typeFilter = req.nextUrl.searchParams.get('type')?.trim();
  const nowIso = new Date().toISOString();

  try {
    const sb = await getServerSupabase();
    let q = sb
      .from('shop_items')
      .select(
        'id, type, name, description, price, stock, is_active, is_limited, payload, available_from, available_until, sort_order',
      )
      .eq('is_active', true)
      .or(`available_from.is.null,available_from.lte.${nowIso}`)
      .or(`available_until.is.null,available_until.gt.${nowIso}`)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (typeFilter && /^[a-z][a-z0-9_]{0,31}$/.test(typeFilter)) {
      q = q.eq('type', typeFilter);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ items: [] });
    }

    const rows = ((data as unknown as ShopItemRowSel[] | null) ?? []).filter(
      (r) => !isDevOnlyShopItem({ payload: r.payload ?? {} }),
    );
    const items: ShopItem[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      description: r.description ?? '',
      price: Number(r.price),
      stock: r.stock,
      isActive: r.is_active,
      isLimited: r.is_limited,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      availableFrom: r.available_from,
      availableUntil: r.available_until,
      sortOrder: Number(r.sort_order),
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
