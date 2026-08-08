/**
 * 히든 칭호 조건 검사. 서버(service_role) Supabase 로 DB 집계.
 *
 * 각 함수는 "이 멤버가 지금 이 히든 칭호 조건을 만족하는가?" 를 boolean 으로 반환.
 *  - 만족 시 grantHiddenTitle() 을 호출해 RPC 로 부여한다.
 *  - RPC 쪽에서 1인 한정(선착순 잠금) 을 보장하므로,
 *    조건 체크 → 부여 사이의 경합은 안전하다.
 */
import { getSupabaseAdmin } from '../db/supabase.js';
import {
  HIDDEN_TITLES_POST_UPDATE_START_AT,
  HIDDEN_TITLES_V2_START_AT,
} from './constants.js';

/** 게임 로그 조인 결과 정규화 */
function collectGameIdsFromJoinedParticipants(data: unknown[] | null): string[] {
  const ids: string[] = [];
  for (const row of data ?? []) {
    const gl = (row as unknown as { game_logs: { game_id: string } | { game_id: string }[] }).game_logs;
    if (Array.isArray(gl)) {
      for (const g of gl) ids.push(g.game_id);
    } else if (gl?.game_id) {
      ids.push(gl.game_id);
    }
  }
  return ids;
}

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
/** Supabase/PostgREST 기본 페이지 상한(1행 조회 시). 초과 시 .range() 로 추가 조회. */
const SUPABASE_PAGE_SIZE = 1000;
/**
 * .in() 에 한 번에 넣을 최대 id 개수. 실측 결과 game_log_id(UUID) 약 650개부터
 * 요청 크기 제한으로 400 Bad Request 가 발생해(직접 재현·확인) 여유 있게 300으로 배치.
 */
const IN_QUERY_CHUNK_SIZE = 300;

export async function countDistinctMultiOpponentsPostUpdate(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();

  // 1) 본인이 참여한 post_update 이후 game_log_id 수집.
  //    활동량이 많은 회원은 1000행을 넘을 수 있어 .range() 로 전부 페이지네이션한다
  //    (그렇지 않으면 Supabase 기본 상한(1000)에 걸려 최근 활동만 조용히 누락된다).
  const gameLogIds = new Set<string>();
  for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
    const { data, error } = await sb
      .from('game_log_participants')
      .select('game_log_id, game_logs!inner(played_at, counts_for_stats)')
      .eq('member_id', memberId)
      .eq('game_logs.counts_for_stats', true)
      .gte('game_logs.played_at', HIDDEN_TITLES_POST_UPDATE_START_AT)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      console.warn('[hidden-titles] countDistinctMultiOpponents (mine):', error.message);
      return 0;
    }
    for (const r of data ?? []) gameLogIds.add((r as { game_log_id: string }).game_log_id);
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }
  if (gameLogIds.size === 0) return 0;

  // 2) 해당 game_log 들의 나머지 참가자 (본인/AI/탈퇴 제외).
  //    id 목록이 크면 .in() 요청 자체가 400 Bad Request 로 실패하므로 청크 단위로 나눠 조회.
  //    한 청크가 실패해도 나머지 청크는 계속 집계한다(부분 결과가 0보다 정확함).
  const ids = Array.from(gameLogIds);
  const opponents = new Set<string>();
  for (let i = 0; i < ids.length; i += IN_QUERY_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_QUERY_CHUNK_SIZE);
    const { data, error } = await sb
      .from('game_log_participants')
      .select('member_id')
      .in('game_log_id', chunk)
      .neq('member_id', memberId)
      .not('member_id', 'is', null);
    if (error) {
      console.warn('[hidden-titles] countDistinctMultiOpponents (others):', error.message);
      continue;
    }
    for (const r of data ?? []) {
      const mid = (r as { member_id: string | null }).member_id;
      if (mid) opponents.add(mid);
    }
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

/**
 * since 이후 COM 모드 승리 횟수 (인류의 희망).
 */
