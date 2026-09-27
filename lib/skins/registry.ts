/**
 * 프론트 스킨 레지스트리.
 *
 * DB skins.id → 비주얼 테마 매핑. 서버가 내려준 gameState.activeSkin(=skinId) 를
 * 게임 모듈이 이 레지스트리로 해석해 실제 이펙트를 렌더한다.
 *
 * 게임당 스킨이 매칭될 때만 테마를 반환하므로, 잘못된 게임에 스킨이 적용되는 일이 없다.
 */

import { GAME_IDS } from '@/shared/types/game';
import { CHUSEOK_LIMITED_SKIN_ID } from '@shared/event/chuseok';

/** 지원하는 스킨 테마 식별자 */
export type SkinTheme =
  | 'cosmos'
  | 'imperial'
  | 'nocturne'
  | 'citadel'
  | 'duality'
  | 'showdown'
  | 'meow'
  | 'candy'
  | 'treasury'
  | 'four-card'
  | 'spring-rain'
  | 'ink-wash'
  | 'dalmaji';

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
  'skin-g003-01': {
    id: 'skin-g003-01',
    gameId: GAME_IDS.NUMBER_FOUR,
    name: '균열',
    theme: 'duality',
    description: '빙결(백)과 흑요석(흑)의 충돌. 7개 파편 배분이 에너지 전쟁이 된다.',
    swatch: 'linear-gradient(135deg, #2d6a9f 0%, #080b14 45%, #3d1f3d 100%)',
  },
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
  'skin-g010-01': {
    id: 'skin-g010-01',
    gameId: GAME_IDS.SILPER_BNW,
    name: '냥냥',
    theme: 'meow',
    description: '솜사탕빛 고양이 다과회. 고양이 귀 타일과 젤리 발자국이 흩날린다.',
    swatch: 'linear-gradient(135deg, #ffe4ec 0%, #fdf3e3 50%, #ffd9e4 100%)',
  },
  'skin-g012-01': {
    id: 'skin-g012-01',
    gameId: GAME_IDS.GRAPE_SUGAR_2,
    name: '유리설탕',
    theme: 'candy',
    description: '설탕서리가 앉은 유리 과자점. 파스텔 유리 카드와 얼음 결정 라운드 보드.',
    swatch: 'linear-gradient(135deg, #e7defa 0%, #d8ecfb 45%, #fbe3f1 100%)',
  },
  'skin-g014-01': {
    id: 'skin-g014-01',
    gameId: GAME_IDS.BANK_GAME,
    name: '심야금고',
    theme: 'treasury',
    description: '한밤의 비밀 금고. 황동 장부와 가상 지폐 위에서 펼쳐지는 은행가의 심리전.',
    swatch: 'linear-gradient(135deg, #07111d 0%, #12382f 48%, #b8873f 100%)',
  },
  'skin-g017-01': {
    id: 'skin-g017-01',
    gameId: GAME_IDS.QUATRO,
    name: '포카드',
    theme: 'four-card',
    description: '에메랄드 펠트 위의 클래식 카지노. 트럼프 카드와 달빛 조커로 완성하는 콰트로.',
    swatch: 'linear-gradient(135deg, #061b16 0%, #0d4638 52%, #8e5d2d 100%)',
  },
  'skin-g023-01': {
    id: 'skin-g023-01',
    gameId: GAME_IDS.KINGMAKING,
    name: '봄비',
    theme: 'spring-rain',
    description: '봄비가 멈춘 정원의 웅덩이 판. 연잎 말이 쌓이고 착수 자리에 물결이 퍼진다.',
    swatch: 'linear-gradient(135deg, #dcebe3 0%, #6d9992 52%, #df897a 100%)',
  },
  'skin-g007-01': {
    id: 'skin-g007-01',
    gameId: GAME_IDS.MULTIPLE_BNW,
    name: '묵연',
    theme: 'ink-wash',
    description: '한지 위로 번지는 먹빛 산수. 백자와 먹돌 타일로 펼치는 고요한 수 싸움.',
    swatch: 'linear-gradient(135deg, #f2eadc 0%, #d4c8b4 52%, #242321 100%)',
  },
  'skin-g011-01': {
    id: 'skin-g011-01',
    gameId: GAME_IDS.FIVE_TOWERS,
    name: '고성',
    theme: 'citadel',
    description: '풍화된 성채의 다섯 돌기둥. 횃불과 석재 층, 탑 완성 연출.',
    swatch: 'radial-gradient(ellipse 70% 55% at 50% 30%, #6b5d4f, #2a2520 72%)',
  },
  'skin-g009-01': {
    id: 'skin-g009-01',
    gameId: GAME_IDS.BNW2,
    name: '서부',
    theme: 'showdown',
    description: '황혼의 결투장. 탄띠 트랙, 조준경 제시, 현상금 포스터와 총잡이 결투 연출.',
    swatch: 'linear-gradient(160deg, #f3e6d0 0%, #d8a24a 45%, #9c5a34 100%)',
  },
  [CHUSEOK_LIMITED_SKIN_ID]: {
    id: CHUSEOK_LIMITED_SKIN_ID,
    gameId: GAME_IDS.SUN_MOON_STAR_2,
    name: '한가위 보름',
    theme: 'dalmaji',
    description: '해달별2 한가위 보름. 달빛 판과 해·달·별 문양.',
    swatch: 'linear-gradient(160deg, #141e38 0%, #1a5864 48%, #e8c56a 100%)',
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
