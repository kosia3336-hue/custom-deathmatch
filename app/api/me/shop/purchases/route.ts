import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { parsePageParam, getRange, getTotalPages } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;

interface PurchaseRow {
  id: string;
  item_id: string;
  price_paid: number;
  name_snapshot: string;
  type_snapshot: string;
  purchased_at: string;
}

/**
 * GET /api/me/shop/purchases?page=N — 본인 구매 내역.
 */
export async function GET(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ rows: [], totalCount: 0, totalPages: 0, page: 1 });
  }

  const page = parsePageParam(req.nextUrl.searchParams.get('page') ?? undefined);
  const { from, to } = getRange(page, PAGE_SIZE);

  try {
    const sb = await getServerSupabase();
    const { data, count, error } = await sb
      .from('shop_purchases')
      .select('id, item_id, price_paid, name_snapshot, type_snapshot, purchased_at', {
        count: 'exact',
      })
      .eq('member_id', member.id)
      .order('purchased_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ rows: [], totalCount: 0, totalPages: 0, page });
    }

    const rows = (data as unknown as PurchaseRow[] | null) ?? [];
    const totalCount = typeof count === 'number' ? count : 0;

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        name: r.name_snapshot,
        type: r.type_snapshot,
        pricePaid: Number(r.price_paid),
        purchasedAt: r.purchased_at,
      })),
      totalCount,
      totalPages: getTotalPages(totalCount, PAGE_SIZE),
      page,
    });
  } catch {
    return NextResponse.json({ rows: [], totalCount: 0, totalPages: 0, page });
  }
}
