/**
 * 히든 칭호 정의 (v2.11 + v2 신규 7종).
 *
 * 본 파일은 **서버 코드 안에서만** 살아야 한다.
 *  - DB 에는 조건 로직을 절대 저장하지 않는다 (다른 관리자 노출 방지).
 *  - 관리자 패널 / 클라이언트 번들에도 포함되지 않는다.
 *  - 조건이 최초로 충족된 1명에게만 부여된다 (system_grant_hidden_title 가 선잠금 처리).
 *  - 이미 달성된 칭호는 다시 생성/재부여되지 않는다.
 *
 * 카운팅 기준:
 *   - 'all'       : 서비스 런칭 이후 전체 이력 대상 (기존 데이터 포함)
 *   - 'post_update': v2.11 배포 이후(HIDDEN_TITLES_POST_UPDATE_START_AT)만 대상
 *   - 'post_v2'    : 신규 히든 배포 이후(HIDDEN_TITLES_V2_START_AT)만 대상
 *
 * 정책 문서: docs/v2/11_titles.md §11.5
 */
// DB enum public.title_color — shared/titles/colors.ts 와 동기화
import type { TitleColor } from '@shared/titles/colors';
export type { TitleColor };

/**
 * v2.11 배포 기준 시각 (KST 기준 2026-05-04 09:33).
 * 이 시각 이전의 데이터는 'post_update' 히든 칭호 카운팅에서 제외된다.
 *
 * ⚠️ 한 번 설정하면 절대 바꾸지 말 것 — 이후 부여된 히든 칭호의 공정성에 영향.
 */
export const HIDDEN_TITLES_POST_UPDATE_START_AT = '2026-05-04T00:33:00.000Z';

/**
 * 신규 히든 7종(v2) 집계 시작 시각.
 * ⚠️ 배포 시점에 맞게 한 번 설정 후 변경 금지.
 */
export const HIDDEN_TITLES_V2_START_AT = '2026-05-06T06:00:00.000Z';

/**
 * 신규 히든 6종(v3) 집계 시작 시각 (KST 기준 2026-05-19 16:00).
 * ⚠️ 한 번 설정하면 절대 바꾸지 말 것.
 */
export const HIDDEN_TITLES_V3_START_AT = '2026-05-19T07:00:00.000Z';

export type HiddenTitleKey =
  | 'unbreakable_warrior'
  | 'field_conqueror'
  | 'dawn_star'
  | 'complainant'
  | 'thousand_fate'
  | 'big_dipper'
  | 'collector'
  | 'strategist'
  | 'hope_of_humanity'
  | 'eureka'
  | 'one_strike_master'
  | 'trial_of_patience'
  | 'blitz_victor'
  | 'name_changer'
  // v3 신규 6종
  | 'lord_of_sky'
  | 'sentinel_of_abyss'
  | 'karmic_resolve'
  | 'flex'
  | 'winning_spree'
  | 'iron_will';

export type HiddenTitleCountScope = 'all' | 'post_update' | 'post_v2';

export interface HiddenTitleDef {
  key: HiddenTitleKey;
  name: string;
  color: TitleColor;
  description: string;
  conditionText: string;
  scope: HiddenTitleCountScope;
}

/**
 * 히든 칭호 정의.
 *
 * name / color / description / conditionText 는 조건 만족 시
 * `system_grant_hidden_title` RPC 로 넘겨져 titles 행에 기록되며,
 * 이후 공개 /titles 페이지에서 유저에게 보인다.
 */
