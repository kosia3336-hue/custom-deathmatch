/**
 * 랭크 카드 스킨.
 * 상점·`/dev/rank-card` 는 같은 10종 (RANK_CARD_SHOP_IDS).
 */

export const RANK_CARD_SKINS = [
  { id: 'gilt', name: '금박', blurb: '얇은 금이 한 번 스친다' },
  { id: 'aurora', name: '오로라', blurb: '하늘이 천천히 흘러간다' },
  { id: 'sakura', name: '벚꽃', blurb: '꽃잎이 잠깐 떠 있다' },
  { id: 'frost', name: '서리', blurb: '얼음이 숨 쉰다' },
  { id: 'jade', name: '비취', blurb: '옥빛 문양' },
  { id: 'yuzu', name: '유자', blurb: '노란 껍질' },
  { id: 'loess', name: '황토', blurb: '마른 흙' },
  { id: 'woad', name: '쪽빛', blurb: '쪽물에 한 번' },
  { id: 'grape', name: '포도', blurb: '보라 과피' },
  { id: 'ink', name: '수묵', blurb: '먹이 번진다' },
] as const;

export type RankCardSkinId = (typeof RANK_CARD_SKINS)[number]['id'];

export const RANK_CARD_SHOP_IDS = [
  'gilt',
  'aurora',
  'sakura',
  'frost',
  'jade',
  'yuzu',
  'loess',
  'woad',
  'grape',
  'ink',
] as const;

export type RankCardShopSkinId = (typeof RANK_CARD_SHOP_IDS)[number];

/** `/dev/rank-card` 프리뷰 = 상점 10종. */
export const RANK_CARD_DEV_IDS = RANK_CARD_SHOP_IDS;
export type RankCardDevSkinId = RankCardShopSkinId;

export const RANK_CARD_DEV_SKINS = RANK_CARD_SKINS;
export const RANK_CARD_SHOP_SKINS = RANK_CARD_SKINS;

export const RANK_CARD_SKIN_COST_GP = 300;
export const RANK_CARD_SKIN_DURATION_DAYS = 7;

export function isRankCardShopSkinId(id: string): id is RankCardShopSkinId {
  return (RANK_CARD_SHOP_IDS as readonly string[]).includes(id);
}

export function parseRankCardShopSkinId(id: string | null | undefined): RankCardShopSkinId | null {
  if (!id) return null;
  return isRankCardShopSkinId(id) ? id : null;
}

export function rankCardSkinName(id: RankCardShopSkinId): string {
  return RANK_CARD_SHOP_SKINS.find((s) => s.id === id)?.name ?? id;
}

export function isRankCardActive(
  card: { expiresAt: string } | null | undefined,
  now = Date.now(),
): boolean {
  if (!card) return false;
  return new Date(card.expiresAt).getTime() > now;
}

export function formatRankCardRemaining(expiresAt: string, now = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return '만료됨';
  if (ms < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.ceil(ms / 60_000));
    return `${mins}분 남음`;
  }
  if (ms < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.ceil(ms / 3_600_000));
    return `${hours}시간 남음`;
  }
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (hours === 0) return `${days}일 남음`;
  return `${days}일 ${hours}시간 남음`;
}
