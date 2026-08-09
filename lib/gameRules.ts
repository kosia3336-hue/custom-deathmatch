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
];

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
