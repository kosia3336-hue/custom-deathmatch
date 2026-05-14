/**
 * 회원의 보유(active) 칭호 ID Set 캐시.
 *
 *  - 게임 시작 / 밴픽 추첨 직전에 fetchOwnedActiveTitles() 로 1회 조회 후
 *    roomShopState.biasTitlesByToken 에 저장한다.
 *  - 짧은 TTL (60s) 의 메모리 캐시도 두어 동일 회원의 중복 fetch 를 줄인다.
 */

import { getSupabaseAdmin } from '../db/supabase.js';

const TTL_MS = 60 * 1000;

interface CacheEntry {
  ts: number;
  ids: Set<string>;
}

const cache = new Map<string, CacheEntry>();

export async function fetchOwnedActiveTitles(memberId: string): Promise<Set<string>> {
  const cached = cache.get(memberId);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.ids;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('member_titles')
    .select('title_id')
    .eq('member_id', memberId)
    .is('revoked_at', null);

  if (error) {
    console.warn('[playerOwnedTitles] DB 조회 실패:', error.message);
    return new Set();
  }

  const ids = new Set<string>(
    (data ?? []).map((r: { title_id: string }) => r.title_id),
  );
  cache.set(memberId, { ts: Date.now(), ids });
  return ids;
}

/** 한 회원의 캐시를 무효화 (구매 / 회수 후) */
export function invalidateOwnedTitles(memberId: string): void {
  cache.delete(memberId);
}
