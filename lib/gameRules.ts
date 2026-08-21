/**
 * 게임별 룰 텍스트 + 갈래(카테고리).
 *
 * ── 룰 작성 방법 ───────────────────────────────────────────────
 *  각 게임의 `rules` 필드에 마크다운으로 룰을 작성하세요.
 *  지원 문법(lib/markdown.tsx): 제목(#, ##), 목록(-, 1.), **굵게**, *기울임*, `코드`, 링크 등.
 *  비워두면("") 모달에 "아직 룰이 준비 중입니다."가 표시됩니다.
 *
 * ── 룰 이미지 ──────────────────────────────────────────────────
 *  관리자 페이지 > 게임 룰 탭에서 올립니다(코드/배포 불필요).
 *  URL 은 game_rule_texts.image_url 에 저장되고, 룰 상세 페이지·소개 페이지
 *  캐러셀·인게임 룰 모달 세 곳에 함께 반영됩니다.
 *
 * ── 갈래(category) 재분류 ──────────────────────────────────────
 *  아래 assignment 는 이름 기준 "추정"입니다. 실제 게임 성격에 맞게
 *  각 게임의 `category` 값만 바꾸면 룰 페이지 컬럼이 자동으로 재배치됩니다.
 *  카테고리 순서/이름을 바꾸려면 GAME_CATEGORIES 배열을 수정하세요.
 * ───────────────────────────────────────────────────────────────
 */

export type GameCategory = '심리' | '추상전략' | '수리' | '언어' | '관찰' | '기타';

/** 컬럼(세로 줄) 순서 */
export const GAME_CATEGORIES: GameCategory[] = ['심리', '추상전략', '수리', '언어', '관찰', '기타'];

export interface GameRule {
  /** GAME_IDS 값 (shared/types/game.ts) */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 갈래 — 룰 페이지의 세로 컬럼 (재분류 가능). 새 게임은 '기타' 로 시작 후 재분류 */
  category: GameCategory;
  /** 마크다운 룰 텍스트 (여기를 채우세요) */
  rules: string;
}

export const GAME_RULES: GameRule[] = [
  { id: 'game-001', name: '사중력 사목', category: '추상전략', rules: '' },
  { id: 'game-002', name: '양면장기', category: '추상전략', rules: '' },
  { id: 'game-003', name: '넘버4', category: '심리', rules: '' },
  { id: 'game-004', name: '인디언홀덤Q', category: '심리', rules: '' },
  { id: 'game-005', name: '투자와 기부', category: '심리', rules: '' },
  { id: 'game-006', name: '베팅! 가위바위보', category: '심리', rules: '' },
  { id: 'game-007', name: '배수 흑과 백', category: '심리', rules: '' },
  { id: 'game-008', name: '연승게임 리뉴얼', category: '심리', rules: '' },
  { id: 'game-009', name: '흑과백2', category: '심리', rules: '' },
  { id: 'game-010', name: '실퍼의 흑과백', category: '심리', rules: '' },
  { id: 'game-011', name: '5개의 탑', category: '심리', rules: '' },
  { id: 'game-012', name: '포도설탕2', category: '심리', rules: '' },
  { id: 'game-013', name: '해달별2', category: '심리', rules: '' },
  { id: 'game-014', name: '은행놀이', category: '심리', rules: '' },
  { id: 'game-015', name: '인디언 홀덤 (이벤트)', category: '기타', rules: '' },
  { id: 'game-016', name: '해달별 (이벤트)', category: '기타', rules: '' },
  { id: 'game-017', name: '콰트로', category: '심리', rules: '' },
  { id: 'game-018', name: '단어조합', category: '언어', rules: '' },
  { id: 'game-019', name: '트랜스레터', category: '언어', rules: '' },
  {
    id: 'game-020',
    name: '수식완성N',
    category: '수리',
    rules: `## 게임 목표

사회자가 제시하는 **N개의 자연수**를 각각 정확히 한 번씩 사용해 타깃넘버가 되는 수식을 먼저 완성하세요.

## 진행 방법

1. 게임은 총 **9라운드**로 진행됩니다.
2. 매 라운드에 N개의 자연수와 타깃넘버가 공개됩니다.
3. 멀티에서는 두 플레이어가, 1:1 솔로에서는 한 플레이어가 제시된 수를 각각 한 번씩 사용해 수식을 제출합니다.
4. 수식만 제출하면 되며 계산 결과를 따로 입력할 필요는 없습니다.
5. 먼저 제출된 수식이 정답이면 **+1점**, 오답이면 **-1점**을 받고 해당 라운드가 끝납니다.
6. 멀티는 9라운드 종료 후 승점이 더 높은 플레이어가 승리합니다.

## 1:1 솔로

- 상대 없이 혼자 9라운드를 풀며 정답 **+1점**, 오답 **-1점** 규칙은 같습니다.
- 솔로 결과는 연습 기록으로 저장되며 전적 통계에는 반영되지 않습니다.

## 수식 입력

- 사용 가능: \`+\`, \`-\`, \`*\`(또는 ×), \`/\`(또는 ÷), 괄호
- 숫자 이어붙이기는 허용되지 않습니다.
- 나눗셈의 중간 계산이 분수여도 최종 값이 타깃과 정확히 같으면 정답입니다.

예: **Target 26 · 4, 5, 6, 7** → \`4*6+7-5\``,
  },
];

/**
 * 갈래별 색상(HSL 색상환 각도). 룰 목록(사다리)·소개 페이지·룰지가 같은 값을 써서
 * 어느 화면에서 보든 '심리는 빨강, 언어는 초록' 이 일치한다.
 *   심리 0(빨강) · 추상전략 50 · 수리 100 · 언어 150(초록) · 관찰 200 · 기타 250
 */
export function categoryHue(category: string): number {
  const idx = GAME_CATEGORIES.indexOf(category as GameCategory);
  return Math.round(((idx < 0 ? 0 : idx) / GAME_CATEGORIES.length) * 300);
}

export function getGameRule(id: string): GameRule | undefined {
  return GAME_RULES.find((g) => g.id === id);
}

/** 룰 문서 메타 — 출처/원본 링크/원작자/게시자 (game_rule_texts 컬럼과 1:1) */
export interface GameRuleMeta {
  source: string;
  originUrl: string;
  originalAuthor: string;
  poster: string;
}

export const EMPTY_RULE_META: GameRuleMeta = {
  source: '',
  originUrl: '',
  originalAuthor: '',
  poster: '',
};
