import type { ConsumableKind } from '@/lib/supabase/database.types';

export type GachaGrade = 'S' | 'A' | 'B' | 'C' | 'F';

export type IneligibleReason = 'permanent_owned' | 'already_owned' | 'global_claimed';

export type PrizeKind =
  | 'nothing'
  | 'cdp'
  | 'consumable'
  | 'random_skin'
  | 'random_shop_title'
  | 'legend_title_mystery';

export interface PrizeDef {
  id: string;
  grade: GachaGrade;
  displayName: string;
  kind: PrizeKind;
  consumableKind?: ConsumableKind;
  qty?: number;
  cdpAmount?: number;
}

export interface GachaSubItem {
  id: string;
  name: string;
  eligible: boolean;
  ineligibleReason?: IneligibleReason;
  swatch?: string;
  effectiveRate?: number;
}

export interface GachaPrizeRow {
  id: string;
  grade: GachaGrade;
  displayName: string;
  eligible: boolean;
  mystery?: boolean;
  ineligibleReason?: IneligibleReason;
  masterRate: number;
  effectiveRate: number;
  subItems?: GachaSubItem[];
}

export interface GachaGradeRow {
  grade: GachaGrade;
  masterRate: number;
  effectiveRate: number;
  prizes: GachaPrizeRow[];
}

export interface GachaPoolResponse {
  gachaId: string;
  name: string;
  priceCdp: number;
  balance: number;
  legendClaimedGlobally: boolean;
  grades: GachaGradeRow[];
}

export type ResolvedPrize =
  | { kind: 'nothing' }
  | { kind: 'cdp'; amount: number }
  | { kind: 'consumable'; consumableKind: ConsumableKind; qty: number }
  | { kind: 'skin'; skinId: string; name: string; expiresAt: string }
  | { kind: 'title'; titleId: string; name: string; color: string; effect?: string | null }
  | { kind: 'legend'; titleId: string; name: string; color: string; effect: string };

export interface GachaDrawResult {
  ok: true;
  drawId: string;
  grade: GachaGrade;
  prizeDefId: string;
  displayName: string;
  resolved: ResolvedPrize;
  newBalance: number;
  legendClaimed?: boolean;
}

export interface ShopTitlePoolItem {
  id: string;
  name: string;
  color: string;
  effect: string | null;
}

export interface PoolContext {
  memberId: string;
  legendClaimedGlobally: boolean;
  permanentSkinIds: Set<string>;
  ownedTitleIds: Set<string>;
  allActiveSkinIds: string[];
  eligibleSkinIds: string[];
  allBiasTitles: ShopTitlePoolItem[];
  eligibleTitleIds: ShopTitlePoolItem[];
  legendTitle?: { id: string; name: string; color: string; effect: string | null; description: string | null };
}

export interface PickResult {
  grade: GachaGrade;
  prizeDefId: string;
  displayName: string;
  resolved: ResolvedPrize;
}
