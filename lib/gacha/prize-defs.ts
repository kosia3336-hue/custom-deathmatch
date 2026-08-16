import type { PrizeDef } from './types';

/** 정적 보상 정의 — DB gacha_prize_defs 시드와 1:1 */
export const PRIZE_DEFS: PrizeDef[] = [
  { id: 'f_nothing', grade: 'F', displayName: '꽝', kind: 'nothing' },
  { id: 'c_cdp_150', grade: 'C', displayName: '150 CDP', kind: 'cdp', cdpAmount: 150 },
  { id: 'c_ban_eraser', grade: 'C', displayName: '밴 삭제권', kind: 'consumable', consumableKind: 'ban_eraser', qty: 1 },
  { id: 'c_magnifier', grade: 'C', displayName: '돋보기', kind: 'consumable', consumableKind: 'magnifier', qty: 1 },
  { id: 'c_spectator_lock', grade: 'C', displayName: '관전 잠금권', kind: 'consumable', consumableKind: 'spectator_lock', qty: 1 },
  { id: 'c_anonymity', grade: 'C', displayName: '익명물약', kind: 'consumable', consumableKind: 'anonymity', qty: 1 },
  { id: 'b_ban_eraser', grade: 'B', displayName: '밴 삭제권 5개입', kind: 'consumable', consumableKind: 'ban_eraser', qty: 5 },
  { id: 'b_magnifier', grade: 'B', displayName: '돋보기 5개입', kind: 'consumable', consumableKind: 'magnifier', qty: 5 },
  { id: 'b_spectator_lock', grade: 'B', displayName: '관전 잠금권 5개입', kind: 'consumable', consumableKind: 'spectator_lock', qty: 5 },
  { id: 'b_anonymity', grade: 'B', displayName: '익명물약 5개입', kind: 'consumable', consumableKind: 'anonymity', qty: 5 },
  { id: 'b_nickname_change', grade: 'B', displayName: '닉네임 변경권', kind: 'consumable', consumableKind: 'nickname_change', qty: 1 },
  { id: 'b_cdp_500', grade: 'B', displayName: '500 CDP', kind: 'cdp', cdpAmount: 500 },
  { id: 'a_rank_reset', grade: 'A', displayName: '랭크 초기화권', kind: 'consumable', consumableKind: 'rank_reset', qty: 1 },
  // id 접두어는 최초 등급(A)에서 온 것 — 이력·DB 시드와 맞물려 있어 그대로 두고 등급만 내린다.
  { id: 'a_random_skin_7d', grade: 'B', displayName: '랜덤 스킨 7일 이용권', kind: 'random_skin' },
  { id: 'a_random_effect_7d', grade: 'A', displayName: '랜덤 이펙트 7일 이용권', kind: 'random_effect' },
  { id: 'a_random_shop_title', grade: 'A', displayName: '상점 칭호', kind: 'random_shop_title' },
  { id: 's_legend_mystery', grade: 'S', displayName: '레전드 칭호', kind: 'legend_title_mystery' },
];

export const PRIZE_DEF_BY_ID = Object.fromEntries(PRIZE_DEFS.map((p) => [p.id, p])) as Record<string, PrizeDef>;
