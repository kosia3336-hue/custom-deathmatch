/** 대시보드 타일. 운영 「메뉴 배치」로 순서를 바꾼다. */

export const DEV_TILE_IDS = [
  'members',
  'contrib',
  'join',
  'ops',
  'chat',
  'notice',
  'shop',
  'invest',
  'grant',
  'war',
  'list',
] as const;

export type DevTileId = (typeof DEV_TILE_IDS)[number];

export const DEV_TILE_LABEL: Record<DevTileId, string> = {
  members: '길드원',
  contrib: '공헌도',
  join: '가입 신청',
  ops: '운영',
  chat: '채팅',
  notice: '공지',
  shop: '상점',
  invest: '투자',
  grant: '지급',
  war: '길드전',
  list: '랭킹',
};

export const DEV_DEFAULT_TILE_ORDER: DevTileId[] = [...DEV_TILE_IDS];

export function normalizeTileOrder(order: unknown): DevTileId[] {
  const seen = new Set<DevTileId>();
  const next: DevTileId[] = [];
  if (Array.isArray(order)) {
    for (const raw of order) {
      const id = String(raw) as DevTileId;
      if (DEV_TILE_IDS.includes(id) && !seen.has(id)) {
        seen.add(id);
        next.push(id);
      }
    }
  }
  const missing = DEV_TILE_IDS.filter((id) => !seen.has(id));
  if (next.at(-1) === 'list') {
    next.pop();
    next.push(...missing.filter((id) => id !== 'list'), 'list');
  } else {
    next.push(...missing);
  }
  return next;
}

export function sameTileOrder(a: readonly DevTileId[], b: readonly DevTileId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function reorderTile(order: DevTileId[], from: number, to: number): DevTileId[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) {
    return order;
  }
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function moveTile(order: DevTileId[], index: number, dir: -1 | 1): DevTileId[] {
  return reorderTile(order, index, index + dir);
}