export const HIDDEN_TITLES: Record<HiddenTitleKey, HiddenTitleDef> = {
  unbreakable_warrior: {
    key: 'unbreakable_warrior',
    name: '불굴의 전사',
    color: 'rose',
    description: '100번 졌다. 하지만 싸우기 위해 다시 일어난다.',
    conditionText: '최초로 멀티 게임 100패를 기록한 플레이어',
    scope: 'all',
  },
  field_conqueror: {
    key: 'field_conqueror',
    name: '전장 정복자',
    color: 'teal',
    description: '14종 모든 게임을 최초로 승리한 플레이어. 어느 전장도 가리지 않는다.',
    conditionText: '최초로 14종 모든 게임에서 승리한 플레이어',
    scope: 'post_update',
  },
  dawn_star: {
    key: 'dawn_star',
    name: '새벽의 별',
    color: 'yellow',
    description: '남들이 잠든 시간. 홀로 빛나고 있다.',
    conditionText: '최초로 새벽 시간대(KST 4:00~5:00)에 승리한 플레이어',
    scope: 'post_update',
  },
  complainant: {
    key: 'complainant',
    name: '민원인',
    color: 'slate',
    description: '문의에 미친 사람.',
    conditionText: '최초로 문의를 3건 제출한 플레이어',
    scope: 'post_update',
  },
  thousand_fate: {
    key: 'thousand_fate',
    name: '천명',
    color: 'emerald',
    description: '1,000번째 승리를 거머쥔 하늘의 운명을 타고난 자.',
    conditionText: '커스텀 데스매치 플랫폼 통산 1,000번째 완료 게임에서 승리한 플레이어',
    scope: 'all',
  },
  big_dipper: {
    key: 'big_dipper',
    name: '북두칠성',
    color: 'gold',
    description: '일곱 개의 서로 다른 운명이 당신을 거쳐 흘러갔다.',
    conditionText: '최초로 7명의 서로 다른 플레이어와 멀티 게임을 플레이한 플레이어',
    scope: 'post_update',
  },
  collector: {
    key: 'collector',
    name: '수집가',
    color: 'lime',
    description: '흩어진 칭호들을 하나로 모으기 시작한 자.',
    conditionText: '최초로 서로 다른 칭호 5개를 획득한 플레이어',
    scope: 'all',
  },
  strategist: {
    key: 'strategist',
    name: '전략가',
    color: 'indigo',
    description: '밴픽과 게임을 모두 섭렵했다.',
    conditionText: '최초로 밴픽 모드에서 5승을 달성한 플레이어',
    scope: 'post_v2',
  },
  hope_of_humanity: {
    key: 'hope_of_humanity',
    name: '인류의 희망',
    color: 'yellow',
    description: '아직 인간은 AI에게 굴복하지 않았다.',
    conditionText: '최초로 AI에게 15번 승리한 플레이어',
    scope: 'post_v2',
  },
  eureka: {
    key: 'eureka',
    name: '유레카',
    color: 'gold',
    description: '공지사항에서 칭호를 발견했다.',
    conditionText: '최초로 해당 칭호가 안내된 공지사항을 확인한 플레이어',
    scope: 'post_v2',
  },
  one_strike_master: {
    key: 'one_strike_master',
    name: '일격필살',
    color: 'slate',
    description:
      '만 가지 발차기를 할 줄 아는 사람보다 한 가지 발차기를 만 번 연습한 사람이 더 무서운 법.',
    conditionText: '최초로 같은 게임을 30번 플레이한 플레이어',
    scope: 'post_v2',
  },
  trial_of_patience: {
    key: 'trial_of_patience',
    name: '인고의 시간',
    color: 'rose',
    description: '시계 바늘이 한 바퀴를 돌 때까지, 당신의 투지는 꺾이지 않았다.',
    conditionText: '최초로 1시간 이상 진행된 게임에서 승리한 플레이어',
    scope: 'post_v2',
  },
  blitz_victor: {
    key: 'blitz_victor',
    name: '전광석화',
    color: 'yellow',
    description: '긴 대화는 필요 없다. 이미 승부는 결정되었으니까.',
    conditionText: '최초로 3분 이내에 진행된 게임에서 승리한 플레이어',
    scope: 'post_v2',
  },
  name_changer: {
    key: 'name_changer',
    name: '둔갑술',
    color: 'slate',
    description: '당신의 정체는 아무도 모를 것이다. 아마도.',
    conditionText: '최초로 닉네임을 변경한 플레이어',
    scope: 'post_v2',
  },
  // ── v3 신규 6종 ────────────────────────────────────────────────────
  lord_of_sky: {
    key: 'lord_of_sky',
    name: '천공의 주인',
    color: 'sky',
    description: '하늘 위에서 고고하게 빛나는 존재.',
    conditionText: '최초로 챌린저에서 70판 연속 플레이',
    scope: 'post_v2',
  },
  sentinel_of_abyss: {
    key: 'sentinel_of_abyss',
    name: '심연의 수문장',
    color: 'bronze',
    description: '위로 올라가려는 자들이여, 나를 넘어서라.',
    conditionText: '최초로 브론즈에서 30판 연속 플레이',
    scope: 'post_v2',
  },
  karmic_resolve: {
    key: 'karmic_resolve',
    name: '결자해지',
    color: 'ruby',
    description: '전장에서 맺은 악연을 내 손으로 끊어냈다.',
    conditionText: '직전 판에서 나에게 패배를 안긴 플레이어를 다음 판에 적으로 만나 승리',
    scope: 'post_v2',
  },
  flex: {
    key: 'flex',
    name: '플렉스',
    color: 'emerald',
    description: '가격표는 보지 않는다. 바로 구매해버려.',
    conditionText: '최초로 상점에서 3,500 CDP 소비',
    scope: 'post_v2',
  },
  winning_spree: {
    key: 'winning_spree',
    name: '파죽지세',
    color: 'sunset',
    description: '패배라는 단어는 내 사전에 없다.',
    conditionText: '최초로 멀티에서 8연승 달성',
    scope: 'post_v2',
  },
  iron_will: {
    key: 'iron_will',
    name: '강철의 투지',
    color: 'charcoal',
    description: '잇따른 패배가 칼날을 더 단단하게 벼른다.',
    conditionText: '최초로 멀티에서 8연패 달성',
    scope: 'post_v2',
  },
};
