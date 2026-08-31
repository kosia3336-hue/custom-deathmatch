import type { GachaGrade } from './types';

export const GACHA_ID = 'default';
export const GACHA_PRICE_CDP = 80;

/** 한 번의 요청으로 뽑을 수 있는 최대 횟수 */
export const GACHA_MAX_BULK_COUNT = 30;

/**
 * 가중치 합 = 10_000 (= 100%)
 *
 * B 를 4% → 8% 로 올리면서 늘어난 400 은 꽝(F)에서 뺐다 — 합을 10_000 에
 * 맞춰야 각 값이 그대로 백분율이 되고, S·A·C 배분은 건드리지 않는다.
 */
export const GRADE_WEIGHTS: Record<GachaGrade, number> = {
  S: 20,
  A: 150,
  B: 800,
  C: 2860,
  F: 6170,
};

export const GRADE_ORDER: GachaGrade[] = ['S', 'A', 'B', 'C', 'F'];

export const GRADE_LABEL: Record<GachaGrade, string> = {
  S: '레전드!',
  A: 'A 등급',
  B: 'B 등급',
  C: 'C 등급',
  F: '꽝…',
};

/*
  뽑기 S등급 레전드 슬롯에 걸린 칭호. 전역 1회만 나온다.
  이력: 영겁의 현무 → 무극의 백호 → 홍련의 주작. 앞의 둘은 이미 주인을 찾았다.
  바꿀 때는 아래 build-pool-data 의 폴백 값도 함께 맞춰야 한다.
*/
export const LEGEND_TITLE_ID = 'd7a7f07d-a160-4f8a-b982-d5794db257ae';

export const LEGEND_PRIZE_DEF_ID = 's_legend_mystery';
