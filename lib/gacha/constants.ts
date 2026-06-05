import type { GachaGrade } from './types';

export const GACHA_ID = 'default';
export const GACHA_PRICE_CDP = 100;

/** 가중치 합 = 10_000 (= 100%) */
export const GRADE_WEIGHTS: Record<GachaGrade, number> = {
  S: 10,
  A: 100,
  B: 200,
  C: 2800,
  F: 6890,
};

export const GRADE_ORDER: GachaGrade[] = ['S', 'A', 'B', 'C', 'F'];

export const GRADE_LABEL: Record<GachaGrade, string> = {
  S: '레전드!',
  A: 'A 등급',
  B: 'B 등급',
  C: 'C 등급',
  F: '꽝…',
};

/** DB titles.id — 영겁의 현무 (마이그레이션과 동일 UUID) */
/** DB titles.id — 영겁의 현무 (기존 등록) */
export const LEGEND_TITLE_ID = 'af357172-8af4-42b5-9d3e-fda04c3fcbc5';

export const LEGEND_PRIZE_DEF_ID = 's_legend_mystery';
