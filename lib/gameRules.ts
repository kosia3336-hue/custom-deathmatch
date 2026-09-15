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

export type GameCategory = '심리' | '추상전략' | '수리' | '언어' | '관찰';

/** 컬럼(세로 줄) 순서 */
export const GAME_CATEGORIES: GameCategory[] = ['심리', '추상전략', '수리', '언어', '관찰'];

export interface GameRule {
  /** GAME_IDS 값 (shared/types/game.ts) */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 갈래 — 룰 페이지의 세로 컬럼 (재분류 가능) */
  category: GameCategory;
  /** 마크다운 룰 텍스트 (여기를 채우세요) */
  rules: string;
  /**
   * 룰 표(사다리)에서 감춘다.
   *
   * 이벤트판처럼 표에 싣기 애매한 게임을 위한 예외다. 갈래는 실제 성격대로
   * 붙여 두되(모달 필터에서 쓰인다) 표에서만 뺀다.
   */
  hiddenInLadder?: boolean;
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
  {
    id: 'game-015',
    name: '인디언 홀덤 (이벤트)',
    category: '심리',
    rules: '',
    hiddenInLadder: true,
  },
  { id: 'game-016', name: '해달별 (이벤트)', category: '심리', rules: '', hiddenInLadder: true },
  { id: 'game-017', name: '콰트로', category: '심리', rules: '' },
  { id: 'game-018', name: '단어조합', category: '언어', rules: '' },
  { id: 'game-019', name: '트랜스레터', category: '언어', rules: '' },
  {
    id: 'game-020',
    name: '수식완성N',
    category: '수리',
    rules: '',
  },
  {
    id: 'game-021',
    name: '컴플릿 결! 합!',
    category: '관찰',
    rules: '',
  },
  {
    id: 'game-022',
    name: '나이트의 여행',
    category: '관찰',
    rules: `## 게임 목표

체스 말 **나이트**를 움직여 보드에 열린 모든 칸을 상대보다 먼저 한 번씩 방문하세요. 게임은 최대 **7라운드**입니다.

## 이동 방법

- 나이트는 가로 2칸과 세로 1칸, 또는 가로 1칸과 세로 2칸을 합친 **L자 모양**으로 이동합니다.
- 첫 칸은 열린 칸 중 어디든 선택할 수 있습니다.
- 이미 방문한 칸은 다시 방문할 수 없습니다.
- 막혔다면 **한 칸 취소** 또는 **처음부터** 버튼으로 경로를 되돌릴 수 있습니다.
- 매 라운드의 보드는 크기와 모양이 달라지며, 모든 보드에는 반드시 완주 경로가 있습니다.

## 진행과 승리 조건

1. 두 플레이어는 매 라운드 같은 보드를 동시에 풉니다.
2. 열린 모든 칸을 먼저 방문한 플레이어가 라운드 1점을 얻습니다.
3. 멀티·COM에서는 먼저 **4점**을 얻으면 즉시 판정승합니다.
4. 선취 승자가 없으면 7라운드 종료 후 점수가 높은 플레이어가 승리합니다.
5. 점수가 같다면 같은 점수에 더 빨리 도달한 플레이어가 우위이며, 무승부는 0:0일 때만 발생합니다.

## 솔로와 COM

- **1:1 솔로**: 혼자 7개의 보드를 차례로 완주합니다.
- **COM**: COM과 동시에 같은 보드를 풀어 먼저 완주하는 대결입니다.
- 멀티에서는 방장이 다른 게임과 같은 방식으로 라운드 제한시간을 설정할 수 있습니다.
- 솔로와 COM 결과는 연습 기록으로 저장되며 랭크 전적에는 반영되지 않습니다.`,
  },
  {
    id: 'game-023',
    name: '킹메이킹',
    category: '추상전략',
    rules: '',
  },
  {
    id: 'game-024',
    name: '삼층 오목',
    category: '추상전략',
    rules: '',
  },
  {
    id: 'game-025',
    name: '초이스 홀덤',
    category: '심리',
    rules: '',
  },
  {
    id: 'game-026',
    name: '시드섯다',
    category: '심리',
    rules: '',
  },
  {
    id: 'game-027',
    name: '양면포커',
    category: '심리',
    rules: '',
  },
  {
    id: 'game-028',
    name: '명추리',
    category: '수리',
    rules: '',
  },
];

/**
 * 갈래별 색상(HSL 색상환 각도). 룰 목록(사다리)·소개 페이지·룰지가 같은 값을 써서
 * 어느 화면에서 보든 갈래 색이 일치한다.
 * 원래 쓰던 여섯 값(0·50·100·150·200·250)을 그대로 쓴다. 심리·추상전략·수리는
 * 예전 색 그대로이고, 지워진 여섯째 갈래 자리를 언어와 관찰이 한 칸씩 옮겨 받았다.
 *   심리 0(빨) · 추상전략 50 · 수리 100 · 언어 200(하늘) · 관찰 250(보라)
 *
 * 순서대로 계산하지 않고 값을 직접 적는다. 갈래를 하나 넣고 빼는 것만으로
 * 나머지 색이 전부 밀리면, 어제 본 색과 오늘 본 색이 달라진다.
 */
const CATEGORY_HUE: Record<GameCategory, number> = {
  심리: 0,
  추상전략: 50,
  수리: 100,
  언어: 200,
  관찰: 250,
};

export function categoryHue(category: string): number {
  /* 모든 갈래가 위 표에 있다 — 여기로 떨어지면 데이터가 잘못된 것이다. */
  return CATEGORY_HUE[category as GameCategory] ?? 0;
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
