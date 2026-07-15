import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

/**
 * 거상(first_merchant) 할인 활성 여부.
 * 활성 시즌의 first_merchant 칭호 아이템을 보유 중이면 true.
 * (app/api/me/cdp/route.ts 의 판정 로직과 동일)
 */
export async function hasMerchantDiscount(
  sb: SupabaseClient<Database>,
  memberId: string,
): Promise<boolean> {
  const [merchantItemsRes, ownedTitlesRes, activeSeasonRes] = await Promise.all([
    sb.from('shop_items').select('payload').eq('type', 'title'),
    sb.from('member_titles').select('title_id').eq('member_id', memberId).is('revoked_at', null),
    sb
      .from('rank_seasons')
      .select('id')
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const seasonId = (activeSeasonRes.data as { id?: number } | null)?.id ?? null;
  if (seasonId === null) return false;

  const ownedTitles = new Set(
    ((ownedTitlesRes.data ?? []) as Array<{ title_id: string }>).map((r) => r.title_id),
  );
  for (const it of (merchantItemsRes.data ?? []) as Array<{ payload: Json }>) {
    const p = (it.payload ?? {}) as { kind?: string; title_id?: string; season_id?: string | number };
    if (p.kind !== 'first_merchant') continue;
    if (typeof p.title_id !== 'string') continue;
    const sid = typeof p.season_id === 'string' ? Number(p.season_id) : (p.season_id ?? null);
    if (sid !== seasonId) continue;
    if (ownedTitles.has(p.title_id)) return true;
  }
  return false;
}
