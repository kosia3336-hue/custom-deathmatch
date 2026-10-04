import type { ShopItem } from '@/lib/cdp/types';
import { tierOrder, type RankTier } from '@/shared/types/rank';
import { GAME_RULES } from '@/lib/gameRules';
import { SKIN_REGISTRY } from '@/lib/skins/registry';
import { CHUSEOK_LIMITED_SKIN_ID } from '@shared/event/chuseok';

export type DevPackId = 'bronze' | 'gold' | 'diamond';
export type DevPackGrade = 'S' | 'A' | 'B' | 'C';

export interface DevPackReward {
  key: string;
  grade: DevPackGrade;
  name: string;
  detail: string;
}

interface PackDef {
  id: DevPackId;
  name: string;
  price: number;
  slots: number;
  minTier: string;
  grades: Record<DevPackGrade, number>;
}

const PACKS: Record<DevPackId, PackDef> = {
  bronze: {
    id: 'bronze',
    name: '브론즈팩',
    price: 3300,
    slots: 4,
    minTier: '브론즈 이상',
    grades: { C: 74, B: 20, A: 5.5, S: 0.5 },
  },
  gold: {
    id: 'gold',
    name: '골드팩',
    price: 6100,
    slots: 5,
    minTier: '골드 이상',
    grades: { C: 62, B: 26, A: 10, S: 2 },
  },
  diamond: {
    id: 'diamond',
    name: '다이아팩',
    price: 11400,
    slots: 6,
    minTier: '다이아 이상',
    grades: { C: 46.5, B: 32, A: 17, S: 4.5 },
  },
};

const GAME_NAME = new Map(GAME_RULES.map((game) => [game.id, game.name]));

const SKINS = Object.values(SKIN_REGISTRY)
  .filter((skin) => skin.id !== CHUSEOK_LIMITED_SKIN_ID)
  .map((skin) => ({
    id: skin.id,
    label: `스킨 ${GAME_NAME.get(skin.gameId) ?? skin.gameId}-${skin.name}`,
  }));

/** 별빛은 영구 보유분이 있어 풀에서 빼 둔다. 한가위 이펙트도 제외. */
const EFFECTS = [
  { id: 'issen', label: '이펙트 일섬' },
  { id: 'sakura', label: '이펙트 벚꽃' },
  { id: 'frost', label: '이펙트 서리' },
  { id: 'lightning', label: '이펙트 번개' },
  { id: 'wave', label: '이펙트 파도' },
  { id: 'dojang', label: '이펙트 도장' },
];

const SHOP_TITLES = [
  '사목러',
  '장기두는사람',
  '넘버4팬',
  '홀덤러',
  '투자자',
  '가바보고수',
  '배흑팬',
  '연승왕',
  '흑과백2팬',
  '실흑팬',
  '탑쟁이',
  '포설러',
  '해달별팬',
  '은행원',
];

const FIVE_PACKS = ['돋보기 5개', '밴 삭제권 5개', '관전 잠금권 5개', '익명물약 5개', '검색 찬스 5개'];

const C_ITEMS = [
  '밴 삭제권',
  '돋보기',
  '관전 잠금권',
  '카운터 부적',
  '평온의 부적',
  '익명물약',
  '검색 찬스',
  '뽑기권 2장',
];

type Line = {
  weight: number;
  label: string;
  resolve: (used: Set<string>) => DevPackReward | null;
};

function reward(grade: DevPackGrade, key: string, name: string, detail: string): DevPackReward {
  return { grade, key, name, detail };
}

function fromPool(
  grade: DevPackGrade,
  prefix: string,
  entries: Array<{ id: string; label: string }>,
  detail: string,
  used: Set<string>,
): DevPackReward | null {
  const open = entries.filter((entry) => !used.has(`${prefix}:${entry.id}`));
  if (open.length === 0) return null;
  const entry = open[Math.floor(Math.random() * open.length)]!;
  return reward(grade, `${prefix}:${entry.id}`, entry.label, detail);
}

const LINES: Record<Exclude<DevPackGrade, 'C'>, Line[]> = {
  S: [
    { weight: 90, label: '스킨 영구', resolve: (used) => fromPool('S', 'skin-perm', SKINS, '영구', used) },
    { weight: 10, label: '이펙트 영구', resolve: (used) => fromPool('S', 'effect-perm', EFFECTS, '영구', used) },
  ],
  A: [
    { weight: 40, label: '스킨 7일', resolve: (used) => fromPool('A', 'skin-7', SKINS, '7일', used) },
    { weight: 30, label: '상점 칭호 영구', resolve: (used) => fromPool('A', 'title', SHOP_TITLES.map((name) => ({ id: name, label: name })), '상점 칭호 · 영구', used) },
    { weight: 20, label: '이펙트 7일', resolve: (used) => fromPool('A', 'effect-7', EFFECTS, '7일', used) },
    {
      weight: 10,
      label: '랭크 초기화권',
      resolve: (used) =>
        used.has('rank-reset') ? null : reward('A', 'rank-reset', '랭크 초기화권', '소모품'),
    },
  ],
  B: [
    { weight: 45, label: '소모품 5개', resolve: (used) => fromPool('B', 'five', FIVE_PACKS.map((name) => ({ id: name, label: name })), '소모품 · 5개', used) },
    { weight: 20, label: '스킨 1일', resolve: (used) => fromPool('B', 'skin-1', SKINS, '1일', used) },
    {
      weight: 15,
      label: '강등 보호권',
      resolve: (used) =>
        used.has('demotion') ? null : reward('B', 'demotion', '강등 보호권', '소모품'),
    },
    { weight: 12, label: '이펙트 1일', resolve: (used) => fromPool('B', 'effect-1', EFFECTS, '1일', used) },
    {
      weight: 8,
      label: '닉네임 변경권',
      resolve: (used) => (used.has('nick') ? null : reward('B', 'nick', '닉네임 변경권', '소모품')),
    },
  ],
};

