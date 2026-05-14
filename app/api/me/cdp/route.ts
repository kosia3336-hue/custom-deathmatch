import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ShopMerchantRow {
  payload: Record<string, unknown> | null;
}

/**
 * GET /api/me/cdp — 본인 잔액 + 누적 통계 + 거상(first_merchant) 활성 여부.
 * - 비로그인 / 비활성 회원은 0,0,0 으로 응답해 GNB 가 안전하게 동작하도록 한다.
 * - merchantDiscount: true 이면 GNB / 상점에서 10% 할인 표시 가능.
 */
export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { balance: 0, totalEarned: 0, totalSpent: 0, merchantDiscount: false },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const sb = await getServerSupabase();

    const [cdpRes, merchantItemsRes, ownedTitlesRes, activeSeasonRes] = await Promise.all([
      sb
        .from('member_cdp')
        .select('balance, total_earned, total_spent')
        .eq('member_id', member.id)
        .maybeSingle(),
      sb
        .from('shop_items')
        .select('payload')
        .eq('type', 'title'),
      sb
        .from('member_titles')
        .select('title_id')
        .eq('member_id', member.id)
        .is('revoked_at', null),
      sb
        .from('rank_seasons')
        .select('id')
        .eq('is_active', true)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const row = (cdpRes.data ?? {}) as { balance?: number; total_earned?: number; total_spent?: number };

    let merchantDiscount = false;
    const seasonId = (activeSeasonRes.data as { id?: number } | null)?.id ?? null;
    if (seasonId !== null) {
      const ownedTitles = new Set(
        ((ownedTitlesRes.data ?? []) as Array<{ title_id: string }>).map((r) => r.title_id),
      );
      for (const it of (merchantItemsRes.data ?? []) as ShopMerchantRow[]) {
        const p = (it.payload ?? {}) as { kind?: string; title_id?: string; season_id?: string | number };
        if (p.kind !== 'first_merchant') continue;
        if (typeof p.title_id !== 'string') continue;
        const sid = typeof p.season_id === 'string' ? Number(p.season_id) : (p.season_id ?? null);
        if (sid !== seasonId) continue;
        if (ownedTitles.has(p.title_id)) {
          merchantDiscount = true;
          break;
        }
      }
    }

    return NextResponse.json(
      {
        balance: Number(row.balance ?? 0),
        totalEarned: Number(row.total_earned ?? 0),
        totalSpent: Number(row.total_spent ?? 0),
        merchantDiscount,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { balance: 0, totalEarned: 0, totalSpent: 0, merchantDiscount: false },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
