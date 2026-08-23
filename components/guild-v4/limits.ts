import { GUILD_INITIAL_CAPACITY, GUILD_NAME_REGEX } from '@/lib/guild/types';

/** `/dev/guild` 전용. 운영 RPC·DB(이름 2~20, 소개 200)는 건드리지 않는다. */
export const DEV_GUILD_NAME_MIN = 2;
export const DEV_GUILD_NAME_MAX = 10;
export const DEV_GUILD_DESC_MAX = 50;
export const DEV_NOTICE_TITLE_MIN = 2;
export const DEV_NOTICE_TITLE_MAX = 80;
export const DEV_NOTICE_BODY_MAX = 10_000;
export const DEV_NOTICE_COMMENT_MAX = 100;
export const DEV_MAX_VICE_OWNERS = 2;
export const DEV_VICE_FULL_MESSAGE = '부길드장 최대 정원이 모두 찼습니다.';
export const DEV_VICE_LIMIT_HINT = '부길드장은 최대 2명까지만 임명할 수 있습니다.';

/** 정원 +1 첫 가격 (GP). 운영 `GUILD_EXPANSION_COST_GP` 와 다름. */
export const DEV_EXPAND_COST_START = 300;
/** 1~4회차 증가폭 */
export const DEV_EXPAND_COST_STEP = 300;
/** 5회차부터 증가폭 */
export const DEV_EXPAND_COST_STEP_FROM_LV5 = 500;
export const DEV_EXPAND_STEP_CHANGE_AT = 5;

/**
 * 다음 정원 +1 비용.
 * 1회 300, 이후 +300. 5회차부터는 +500.
 * `currentCapacity` 는 지금 정원 (초기 3이면 첫 확장은 300).
 */
export function devExpansionCost(
  currentCapacity: number,
  initial = GUILD_INITIAL_CAPACITY,
): number {
  const nextLevel = Math.max(1, currentCapacity - initial + 1);
  let cost = 0;
  for (let i = 1; i <= nextLevel; i += 1) {
    const step = i === 1 ? DEV_EXPAND_COST_START : i < DEV_EXPAND_STEP_CHANGE_AT ? DEV_EXPAND_COST_STEP : DEV_EXPAND_COST_STEP_FROM_LV5;
    cost += step;
  }
  return cost;
}

/** 투자 CDP → 길드 GP. ⌊CDP × 2/3⌋. 99 → 66. */
export function investCdpToGp(cdp: number): number {
  const n = Math.trunc(cdp);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor((n * 2) / 3);
}

/** 1 CDP는 0 GP라 투자 불가. */
export const DEV_INVEST_MIN_CDP = 2;

/** 길드 GP → 개인 CDP. 1:1. */
export const DEV_GRANT_MIN = 1;

/** 길드 등급 1레벨당 랭크전 CDP 추가 적립. 운영은 아직 +1%. */
export const DEV_GUILD_BUFF_PCT_PER_LEVEL = 2;

export function isValidDevGuildName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length >= DEV_GUILD_NAME_MIN &&
    trimmed.length <= DEV_GUILD_NAME_MAX &&
    GUILD_NAME_REGEX.test(trimmed)
  );
}