function pickWeighted<T extends { weight: number }>(items: T[]): T | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1] ?? null;
}

function rollGrade(packId: DevPackId): DevPackGrade {
  const grades = PACKS[packId].grades;
  const table = (Object.entries(grades) as Array<[DevPackGrade, number]>).map(([grade, weight]) => ({
    grade,
    weight,
  }));
  return pickWeighted(table)?.grade ?? 'C';
}

function rollOne(grade: DevPackGrade, used: Set<string>): DevPackReward {
  if (grade === 'C') {
    const open = C_ITEMS.filter((name) => !used.has(`c:${name}`));
    const name = (open.length > 0 ? open : C_ITEMS)[Math.floor(Math.random() * (open.length > 0 ? open.length : C_ITEMS.length))]!;
    return reward('C', `c:${name}`, name, '소모품');
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const line = pickWeighted(LINES[grade]);
    const next = line?.resolve(used);
    if (next) return next;
  }
  return reward(grade, `fallback:${grade}:${used.size}`, '소모품', '대체');
}

export function rollDevPackPair(packId: DevPackId, used: Set<string>): [DevPackReward, DevPackReward] {
  const grade = rollGrade(packId);
  const first = rollOne(grade, used);
  const nextUsed = new Set(used);
  nextUsed.add(first.key);
  let second = rollOne(grade, nextUsed);
  if (second.key === first.key) {
    second = rollOne(grade === 'C' ? 'B' : 'C', nextUsed);
  }
  return [first, second];
}

export function devPackSlots(packId: DevPackId): number {
  return PACKS[packId].slots;
}

const PACK_MIN_TIER: Record<DevPackId, RankTier> = {
  bronze: 'bronze',
  gold: 'gold',
  diamond: 'diamond',
};

const PACK_MIN_LABEL: Record<DevPackId, string> = {
  bronze: '브론즈',
  gold: '골드',
  diamond: '다이아',
};

/** 티어가 부족하면 토스트 문구. 충분하면 null. */
export function packPurchaseBlock(packId: DevPackId, tier: RankTier | null): string | null {
  const need = PACK_MIN_TIER[packId];
  const have: RankTier = tier ?? 'unranked';
  if (tierOrder(have) >= tierOrder(need)) return null;
  return `랭크 티어가 ${PACK_MIN_LABEL[packId]} 이상만 구매할 수 있습니다.`;
}

export function devPackIdFromItem(item: ShopItem): DevPackId | null {
  const id = item.payload?.packId;
  return id === 'bronze' || id === 'gold' || id === 'diamond' ? id : null;
}

export interface DevPackOddsRow {
  name: string;
  /** 한 칸 기준 백분율 */
  rate: number;
}

export interface DevPackOddsGrade {
  grade: DevPackGrade;
  rate: number;
  rows: DevPackOddsRow[];
}

const GRADE_ORDER: DevPackGrade[] = ['S', 'A', 'B', 'C'];

export function devPackOdds(packId: DevPackId): DevPackOddsGrade[] {
  const pack = PACKS[packId];
  return GRADE_ORDER.map((grade) => {
    const rate = pack.grades[grade];
    const lines =
      grade === 'C'
        ? C_ITEMS.map((name) => ({ label: name, weight: 1 }))
        : LINES[grade].map((line) => ({ label: line.label, weight: line.weight }));
    const sum = lines.reduce((total, line) => total + line.weight, 0);
    return {
      grade,
      rate,
      rows: lines.map((line) => ({ name: line.label, rate: (rate * line.weight) / sum })),
    };
  });
}

export const DEV_PACK_ORDER: DevPackId[] = ['bronze', 'gold', 'diamond'];

export function packPaidPrice(packId: DevPackId, merchantDiscount: boolean): number {
  const price = PACKS[packId].price;
  return merchantDiscount ? Math.floor(price * 0.9) : price;
}

function shopItem(pack: PackDef, preview: boolean): ShopItem {
  return {
    id: `dev-pack-${pack.id}`,
    type: 'pack',
    name: pack.name,
    description: `랜덤 등급의 상품 ${pack.slots}번 획득할 수 있습니다.`,
    price: pack.price,
    stock: null,
    isLimited: false,
    isActive: true,
    payload: { preview, packId: pack.id, slots: pack.slots, minTier: pack.minTier },
    availableFrom: null,
    availableUntil: null,
    sortOrder: pack.id === 'diamond' ? 3 : pack.id === 'gold' ? 2 : 1,
  };
}

const PACK_DEFS = [PACKS.bronze, PACKS.gold, PACKS.diamond];

/** 데브 상점. 잔액만 줄고 지급하지 않는다. */
export const DEV_SHOP_PACKS: ShopItem[] = PACK_DEFS.map((pack) => shopItem(pack, true));

/** 운영 상점. 서버가 CDP를 깎고 고른 상품을 지급한다. */
export const LIVE_SHOP_PACKS: ShopItem[] = PACK_DEFS.map((pack) => shopItem(pack, false));
