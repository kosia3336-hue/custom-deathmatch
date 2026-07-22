import type { GachaGrade } from './types';

export const GACHA_ID = 'default';
export const GACHA_PRICE_CDP = 80;

/** 한 번의 요청으로 뽑을 수 있는 최대 횟수 */
export const GACHA_MAX_BULK_COUNT = 30;

/** 가중치 합 = 10_000 (= 100%) */
export const GRADE_WEIGHTS: Record<GachaGrade, number> = {
  S: 20,
  A: 150,
  B: 400,
  C: 2860,
  F: 6570,
};

export const GRADE_ORDER: GachaGrade[] = ['S', 'A', 'B', 'C', 'F'];

export const GRADE_LABEL: Record<GachaGrade, string> = {
  S: '레전드!',
  A: 'A 등급',
  B: 'B 등급',
  C: 'C 등급',
  F: '꽝…',
};

/** DB titles.id — 현재 뽑기 레전드 칭호: 무극의 백호 (이전: 영겁의 현무) */
export const LEGEND_TITLE_ID = '579470a7-6bca-413c-a84f-d4a27ef48970';

export const LEGEND_PRIZE_DEF_ID = 's_legend_mystery';