export async function countComWinsSince(memberId: string, sinceIso: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('game_log_participants')
    .select('id, game_logs!inner(mode, played_at)', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('is_winner', true)
    .eq('game_logs.mode', 'com')
    .gte('game_logs.played_at', sinceIso);
  if (error) {
    console.warn('[hidden-titles] countComWinsSince:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * since 이후 멀티에서 같은 game_id 로 가장 많이 참가한 횟수 (일격필살).
 */
export async function maxMultiPlaysSingleGameSince(memberId: string, sinceIso: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('game_log_participants')
    .select('game_logs!inner(game_id, mode, played_at)')
    .eq('member_id', memberId)
    .eq('game_logs.mode', 'multi')
    .gte('game_logs.played_at', sinceIso);
  if (error) {
    console.warn('[hidden-titles] maxMultiPlaysSingleGameSince:', error.message);
    return 0;
  }
  const gameIds = collectGameIdsFromJoinedParticipants(data as unknown[]);
  const tally = new Map<string, number>();
  for (const gid of gameIds) {
    tally.set(gid, (tally.get(gid) ?? 0) + 1);
  }
  let max = 0;
  for (const n of tally.values()) {
    if (n > max) max = n;
  }
  return max;
}

/**
 * 닉네임 변경 시각이 v2 히든 컷오프 이후인지 (둔갑술).
 */
export async function isNicknameChangedSinceV2Cutoff(memberId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('members_private')
    .select('last_nickname_changed_at')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) {
    console.warn('[hidden-titles] isNicknameChangedSinceV2Cutoff:', error.message);
    return false;
  }
  const t = (data as { last_nickname_changed_at?: string | null } | null)?.last_nickname_changed_at;
  if (!t) return false;
  return t >= HIDDEN_TITLES_V2_START_AT;
}

// ── v3 신규 6종 조건 함수 ──────────────────────────────────────────────

/**
 * 멤버의 최근 랭크 게임 N건을 조회해 모두 동일 티어인지 확인한다.
 * 중간에 다른 티어 행이 끼어 있으면 그 이후 연속 구간만 계산한다.
 *
 * @returns 현재 동일 티어 연속 판수
 */
export async function countConsecutiveRankGamesInTier(
  memberId: string,
  tier: string,
  limit: number,
): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('rank_match_history')
    .select('winner_id, loser_id, winner_tier, loser_tier')
    .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`)
    .order('played_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[hidden-titles] countConsecutiveRankGamesInTier:', error.message);
    return 0;
  }
  let streak = 0;
  for (const row of (data ?? []) as Array<{
    winner_id: string; loser_id: string;
    winner_tier: string; loser_tier: string;
  }>) {
    const memberTier = row.winner_id === memberId ? row.winner_tier : row.loser_tier;
    if (memberTier !== tier) break;
    streak += 1;
  }
  return streak;
}

/**
 * 멤버의 직전 멀티 게임(이번 게임 제외)에서 패배했고,
 * 그 상대가 currentOpponentId 인지 확인 (결자해지).
 *
 * @param memberId 이번 게임의 승자
 * @param currentOpponentId 이번 게임의 패자
 */
export async function wasDefeatedByOpponentLastGame(
  memberId: string,
  currentOpponentId: string,
  sinceIso: string,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  // 멤버의 최근 멀티 게임 2건(이번 + 직전)
  const { data, error } = await sb
    .from('game_log_participants')
    .select('game_log_id, is_winner, is_draw, game_logs!inner(mode, played_at, counts_for_stats)')
    .eq('member_id', memberId)
    .eq('game_logs.counts_for_stats', true)
    .gte('game_logs.played_at', sinceIso)
    .order('played_at', { referencedTable: 'game_logs', ascending: false })
    .limit(2);
  if (error) {
    console.warn('[hidden-titles] wasDefeatedByOpponentLastGame (self):', error.message);
    return false;
  }
  const rows = data as Array<{
    game_log_id: string;
    is_winner: boolean | null;
    is_draw: boolean;
    game_logs: { mode: string; played_at: string; counts_for_stats: boolean } | Array<{ mode: string; played_at: string; counts_for_stats: boolean }>;
  }>;
  // 최신이 이번 게임 → 직전 게임이 [1]
  if (rows.length < 2) return false;
  const prev = rows[1];
  if (prev.is_winner !== false || prev.is_draw) return false; // 직전 게임을 이겼으면 조건 불충족

  // 직전 게임에서 상대가 누구였는지 확인
  const { data: others, error: e2 } = await sb
    .from('game_log_participants')
    .select('member_id')
    .eq('game_log_id', prev.game_log_id)
    .neq('member_id', memberId)
    .not('member_id', 'is', null)
    .eq('is_winner', true);
  if (e2) {
    console.warn('[hidden-titles] wasDefeatedByOpponentLastGame (others):', e2.message);
    return false;
  }
  const opponentIds = (others ?? []).map((r) => (r as { member_id: string }).member_id);
  return opponentIds.includes(currentOpponentId);
}

/**
 * 멤버의 누적 CDP 소비액 (shop_purchases.price_paid 합계).
 */
export async function getTotalCdpSpent(memberId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('shop_purchases')
    .select('price_paid')
    .eq('member_id', memberId);
  if (error) {
    console.warn('[hidden-titles] getTotalCdpSpent:', error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, r) => sum + Number((r as { price_paid: number }).price_paid ?? 0), 0);
}

/**
 * sinceIso 이후 멤버의 최근 멀티 게임 N건에서 모두 승리/패배했는지 확인.
 *
 * @param checkWin true = 연승 확인, false = 연패 확인
 * @returns 해당 결과로 연속인지 여부
 */
export async function isStreakInMulti(
  memberId: string,
  streakCount: number,
  checkWin: boolean,
  sinceIso: string,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('game_log_participants')
    .select('is_winner, is_draw, game_logs!inner(mode, played_at, counts_for_stats)')
    .eq('member_id', memberId)
    .eq('game_logs.counts_for_stats', true)
    .gte('game_logs.played_at', sinceIso)
    .order('played_at', { referencedTable: 'game_logs', ascending: false })
    .limit(streakCount);
  if (error) {
    console.warn('[hidden-titles] isStreakInMulti:', error.message);
    return false;
  }
  const rows = data as Array<{ is_winner: boolean | null; is_draw: boolean }>;
  if (rows.length < streakCount) return false;
  if (checkWin) {
    return rows.every((r) => r.is_winner === true);
  }
  return rows.every((r) => r.is_winner === false && !r.is_draw);
}

