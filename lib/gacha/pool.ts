import { GRADE_ORDER, GRADE_WEIGHTS, LEGEND_PRIZE_DEF_ID } from './constants';
import { PRIZE_DEFS } from './prize-defs';
import type {
  GachaGrade,
  GachaGradeRow,
  GachaPrizeRow,
  GachaPoolResponse,
  PoolContext,
  PrizeDef,
} from './types';

export function isSlotEligible(def: PrizeDef, ctx: PoolContext): boolean {
  switch (def.kind) {
    case 'nothing':
    case 'cdp':
    case 'consumable':
      return true;
    case 'random_skin':
      return ctx.eligibleSkinIds.length > 0;
    case 'random_effect':
      return ctx.eligibleEffects.length > 0;
    case 'random_shop_title':
      return ctx.eligibleTitleIds.length > 0;
    case 'legend_title_mystery':
      return !ctx.legendClaimedGlobally;
    default:
      return false;
  }
}

export function eligibleSlotsForGrade(grade: GachaGrade, ctx: PoolContext): PrizeDef[] {
  return PRIZE_DEFS.filter((d) => d.grade === grade && isSlotEligible(d, ctx));
}

function gradeHasEligible(grade: GachaGrade, ctx: PoolContext): boolean {
  return eligibleSlotsForGrade(grade, ctx).length > 0;
}

export function computeGradeEffectiveWeight(grade: GachaGrade, ctx: PoolContext): number {
  if (!gradeHasEligible(grade, ctx)) return 0;
  return GRADE_WEIGHTS[grade];
}

export function computeEffectiveRates(ctx: PoolContext): { gradeRates: Record<GachaGrade, number>; slotRates: Record<string, number> } {
  const gradeWeights: Partial<Record<GachaGrade, number>> = {};
  let sum = 0;
  for (const g of GRADE_ORDER) {
    const w = computeGradeEffectiveWeight(g, ctx);
    if (w > 0) {
      gradeWeights[g] = w;
      sum += w;
    }
  }

  const gradeRates = {} as Record<GachaGrade, number>;
  const slotRates: Record<string, number> = {};

  for (const g of GRADE_ORDER) {
    const w = gradeWeights[g] ?? 0;
    gradeRates[g] = sum > 0 ? w / sum : 0;
    const slots = eligibleSlotsForGrade(g, ctx);
    const perSlot = slots.length > 0 ? gradeRates[g] / slots.length : 0;
    for (const def of PRIZE_DEFS.filter((d) => d.grade === g)) {
      if (isSlotEligible(def, ctx)) {
        slotRates[def.id] = perSlot;
      } else {
        slotRates[def.id] = 0;
      }
    }
    if (g === 'A' && slots.length > 0) {
      const skinSlotRate = slotRates['a_random_skin_7d'] ?? 0;
      if (ctx.eligibleSkinIds.length > 0 && skinSlotRate > 0) {
        const perSkin = skinSlotRate / ctx.eligibleSkinIds.length;
        for (const sid of ctx.eligibleSkinIds) {
          slotRates[`skin:${sid}`] = perSkin;
        }
      }
      const titleSlotRate = slotRates['a_random_shop_title'] ?? 0;
      if (ctx.eligibleTitleIds.length > 0 && titleSlotRate > 0) {
        const perTitle = titleSlotRate / ctx.eligibleTitleIds.length;
        for (const t of ctx.eligibleTitleIds) {
          slotRates[`title:${t.id}`] = perTitle;
        }
      }
      const effectSlotRate = slotRates['a_random_effect_7d'] ?? 0;
      if (ctx.eligibleEffects.length > 0 && effectSlotRate > 0) {
        const perEffect = effectSlotRate / ctx.eligibleEffects.length;
        for (const e of ctx.eligibleEffects) {
          slotRates[`effect:${e.id}`] = perEffect;
        }
      }
    }
  }

  return { gradeRates, slotRates };
}

export function buildPoolResponse(
  ctx: PoolContext,
  balance: number,
  gachaName = 'CDP 뽑기',
): GachaPoolResponse {
  const masterSum = Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
  const masterGradeRates = Object.fromEntries(
    GRADE_ORDER.map((g) => [g, GRADE_WEIGHTS[g] / masterSum]),
  ) as Record<GachaGrade, number>;

  const { gradeRates, slotRates } = computeEffectiveRates(ctx);

  const grades: GachaGradeRow[] = GRADE_ORDER.map((grade) => {
    const masterRate = masterGradeRates[grade];
    const effectiveRate = gradeRates[grade];
    const prizes: GachaPrizeRow[] = PRIZE_DEFS.filter((d) => d.grade === grade).map((def) => {
      const eligible = isSlotEligible(def, ctx);
      const row: GachaPrizeRow = {
        id: def.id,
        grade: def.grade,
        displayName: def.kind === 'legend_title_mystery' ? '레전드 칭호' : def.displayName,
        eligible,
        masterRate: (masterRate / PRIZE_DEFS.filter((p) => p.grade === grade).length),
        effectiveRate: slotRates[def.id] ?? 0,
      };
      if (!eligible) {
        if (def.kind === 'legend_title_mystery') row.ineligibleReason = 'global_claimed';
      }
      if (def.kind === 'random_skin' && !eligible && ctx.eligibleSkinIds.length === 0) {
        row.ineligibleReason = 'permanent_owned';
      }
      if (def.kind === 'random_effect' && !eligible && ctx.eligibleEffects.length === 0) {
        const remaining = ctx.allActiveEffects.filter((e) => !ctx.claimedEffectIds.has(e.id));
        row.ineligibleReason = remaining.length === 0 ? 'global_claimed' : 'permanent_owned';
      }
      if (def.kind === 'random_shop_title' && !eligible && ctx.eligibleTitleIds.length === 0) {
        row.ineligibleReason = 'already_owned';
      }
      if (def.kind === 'legend_title_mystery' && !eligible) {
        row.ineligibleReason = 'global_claimed';
      }
      return row;
    });

    return { grade, masterRate, effectiveRate, prizes };
  });

  return {
    gachaId: 'default',
    name: gachaName,
    priceCdp: 100,
    balance,
    legendClaimedGlobally: ctx.legendClaimedGlobally,
    grades,
  };
}
