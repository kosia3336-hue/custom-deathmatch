import { LEGEND_PRIZE_DEF_ID } from './constants';
import { PRIZE_DEF_BY_ID } from './prize-defs';
import { computeGradeEffectiveWeight, eligibleSlotsForGrade } from './pool';
import { getSkinMeta } from '@/lib/skins/registry';
import type { GachaGrade, PickResult, PoolContext, ResolvedPrize } from './types';
import { GRADE_ORDER } from './constants';

function secureRandomInt(max: number): number {
  if (max <= 0) return 0;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % max;
}

function pickGrade(ctx: PoolContext, excludeS: boolean): GachaGrade {
  const entries: { grade: GachaGrade; w: number }[] = [];
  let sum = 0;
  for (const g of GRADE_ORDER) {
    if (excludeS && g === 'S') continue;
    const w = computeGradeEffectiveWeight(g, ctx);
    if (w <= 0) continue;
    entries.push({ grade: g, w });
    sum += w;
  }
  if (sum === 0) throw new Error('no_eligible_grade');
  let r = secureRandomInt(sum);
  for (const { grade, w } of entries) {
    if (r < w) return grade;
    r -= w;
  }
  return entries[entries.length - 1]!.grade;
}

function resolvePrize(defId: string, ctx: PoolContext): ResolvedPrize {
  const def = PRIZE_DEF_BY_ID[defId];
  if (!def) throw new Error('unknown_prize');

  switch (def.kind) {
    case 'nothing':
      return { kind: 'nothing' };
    case 'cdp':
      return { kind: 'cdp', amount: def.cdpAmount ?? 150 };
    case 'consumable':
      return {
        kind: 'consumable',
        consumableKind: def.consumableKind!,
        qty: def.qty ?? 1,
      };
    case 'random_skin': {
      const ids = ctx.eligibleSkinIds;
      if (ids.length === 0) throw new Error('no_eligible_skin');
      const skinId = ids[secureRandomInt(ids.length)]!;
      const meta = getSkinMeta(skinId);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      return { kind: 'skin', skinId, name: meta?.name ?? skinId, expiresAt };
    }
    case 'random_effect': {
      const effects = ctx.eligibleEffects;
      if (effects.length === 0) throw new Error('no_eligible_effect');
      const e = effects[secureRandomInt(effects.length)]!;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      return { kind: 'effect', effectId: e.id, key: e.key, name: e.name, expiresAt };
    }
    case 'random_shop_title': {
      const titles = ctx.eligibleTitleIds;
      if (titles.length === 0) throw new Error('no_eligible_title');
      const t = titles[secureRandomInt(titles.length)]!;
      return {
        kind: 'title',
        titleId: t.id,
        name: t.name,
        color: t.color,
        effect: t.effect,
      };
    }
    case 'legend_title_mystery': {
      const lt = ctx.legendTitle;
      if (!lt) throw new Error('legend_title_missing');
      return {
        kind: 'legend',
        titleId: lt.id,
        name: lt.name,
        color: lt.color,
        effect: lt.effect ?? 'xuanwu',
      };
    }
    default:
      return { kind: 'nothing' };
  }
}

export function pickPrize(ctx: PoolContext, attempt = 0): PickResult {
  const excludeS = attempt > 0;
  const grade = pickGrade(ctx, excludeS);
  const slots = eligibleSlotsForGrade(grade, ctx);
  if (slots.length === 0) {
    if (attempt < 3) return pickPrize(ctx, attempt + 1);
    throw new Error('pick_failed');
  }
  const def = slots[secureRandomInt(slots.length)]!;
  const resolved = resolvePrize(def.id, ctx);

  if (def.id === LEGEND_PRIZE_DEF_ID && ctx.legendClaimedGlobally) {
    if (attempt < 3) return pickPrize({ ...ctx, legendClaimedGlobally: true }, attempt + 1);
    throw new Error('legend_already_claimed');
  }

  return {
    grade: def.grade,
    prizeDefId: def.id,
    displayName: def.kind === 'legend_title_mystery' ? '레전드 칭호' : def.displayName,
    resolved,
  };
}
