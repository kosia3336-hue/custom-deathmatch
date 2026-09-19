/**
 * RP 변화 표기 — 관리자 화면 공용.
 *
 * RP 는 티어 안에서 0~99 로 도는 값이라, 숫자만 적으면 거짓말을 한다. 다이아 14 에서
 * 29 를 잃으면 골드 85 가 되어 숫자는 오히려 커진다. 그래서 앞뒤 티어를 같이 적는다.
 *
 * 증감은 앞뒤 숫자에서 빼지 않고 기록에 적힌 값(winner_rp_gain / loser_rp_loss)을
 * 그대로 쓴다. 다이아는 100 을 넘어서도 승급하지 않아(챌린저는 상위 3명 기준)
 * '넘어가면 100 을 더한다' 는 식이 통하지 않는다.
 *
 * 시작 티어는 기록에 없다(끝난 뒤 티어만 남는다). 승급·강등 플래그로 한 단계
 * 되짚는다 — 랭크는 한 판에 한 단계만 오르내린다.
 */
export const RANK_TIER_KO: Record<string, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

const LADDER = ['unranked', 'bronze', 'silver', 'gold', 'diamond', 'challenger'] as const;

function step(tier: string, by: 1 | -1): string {
  const index = LADDER.indexOf(tier as (typeof LADDER)[number]);
  if (index < 0) return tier;
  const next = index + by;
  return next >= 0 && next < LADDER.length ? LADDER[next] : tier;
}

export function tierKo(tier: string | null | undefined): string {
  if (!tier) return '?';
  return RANK_TIER_KO[tier] ?? tier;
}

/** 끝난 뒤 티어에서 시작 티어를 되짚는다. 이겨서 올랐으면 한 단계 아래에서 왔다. */
export function tierBefore(tierAfter: string, opts: { won: boolean; tierChanged: boolean }): string {
  if (!opts.tierChanged) return tierAfter;
  return step(tierAfter, opts.won ? -1 : 1);
}

export interface RpChange {
  tierAfter: string;
  rpBefore: number;
  rpAfter: number;
  /** 기록에 적힌 증감. 승리는 양수, 패배는 음수. 배치전은 0 이다. */
  rpDelta: number;
  won: boolean;
  tierChanged: boolean;
}

/**
 * "다이아 14 → 골드 85 (-29) 강등" 꼴로 적는다.
 * 티어가 그대로면 앞쪽만 적어 "실버 88 → 8 (-20)" 이 된다.
 */
export function formatRpChange(c: RpChange): string {
  /* 배치전은 RP 가 움직이지 않는다. 마지막 판에서 티어가 정해지며 한 번에 뛴다. */
  const isPlacement = c.rpDelta === 0;
  if (isPlacement && c.tierChanged) {
    return `배치 완료 → ${tierKo(c.tierAfter)} ${c.rpAfter}`;
  }

  const before = tierBefore(c.tierAfter, { won: c.won, tierChanged: c.tierChanged });
  const head = c.tierChanged
    ? `${tierKo(before)} ${c.rpBefore} → ${tierKo(c.tierAfter)} ${c.rpAfter}`
    : `${tierKo(c.tierAfter)} ${c.rpBefore} → ${c.rpAfter}`;

  if (isPlacement) return `${head} (배치전)`;

  const sign = c.rpDelta > 0 ? `+${c.rpDelta}` : `${c.rpDelta}`;
  const mark = c.tierChanged ? (c.won ? ' 승급' : ' 강등') : '';
  return `${head} (${sign})${mark}`;
}
