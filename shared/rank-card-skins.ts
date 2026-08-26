/**
 * 랭크 카드 스킨.
 * 상점 판매 6종은 RANK_CARD_SHOP_IDS. 나머지는 `/dev/rank-card` 프리뷰만.
 */

export const RANK_CARD_SKINS = [
  { id: 'gilt', name: '금박', blurb: '얇은 금이 한 번 스친다' },
  { id: 'obsidian', name: '흑요석', blurb: '검은 돌, 금테' },
  { id: 'aurora', name: '오로라', blurb: '하늘이 천천히 흘러간다' },
  { id: 'nebula', name: '성운', blurb: '별이 박힌 밤' },
  { id: 'sakura', name: '벚꽃', blurb: '꽃잎이 잠깐 떠 있다' },
  { id: 'ember', name: '잔불', blurb: '꺼지지 않은 불씨' },
  { id: 'frost', name: '서리', blurb: '얼음이 숨 쉰다' },
  { id: 'volt', name: '섬광', blurb: '번개가 한 줄 긋는다' },
  { id: 'jade', name: '비취', blurb: '옥빛 문양' },
  { id: 'imperial', name: '황실', blurb: '진홍과 금' },
] as const;

export type RankCardSkinId = (typeof RANK_CARD_SKINS)[number]['id'];

/** 길드 상점 판매. 금박·서리·섬광·황실은 안 판다. */
export const RANK_CARD_SHOP_IDS = [
  'obsidian',
  'aurora',
  'nebula',
  'sakura',
  'ember',
  'jade',
] as const;

export type RankCardShopSkinId = (typeof RANK_CARD_SHOP_IDS)[number];

export const RANK_CARD_SKIN_COST_GP = 300;
export const RANK_CARD_SKIN_DURATION_DAYS = 7;

export const RANK_CARD_SHOP_SKINS = RANK_CARD_SHOP_IDS.map(
  (id) => RANK_CARD_SKINS.find((s) => s.id === id)!,
);

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
