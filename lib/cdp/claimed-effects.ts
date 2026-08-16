import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/** 개발자(천하)를 제외하고, 누군가 영구 보유 중인 이펙트 ID. */
export async function loadPermanentlyClaimedEffectIds(
  sb: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await sb.rpc('shop_permanently_claimed_effect_ids');
  if (error || !data) return [];
  const rows = (Array.isArray(data) ? data : [data]) as Array<{ effect_id: string }>;
  return rows.map((r) => r.effect_id);
}
