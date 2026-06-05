/**
 * 프론트 스킨 레지스트리.
 *
 * DB skins.id → 비주얼 테마 매핑. 서버가 내려준 gameState.activeSkin(=skinId) 를
 * 게임 모듈이 이 레지스트리로 해석해 실제 이펙트를 렌더한다.
 *
 * 게임당 스킨이 매칭될 때만 테마를 반환하므로, 잘못된 게임에 스킨이 적용되는 일이 없다.
 */

import { GAME_IDS } from '@/shared/types/game';

/** 지원하는 스킨 테마 식별자 */
export type SkinTheme = 'cosmos' | 'imperial' | 'nocturne' | 'citadel';

export interface SkinMeta {
  /** DB skins.id */
  id: string;
  /** 적용 게임 ID */
  gameId: string;
  /** 코드/프리뷰용 표시명 */
  name: string;
  /** 비주얼 테마 */
  theme: SkinTheme;
  /** 짧은 설명 */
  description: string;
  /** 프리뷰 칩 그라데이션 (CSS background) */
  swatch: string;
}

export const SKIN_REGISTRY: Record<string, SkinMeta> = {
  'skin-g001-01': {
    id: 'skin-g001-01',
    gameId: GAME_IDS.FOUR_GRAVITY,
    name: '우주',
    theme: 'cosmos',
    description: '심연의 우주를 담은 보드. 별빛 돌과 초신성 승리 연출.',
    swatch: 'radial-gradient(circle at 30% 30%, #a855f7, #1e1b4b 70%)',
  },
  'skin-g002-01': {
    id: 'skin-g002-01',
    gameId: GAME_IDS.DOUBLE_SIDED_CHESS,
    name: '황실',
    theme: 'imperial',
    description: '흑칠 옻판 위 황금 기물. 격동의 황실 연출.',
    swatch: 'linear-gradient(135deg, #f5d27a, #1a1407 70%)',
  },
  'skin-g004-01': {
    id: 'skin-g004-01',
    gameId: GAME_IDS.INDIAN_POKER,
    name: '무월',
    theme: 'nocturne',
    description: '달빛이 내리는 밤의 테이블. 발광 숫자 카드, 순차 딜, 이마의 비밀.',
    swatch: 'radial-gradient(ellipse 80% 60% at 50% 20%, #1e3a5f, #0b1220 70%)',
  },
  'skin-g011-01': {
    id: 'skin-g011-01',
    gameId: GAME_IDS.FIVE_TOWERS,
    name: '고성',
    theme: 'citadel',
    description: '풍화된 성채의 다섯 돌기둥. 횃불과 석재 층, 탑 완성 연출.',
    swatch: 'radial-gradient(ellipse 70% 55% at 50% 30%, #6b5d4f, #2a2520 72%)',
  },
};

export function getSkinMeta(skinId?: string | null): SkinMeta | null {
  if (!skinId) return null;
  return SKIN_REGISTRY[skinId] ?? null;
}

/** skinId 가 해당 게임의 스킨일 때만 테마를 반환. 아니면 null */
export function getSkinTheme(skinId: string | null | undefined, gameId: string): SkinTheme | null {
  const meta = getSkinMeta(skinId);
  if (!meta || meta.gameId !== gameId) return null;
  return meta.theme;
}

/** 특정 게임의 스킨 목록 */
export function getSkinsForGame(gameId: string): SkinMeta[] {
  return Object.values(SKIN_REGISTRY).filter((s) => s.gameId === gameId);
}
