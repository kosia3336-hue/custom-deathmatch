/**
 * 히든 칭호 정의 (v2.11).
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
 *
 * 정책 문서: docs/v2/11_titles.md §11.5
 */
// DB enum public.title_color 와 동일. 변경 시 동기화 필요.
export type TitleColor =
  | 'coral' | 'amber' | 'emerald' | 'sky' | 'violet' | 'pink'
  | 'lime' | 'rose' | 'cyan' | 'orange' | 'fuchsia' | 'teal'
  | 'yellow' | 'indigo' | 'slate' | 'gold';

/**
 * v2.11 배포 기준 시각 (KST 기준 2026-05-04 09:33).
 * 이 시각 이전의 데이터는 'post_update' 히든 칭호 카운팅에서 제외된다.
 *
 * ⚠️ 한 번 설정하면 절대 바꾸지 말 것 — 이후 부여된 히든 칭호의 공정성에 영향.
 */
export const HIDDEN_TITLES_POST_UPDATE_START_AT = '2026-05-04T00:33:00.000Z';

export type HiddenTitleKey =
  | 'unbreakable_warrior'
  | 'field_conqueror'
  | 'dawn_star'
  | 'complainant'
  | 'thousand_fate'
  | 'big_dipper'
  | 'collector';

export type HiddenTitleCountScope = 'all' | 'post_update';

export interface HiddenTitleDef {
  key: HiddenTitleKey;
  name: string;
  color: TitleColor;
  description: string;
  conditionText: string;
  scope: HiddenTitleCountScope;
}

/**
 * 7종 히든 칭호.
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
};
