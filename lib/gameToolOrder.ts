/** 게임별 편의기능 순서. 배치와 마찬가지로 이 브라우저에만 저장한다. */
const EMPTY: readonly string[] = Object.freeze([]);
const cache = new Map<string, readonly string[]>();
const listeners = new Map<string, Set<() => void>>();
const storageKey = (scope: string) => `cdm-game-tools-order:v2:${scope}`;

export function parseToolOrder(raw: string | null): readonly string[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** 나중에 등록된 창은 기본 순서대로 뒤에 추가하고, 잠시 사라진 창의 저장값은 유지한다. */
export function orderedToolIds(
  saved: readonly string[],
  available: readonly string[],
  anchored: readonly string[] = [],
): string[] {
  const order = [...new Set([...saved, ...available])].filter((id) => available.includes(id));
  // 새로 이동 가능해진 점수판은 기존 저장 순서에 없더라도 기본 이웃 옆에 둔다.
  // 사용자가 이미 옮긴 창과 기존 창들 사이의 순서는 그대로 유지한다.
  for (const id of anchored) {
    if (saved.includes(id) || !available.includes(id)) continue;
    order.splice(order.indexOf(id), 1);
    const index = available.indexOf(id);
    const next = available.slice(index + 1).find((peer) => order.includes(peer));
    const previous = available
      .slice(0, index)
      .reverse()
      .find((peer) => order.includes(peer));
    order.splice(next ? order.indexOf(next) : previous ? order.indexOf(previous) + 1 : 0, 0, id);
  }
  return order;
}

/** before가 없으면 맨 뒤. 같은 창 위에 놓거나 없는 창을 옮기면 그대로 둔다. */
export function moveToolBefore(ids: readonly string[], id: string, before?: string): string[] {
  if (!ids.includes(id) || before === id || (before != null && !ids.includes(before)))
    return [...ids];
  const next = ids.filter((item) => item !== id);
  next.splice(before == null ? next.length : next.indexOf(before), 0, id);
  return next;
}

export function getToolOrder(scope: string): readonly string[] {
  const hit = cache.get(scope);
  if (hit) return hit;
  let order = EMPTY;
  try {
    order = parseToolOrder(window.localStorage.getItem(storageKey(scope)));
  } catch {
    // 저장소가 막혀 있어도 이번 방문의 변경은 가능하다.
  }
  cache.set(scope, order);
  return order;
}

export const getServerToolOrder = () => EMPTY;

export function setToolOrder(scope: string, order: readonly string[]): void {
  const next = [...new Set(order)];
  cache.set(scope, next);
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    // 저장 불가 환경이면 메모리에 유지한다.
  }
  listeners.get(scope)?.forEach((notify) => notify());
}

export function subscribeToolOrder(scope: string, notify: () => void): () => void {
  const set = listeners.get(scope) ?? new Set();
  listeners.set(scope, set);
  set.add(notify);
  return () => {
    set.delete(notify);
  };
}
