/**
 * DB 에서 표시 칭호를 읽어 resolveBadge 로 합성한다.
 * Next / 소켓 서버가 같은 공식을 쓰도록 supabase 클라이언트만 주입한다.
 */

import {
  composeDisplayedTitle,
  isUnexpiredGrant,
  type DisplayedTitleSnapshot,
} from './resolve-badge';

// supabase-js 체인이 환경마다 달라서 조회만 느슨하게 받는다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbLite = { from: (table: string) => any };

export async function loadEquippedEffectKey(
  sb: SbLite,
  memberId: string,
  effectId: string | null,
): Promise<{ key: string } | null> {
  if (!effectId) return null;

  const [defRes, ownRes] = await Promise.all([
    sb.from('title_effect_defs').select('key, is_active').eq('id', effectId).maybeSingle(),
    sb
      .from('member_title_effects')
      .select('id, expires_at')
      .eq('member_id', memberId)
      .eq('effect_id', effectId)
      .is('revoked_at', null)
      .maybeSingle(),
  ]);

  const def = defRes.data as { key: string; is_active: boolean } | null;
  const own = ownRes.data as { id: number; expires_at: string | null } | null;
  if (!def?.is_active || !own || !isUnexpiredGrant(own.expires_at)) return null;
  return { key: def.key };
}

export async function loadResolvedDisplayedTitle(
  sb: SbLite,
  memberId: string,
  displayedTitleId: string | null,
  displayedEffectId: string | null,
): Promise<DisplayedTitleSnapshot | null> {
  if (!displayedTitleId) return null;

  const [titleRes, equipped] = await Promise.all([
    sb
      .from('titles')
      .select('id, name, color, effect, is_legend')
      .eq('id', displayedTitleId)
      .maybeSingle(),
    loadEquippedEffectKey(sb, memberId, displayedEffectId),
  ]);

  const title = titleRes.data as {
    id: string;
    name: string;
    color: string;
    effect: string | null;
    is_legend: boolean;
  } | null;

  return composeDisplayedTitle(title, equipped);
}

export async function loadResolvedDisplayedTitles(
  sb: SbLite,
  members: Array<{
    id: string;
    displayed_title_id: string | null;
    displayed_effect_id: string | null;
  }>,
): Promise<Map<string, DisplayedTitleSnapshot>> {
  const result = new Map<string, DisplayedTitleSnapshot>();
  if (members.length === 0) return result;

  const titleIds = [...new Set(members.map((m) => m.displayed_title_id).filter(Boolean))] as string[];
  const effectIds = [...new Set(members.map((m) => m.displayed_effect_id).filter(Boolean))] as string[];
  const memberIds = members.map((m) => m.id);

  const [titlesRes, defsRes, ownedRes] = await Promise.all([
    titleIds.length > 0
      ? sb.from('titles').select('id, name, color, effect, is_legend').in('id', titleIds)
      : Promise.resolve({ data: [] }),
    effectIds.length > 0
      ? sb.from('title_effect_defs').select('id, key, is_active').in('id', effectIds)
      : Promise.resolve({ data: [] }),
    effectIds.length > 0
      ? sb
          .from('member_title_effects')
          .select('member_id, effect_id, expires_at')
          .in('member_id', memberIds)
          .in('effect_id', effectIds)
          .is('revoked_at', null)
      : Promise.resolve({ data: [] }),
  ]);

  const titlesMap = new Map(
    ((titlesRes.data ?? []) as Array<{
      id: string;
      name: string;
      color: string;
      effect: string | null;
      is_legend: boolean;
    }>).map((t) => [t.id, t]),
  );
  const defsMap = new Map(
    ((defsRes.data ?? []) as Array<{ id: string; key: string; is_active: boolean }>).map((d) => [d.id, d]),
  );
  const owned = new Set(
    ((ownedRes.data ?? []) as Array<{ member_id: string; effect_id: string; expires_at: string | null }>)
      .filter((o) => isUnexpiredGrant(o.expires_at))
      .map((o) => `${o.member_id}:${o.effect_id}`),
  );

  for (const m of members) {
    const title = m.displayed_title_id ? titlesMap.get(m.displayed_title_id) ?? null : null;
    let equipped: { key: string } | null = null;
    if (m.displayed_effect_id) {
      const def = defsMap.get(m.displayed_effect_id);
      if (def?.is_active && owned.has(`${m.id}:${m.displayed_effect_id}`)) {
        equipped = { key: def.key };
      }
    }
    const composed = composeDisplayedTitle(title ?? null, equipped);
    if (composed) result.set(m.id, composed);
  }

  return result;
}
