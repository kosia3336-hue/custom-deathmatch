/**
 * `/ranking` 닉네임 검색. 현재 members.nickname 부분 일치.
 * 게임 랭킹 RPC에 닉 필터가 없어, 검색 시 리더보드를 최대 SCAN_LIMIT행 읽는다.
 */

export const RANKING_NICK_QUERY_MAX = 16;
export const RANKING_LIST_SCAN_LIMIT = 5000;
export const RANKING_NICK_MATCH_LIMIT = 1000;

export function parseRankingNicknameQuery(raw: string | undefined): string {
  const q = (raw ?? '').trim();
  if (!q) return '';
  return q.slice(0, RANKING_NICK_QUERY_MAX);
}

export function rankingNicknameIlikePattern(query: string): string {
  const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
}

export async function findMemberIdsByNickname(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  query: string,
): Promise<string[]> {
  if (!query) return [];
  const { data, error } = await sb
    .from('members')
    .select('id')
    .ilike('nickname', rankingNicknameIlikePattern(query))
    .limit(RANKING_NICK_MATCH_LIMIT);
  if (error) {
    console.warn('[ranking] nickname search', error.message);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}
