/** 길드 랭킹 점수. RP를 인원으로 보정한 누적. 가입으로 다시 나누지 않는다. */

export type DevGuildRankPeriod = 'weekly' | 'monthly';

export type DevGuildRankScores = {
  weekly: number;
  monthly: number;
};

export const EMPTY_DEV_RANK_SCORES: DevGuildRankScores = { weekly: 0, monthly: 0 };

export function formatGuildRankScore(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

/** 1이면 평균(인원 무관), 0이면 합(인원 압승). 0.65면 같은 실력일 때 인원 2배 ≈ 1.27배. */
export const GUILD_RANK_SIZE_EXP = 0.65;

/** 창설 기본 정원. 이 수 미만도 이 수로 나눈다. */
export const GUILD_RANK_SIZE_FLOOR = 3;

/**
 * 이 시각 이전 경기는 바닥 1 (옛 공식). 이미 쌓인 길드 점수는 다시 나누지 않음.
 * 운영 적립 RPC도 이 시각 이후부터 `max(n, 3)`.
 */
export const GUILD_RANK_SIZE_FLOOR_SINCE = '2026-08-28T11:20:00+09:00';

const FLOOR_SINCE_MS = Date.parse(GUILD_RANK_SIZE_FLOOR_SINCE);

export function guildRankSizeFloor(playedAtMs?: number): number {
  if (playedAtMs != null && playedAtMs < FLOOR_SINCE_MS) return 1;
  return GUILD_RANK_SIZE_FLOOR;
}

export function guildRankSizeDivisor(memberCount: number, playedAtMs?: number): number {
  return Math.max(guildRankSizeFloor(playedAtMs), memberCount) ** GUILD_RANK_SIZE_EXP;
}

/** 시드 전용. 이후 로스터가 바뀌어도 이 값으로 다시 나누지 않는다. */
export function seedGuildRankScore(matchRps: number[], memberCount: number): number {
  const n = Math.max(1, memberCount);
  const sum = matchRps.reduce((a, b) => a + b, 0);
  return sum / guildRankSizeDivisor(n);
}

/** 랭크 RP 재료. 음수는 넣지 않는다. `memberCount`는 **그 시점** 인원. */
export function applyGuildRankDelta(score: number, rpDelta: number, memberCount: number): number {
  if (rpDelta <= 0) return score;
  return score + rpDelta / guildRankSizeDivisor(memberCount);
}

/** 점수 내림 → 길드 레벨 → GP. 순위는 겹치지 않는다. */
export function assignGuildRanks(
  guilds: { id: string; name: string; buffCdpLevel?: number; points?: number }[],
  scores: Record<string, number>,
): Map<string, number> {
  const sorted = [...guilds].sort((a, b) => {
    const ds = (scores[b.id] ?? 0) - (scores[a.id] ?? 0);
    if (ds !== 0) return ds;
    const dl = (b.buffCdpLevel ?? 0) - (a.buffCdpLevel ?? 0);
    if (dl !== 0) return dl;
    const dp = (b.points ?? 0) - (a.points ?? 0);
    if (dp !== 0) return dp;
    return a.name.localeCompare(b.name, 'ko');
  });

  const ranks = new Map<string, number>();
  sorted.forEach((g, i) => ranks.set(g.id, i + 1));
  return ranks;
}
