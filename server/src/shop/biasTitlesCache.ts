/**
 * 게임 bias 칭호 캐시.
 *
 *  - shop_items 에서 type='title' AND payload.subtype='bias' 인 아이템들을 모아
 *    titleId → { gameId, weight } 매핑을 메모리에 캐시한다.
 *  - 어드민이 상점 아이템을 변경/추가하면 internal HTTP 로 invalidate 가 호출된다.
 *  - 또한 TTL (10분) 후에는 강제 새로 고침.
 */

import { getSupabaseAdmin } from '../db/supabase.js';

export interface BiasTitleInfo {
  /** 부스트 대상 게임 ID (예: 'game-007') */
  gameId: string;
  /** 추가 가중치 (양수). 기본 1.0 */
  weight: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  loadedAt: number;
  /** titleId → BiasTitleInfo */
  byTitleId: Map<string, BiasTitleInfo>;
}

let entry: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

async function loadFromDb(): Promise<CacheEntry> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('shop_items')
    .select('id, type, payload')
    .eq('type', 'title');

  if (error) {
    console.warn('[biasTitlesCache] DB 조회 실패:', error.message);
    return { loadedAt: Date.now(), byTitleId: new Map() };
  }

  const map = new Map<string, BiasTitleInfo>();
  for (const row of (data ?? []) as Array<{
    id: string;
    type: string;
    payload: Record<string, unknown> | null;
  }>) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    if (payload.subtype !== 'bias') continue;

    const titleId = typeof payload.title_id === 'string' ? payload.title_id : null;
    const gameId = typeof payload.bias_game_id === 'string' ? payload.bias_game_id : null;
    if (!titleId || !gameId) continue;

    const rawWeight = Number(payload.bias_weight ?? 1);
    const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;

    map.set(titleId, { gameId, weight });
  }

  return { loadedAt: Date.now(), byTitleId: map };
}

async function ensureLoaded(): Promise<CacheEntry> {
  if (entry && Date.now() - entry.loadedAt < TTL_MS) return entry;
  if (inflight) return inflight;
  inflight = loadFromDb().then((e) => {
    entry = e;
    inflight = null;
    return e;
  }).catch((err) => {
    inflight = null;
    throw err;
  });
  return inflight;
}

/** titleId → 게임/가중치. 캐시 미준비 시 비동기로 로드. */
export async function getBiasTitleInfo(titleId: string): Promise<BiasTitleInfo | null> {
  const e = await ensureLoaded();
  return e.byTitleId.get(titleId) ?? null;
}

/** 여러 titleId 의 bias 정보를 한 번에 조회 */
export async function getBiasTitleInfos(titleIds: Iterable<string>): Promise<Map<string, BiasTitleInfo>> {
  const e = await ensureLoaded();
  const out = new Map<string, BiasTitleInfo>();
  for (const id of titleIds) {
    const info = e.byTitleId.get(id);
    if (info) out.set(id, info);
  }
  return out;
}

/** 미리 로드 (서버 부팅 시 호출 권장) */
export async function preloadBiasTitlesCache(): Promise<void> {
  await ensureLoaded();
}

/** 캐시 invalidate — 다음 조회 시 DB 재조회 */
export function invalidateBiasTitlesCache(): void {
  entry = null;
}
