/**
 * 히든 칭호 조건 검사. 서버(service_role) Supabase 로 DB 집계.
 *
 * 각 함수는 "이 멤버가 지금 이 히든 칭호 조건을 만족하는가?" 를 boolean 으로 반환.
 *  - 만족 시 grantHiddenTitle() 을 호출해 RPC 로 부여한다.
 *  - RPC 쪽에서 1인 한정(선착순 잠금) 을 보장하므로,
 *    조건 체크 → 부여 사이의 경합은 안전하다.
 */
import { getSupabaseAdmin } from '../db/supabase.js';
import { HIDDEN_TITLES_POST_UPDATE_START_AT } from './constants.js';

// ── 공통 ────────────────────────────────────────────────────────────

/**
 * 전체 멀티 게임 중 주어진 멤버의 "패배" 건수.
 * counts_for_stats = true (멀티만 통계 반영) 인 로그 기준.
 */
export async function countMultiLossesAll(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('game_log_participants')
    .select('id, game_logs!inner(counts_for_stats)', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('is_winner', false)
    .eq('is_draw', false)
    .eq('game_logs.counts_for_stats', true);
  if (error) {
    console.warn('[hidden-titles] countMultiLossesAll:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * post_update 이후 해당 멤버가 승리한 "서로 다른 game_id" 집합.
 */
export async function getDistinctWinGameIdsPostUpdate(memberId: string): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('game_log_participants')
    .select('game_logs!inner(game_id, played_at, counts_for_stats)')
    .eq('member_id', memberId)
    .eq('is_winner', true)
    .eq('game_logs.counts_for_stats', true)
    .gte('game_logs.played_at', HIDDEN_TITLES_POST_UPDATE_START_AT);
  if (error) {
    console.warn('[hidden-titles] getDistinctWinGameIdsPostUpdate:', error.message);
    return new Set();
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    // supabase 는 inner join 을 배열 또는 객체로 반환할 수 있음 — 두 경우 모두 처리
    const gl = (row as unknown as { game_logs: { game_id: string } | { game_id: string }[] }).game_logs;
    if (Array.isArray(gl)) {
      for (const g of gl) set.add(g.game_id);
    } else if (gl) {
      set.add(gl.game_id);
    }
  }
  return set;
}

export async function getActiveGameCount(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (error) {
    console.warn('[hidden-titles] getActiveGameCount:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * post_update 이후 해당 멤버와 같은 방에서 게임을 함께 플레이한
 * "서로 다른 상대 회원 수".
 */
export async function countDistinctMultiOpponentsPostUpdate(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  // 1) 본인이 참여한 post_update 이후 game_log_id 수집
  const { data: mine, error: e1 } = await sb
    .from('game_log_participants')
    .select('game_log_id, game_logs!inner(played_at, counts_for_stats)')
    .eq('member_id', memberId)
    .eq('game_logs.counts_for_stats', true)
    .gte('game_logs.played_at', HIDDEN_TITLES_POST_UPDATE_START_AT);
  if (e1) {
    console.warn('[hidden-titles] countDistinctMultiOpponents (mine):', e1.message);
    return 0;
  }
  const gameLogIds = Array.from(
    new Set((mine ?? []).map((r) => (r as { game_log_id: string }).game_log_id)),
  );
  if (gameLogIds.length === 0) return 0;

  // 2) 해당 game_log 들의 나머지 참가자 (본인/AI/탈퇴 제외)
  const { data: others, error: e2 } = await sb
    .from('game_log_participants')
    .select('member_id')
    .in('game_log_id', gameLogIds)
    .neq('member_id', memberId)
    .not('member_id', 'is', null);
  if (e2) {
    console.warn('[hidden-titles] countDistinctMultiOpponents (others):', e2.message);
    return 0;
  }
  const opponents = new Set<string>();
  for (const r of others ?? []) {
    const mid = (r as { member_id: string | null }).member_id;
    if (mid) opponents.add(mid);
  }
  return opponents.size;
}

/**
 * 전체(all) 기간 해당 멤버가 활성 상태로 보유한 서로 다른 title 수.
 */
export async function countActiveTitlesAll(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('member_titles')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .is('revoked_at', null);
  if (error) {
    console.warn('[hidden-titles] countActiveTitlesAll:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * post_update 이후 해당 멤버가 제출한 문의 건수.
 */
export async function countInquiriesPostUpdate(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', memberId)
    .gte('created_at', HIDDEN_TITLES_POST_UPDATE_START_AT);
  if (error) {
    console.warn('[hidden-titles] countInquiriesPostUpdate:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * 전체 기간 통산 완료된 "멀티 게임" 수 (counts_for_stats = true).
 *   - 천명(1,000번째 승리 게임)의 기준.
 */
export async function countTotalMultiGamesAll(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('game_logs')
    .select('id', { count: 'exact', head: true })
    .eq('counts_for_stats', true);
  if (error) {
    console.warn('[hidden-titles] countTotalMultiGamesAll:', error.message);
    return 0;
  }
  return count ?? 0;
}
