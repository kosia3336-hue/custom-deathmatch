import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { SKIN_REGISTRY } from '@/lib/skins/registry';
import { LEGEND_TITLE_ID } from './constants';
import type { PoolContext, PoolEffectItem, ShopTitlePoolItem } from './types';
import { CHUSEOK_LIMITED_SKIN_ID } from '@shared/event/chuseok';
import { CHUSEOK_TITLE_EFFECTS } from '@shared/titles/chuseok-effects';

export async function loadPoolContext(
  sb: SupabaseClient,
  memberId: string,
): Promise<PoolContext> {
  let legendClaimedGlobally = false;
  try {
    const claimRes = await sb
      .from('gacha_global_claims')
      .select('prize_def_id')
      .eq('prize_def_id', 's_legend_mystery')
      .maybeSingle();
    legendClaimedGlobally = Boolean(claimRes.data);
  } catch {
    legendClaimedGlobally = false;
  }

  const [
    skinsRes,
    memberSkinsRes,
    titlesRes,
    memberTitlesRes,
    shopTitlesRes,
    legendTitleRes,
    effectDefsRes,
    claimedEffectsRes,
    memberEffectsRes,
  ] = await Promise.all([
    sb.from('skins').select('id').eq('is_active', true),
    sb.from('member_skins').select('skin_id, expires_at').eq('member_id', memberId).is('revoked_at', null),
    sb.from('titles').select('id, name, color, effect'),
    sb.from('member_titles').select('title_id').eq('member_id', memberId).is('revoked_at', null),
    sb.from('shop_items').select('payload, sort_order').eq('type', 'title'),
    sb.from('titles').select('id, name, color, effect, description').eq('id', LEGEND_TITLE_ID).maybeSingle(),
    sb.from('title_effect_defs').select('id, key, name').eq('is_active', true),
    sb.rpc('shop_permanently_claimed_effect_ids'),
    sb
      .from('member_title_effects')
      .select('effect_id')
      .eq('member_id', memberId)
      .is('revoked_at', null)
      .is('expires_at', null),
  ]);

  let allActiveSkinIds = ((skinsRes.data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (allActiveSkinIds.length === 0) {
    allActiveSkinIds = Object.keys(SKIN_REGISTRY);
  }
  allActiveSkinIds = allActiveSkinIds.filter((id) => id !== CHUSEOK_LIMITED_SKIN_ID);
  const permanentSkinIds = new Set<string>();
  for (const row of (memberSkinsRes.data ?? []) as Array<{ skin_id: string; expires_at: string | null }>) {
    if (row.expires_at === null) permanentSkinIds.add(row.skin_id);
  }
  const eligibleSkinIds = allActiveSkinIds.filter((id) => !permanentSkinIds.has(id));

  const titleMap = new Map<string, ShopTitlePoolItem>();
  for (const t of (titlesRes.data ?? []) as Array<{ id: string; name: string; color: string; effect: string | null }>) {
    titleMap.set(t.id, { id: t.id, name: t.name, color: t.color, effect: t.effect });
  }

  const biasTitleRows: Array<{ titleId: string; sortOrder: number }> = [];
  for (const row of (shopTitlesRes.data ?? []) as Array<{
    payload: Record<string, unknown> | null;
    sort_order: number;
  }>) {
    const p = row.payload ?? {};
    if (p.subtype === 'special' || p.kind === 'first_merchant') continue;
    if (p.subtype !== 'bias') continue;
    const tid = p.title_id;
    if (typeof tid === 'string' && tid) {
      biasTitleRows.push({ titleId: tid, sortOrder: row.sort_order ?? 0 });
    }
  }
  biasTitleRows.sort((a, b) => a.sortOrder - b.sortOrder);

  const allBiasTitles: ShopTitlePoolItem[] = [];
  for (const { titleId } of biasTitleRows) {
    const t = titleMap.get(titleId);
    if (t) allBiasTitles.push(t);
  }

  const ownedTitleIds = new Set(
    ((memberTitlesRes.data ?? []) as Array<{ title_id: string }>).map((r) => r.title_id),
  );
  const eligibleTitleIds = allBiasTitles.filter((t) => !ownedTitleIds.has(t.id));

  const chuseokEffectKeys = new Set<string>(CHUSEOK_TITLE_EFFECTS.map((effect) => effect.key));
  const allActiveEffects: PoolEffectItem[] = (
    (effectDefsRes.data ?? []) as Array<{ id: string; key: string; name: string }>
  )
    .filter((r) => !chuseokEffectKeys.has(r.key))
    .map((r) => ({ id: r.id, key: r.key, name: r.name }));
  const claimedEffectIds = new Set(
    ((claimedEffectsRes.data ?? []) as Array<{ effect_id: string }>).map((r) => r.effect_id),
  );
  const myPermanentEffectIds = new Set(
    ((memberEffectsRes.data ?? []) as Array<{ effect_id: string }>).map((r) => r.effect_id),
  );
  const eligibleEffects = allActiveEffects.filter(
    (e) => !claimedEffectIds.has(e.id) && !myPermanentEffectIds.has(e.id),
  );

  const lt = legendTitleRes.data as {
    id: string;
    name: string;
    color: string;
    effect: string | null;
    description: string | null;
  } | null;

  return {
    memberId,
    legendClaimedGlobally,
    permanentSkinIds,
    ownedTitleIds,
    allActiveSkinIds,
    eligibleSkinIds,
    allBiasTitles,
    eligibleTitleIds,
    allActiveEffects,
    claimedEffectIds,
    eligibleEffects,
    legendTitle: lt
      ? { id: lt.id, name: lt.name, color: lt.color, effect: lt.effect, description: lt.description }
      : {
          // titles 조회가 비었을 때만 쓰는 폴백. LEGEND_TITLE_ID 와 같이 움직인다.
          id: LEGEND_TITLE_ID,
          name: '홍련의 주작',
          color: 'red',
          effect: 'jujak',
          description: null,
        },
  };
}
