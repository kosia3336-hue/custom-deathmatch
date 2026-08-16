/**
 * 칭호 + 이펙트 합성.
 *
 * 레전드 칭호는 고유 titles.effect 만 쓰고, 장착 이펙트는 무시한다.
 * 이펙트만으로는 뱃지를 그리지 않는다.
 */

export type TitleEffectKey = 'legend' | 'xuanwu' | 'baekho' | 'eternal' | 'issen' | 'seongha' | 'sakura' | 'frost' | 'lightning' | 'wave' | 'dojang';

export interface ResolveTitleInput {
  name: string;
  color: string;
  is_legend: boolean;
  effect: string | null;
}

export interface ResolveEffectInput {
  key: string;
}

export interface ResolvedBadge {
  name: string;
  color: string;
  effect: TitleEffectKey | null;
}

export function isTitleEffectKey(value: string | null | undefined): value is TitleEffectKey {
  return (
    value === 'legend' ||
    value === 'xuanwu' ||
    value === 'baekho' ||
    value === 'eternal' ||
    value === 'issen' ||
    value === 'seongha' ||
    value === 'sakura' ||
    value === 'frost' ||
    value === 'lightning' ||
    value === 'wave' ||
    value === 'dojang'
  );
}

function asEffect(value: string | null | undefined): TitleEffectKey | null {
  return isTitleEffectKey(value) ? value : null;
}

/** 장착 이펙트가 실제로 뱃지에 입혀지는지 */
export function isOverlayApplied(
  title: ResolveTitleInput | null,
  equipped: ResolveEffectInput | null,
): boolean {
  return Boolean(title && !title.is_legend && equipped);
}

export function resolveBadge(
  title: ResolveTitleInput | null,
  equipped: ResolveEffectInput | null,
): ResolvedBadge | null {
  if (!title) return null;
  if (title.is_legend) {
    return {
      name: title.name,
      color: title.color,
      effect: asEffect(title.effect),
    };
  }
  return {
    name: title.name,
    color: title.color,
    effect: asEffect(equipped?.key ?? title.effect),
  };
}

export interface DisplayedTitleSnapshot {
  id: string;
  name: string;
  color: string;
  effect: TitleEffectKey | null;
}

/** NULL expires_at = 영구. 스킨·이펙트 보유와 동일. */
export function isUnexpiredGrant(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > now;
}

/** 표시용 스냅샷. id 는 칭호 행, effect 는 overlay 합성 결과. */
export function composeDisplayedTitle(
  title: (ResolveTitleInput & { id: string }) | null,
  equipped: ResolveEffectInput | null,
): DisplayedTitleSnapshot | null {
  if (!title) return null;
  const badge = resolveBadge(title, equipped);
  if (!badge) return null;
  return { id: title.id, name: badge.name, color: badge.color, effect: badge.effect };
}
