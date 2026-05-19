/* ════════════════════════════════════════════════════════════════
 * 포도설탕2 (Grape Sugar 2)
 * 8라운드 동안 카드 + 설탕을 동시 제출해 승점을 겨루는 2인 카드 베팅 심리전.
 * - 양측 동시 제출 / 제출 정보는 모두 공개 (제출 전 본인 입력만 비공개)
 * - 점수는 음수 가능, 설탕은 0 미만 불가
 * - 동점 시 무승부 종료
 * ════════════════════════════════════════════════════════════════ */

export const GS2_TOTAL_ROUNDS = 8;
export const GS2_EXTENDED_ROUNDS = 9;
export const GS2_INITIAL_SUGAR = 35;
export const GS2_HR_PENALTY = 9;
export const GS2_MAX_EXTENSIONS = 99;

/* ───────── 카드 ───────── */

export const CARD_IDS = [
  'minus3', 'plus5', 'copy', 'grapeBless', 'earthCrush',
  'dice', 'breath', 'highRisk', 'spaceCrush', 'noAction',
] as const;
export type GS2CardId = typeof CARD_IDS[number];

export const CARD_LABELS: Record<GS2CardId, string> = {
  minus3:     '-3',
  plus5:      '+5',
  copy:       '복사',
  grapeBless: '포도의가호',
  earthCrush: '지구뿌셔!',
  dice:       '주사위',
  breath:     '숨고르기',
  highRisk:   '하이리스크',
  spaceCrush: '우주뿌셔!',
  noAction:   '무행동',
};

export const CARD_DESCRIPTIONS: Record<GS2CardId, string> = {
  minus3:     '상대 이번 라운드 설탕 -3',
  plus5:      '본인 이번 라운드 설탕 +5',
  copy:       '본인 이번 라운드 설탕 ×2',
  grapeBless: '승리 시 +2점, 패배 시 -1점',
  earthCrush: '상대 이번 라운드 설탕 절반(올림)',
  dice:       '6면체 주사위: 1·2 상대 -3 / 3·4 본인 -5 / 5·6 본인 미승리 시 상대 +2점',
  breath:     '게임을 9라운드로 연장 (최초 1회만 적용)',
  highRisk:   '본인 이번 라운드 설탕 ×3, 패배 시 다음 라운드 시작에 설탕 9개 상대에게 이전 (최대 보유분)',
  spaceCrush: '상대 제출 설탕을 0으로 만들고 카드 효과 무효화 (페널티 포함)',
  noAction:   '효과 없음. 단, 상대가 우주뿌셔!를 내면 즉시 게임 승리',
};

export type GS2Priority = 1 | 2;
export type GS2CardSubtype = 'self' | 'attack' | 'penalty' | 'score' | 'meta' | 'cancel' | 'noop';

export const CARD_META: Record<GS2CardId, { priority: GS2Priority; subtype: GS2CardSubtype }> = {
  plus5:      { priority: 1, subtype: 'self'    },
  copy:       { priority: 1, subtype: 'attack'  },
  highRisk:   { priority: 1, subtype: 'attack'  },
  grapeBless: { priority: 1, subtype: 'score'   },
  dice:       { priority: 1, subtype: 'score'   },
  breath:     { priority: 1, subtype: 'meta'    },
  minus3:     { priority: 2, subtype: 'penalty' },
  earthCrush: { priority: 2, subtype: 'penalty' },
  spaceCrush: { priority: 2, subtype: 'cancel'  },
  noAction:   { priority: 2, subtype: 'noop'    },
};

/* ───────── 페이즈 / 사이드 ───────── */

export type GS2Phase =
  | 'input'        // 양측 카드+설탕 입력 중
  | 'reveal'       // 양측 제출 완료, 카드/설탕 동시 공개 + 정산 단계 애니메이션
  | 'roundEnd'     // 라운드 결과 표기, 다음 라운드 대기
  | 'extensionIntro' // 연장전 인트로
  | 'finished';    // 최종 결과

export type GS2Side = 'p1' | 'p2';
export type GS2WinType = 'score' | 'instantWin' | 'timeout' | 'abandon' | 'draw' | null;

/* ───────── 액션 (제출 정보) ───────── */

export interface GS2PlayerAction {
  card: GS2CardId;
  sugar: number;       // 0 이상 정수
}

/* ───────── 정산 단계 이벤트 ───────── */

export type GS2DiceBranch = 'opp-3' | 'self-5' | 'loserBonus';

export type GS2ResolveStep =
  | { type: 'reveal'; actions: { p1: GS2PlayerAction; p2: GS2PlayerAction } }
  | { type: 'instantWin'; winner: GS2Side; reason: 'noActionVsSpaceCrush' }
  | { type: 'cancel'; targetSide: GS2Side; bySide: GS2Side }
  | { type: 'effect'; actor: GS2Side; card: GS2CardId; targetSide: GS2Side; before: number; after: number; op: string }
  | { type: 'dice'; actor: GS2Side; roll: 1 | 2 | 3 | 4 | 5 | 6; branch: GS2DiceBranch }
  | { type: 'final'; roundSugar: { p1: number; p2: number } }
  | { type: 'winner'; winner: GS2Side | 'tie'; scoreDelta: { p1: number; p2: number } }
  | { type: 'bless'; actor: GS2Side; outcome: 'win' | 'loss' | 'tie'; scoreDelta: number }
  | { type: 'diceScore'; actor: GS2Side; loserBonusTo: GS2Side; amount: 2 }
  | { type: 'hrPenaltyScheduled'; actor: GS2Side; amount: number }
  | { type: 'breathExtended'; nowMaxRound: 9 }
  | { type: 'breathNoEffect'; actor: GS2Side; reason: 'alreadyExtended' | 'cancelled' };

/* ───────── 플레이어 공개 상태 ───────── */

export interface GS2PlayerPublic {
  id: string;
  nickname: string;
  side: GS2Side;
  score: number;
  sugarRemain: number;
  hand: GS2CardId[];
  submitted: boolean;
  hrPenaltyPending: number;
}

/* ───────── 라운드 기록 ───────── */

export interface GS2RoundRecord {
  round: number;          // 1 ~ maxRound
  extension: number;      // 0 = 본 게임, 1+ = N차 연장
  actions: { p1: GS2PlayerAction; p2: GS2PlayerAction };
  steps: GS2ResolveStep[];
  finalRoundSugar: { p1: number; p2: number };
  winner: GS2Side | 'tie';
  scoreDelta: { p1: number; p2: number };
  scoreAfter: { p1: number; p2: number };
  sugarRemainAfter: { p1: number; p2: number };
  hrPenaltyAppliedNextRound: { p1: number; p2: number };
}

/* ───────── 게임 데이터 (game:state.gameData) ───────── */

export interface GS2GameData {
  phase: GS2Phase;
  round: number;
  maxRound: 8 | 9;
  extension: number;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  /** 본인 입력 미리보기 (서버는 본인 소켓에만 채워서 전송) */
  selfPending?: { card: GS2CardId | null; sugar: number };
  /** 정산 단계 애니메이션 (reveal 페이즈에서만) */
  resolveSteps?: GS2ResolveStep[];
  /** 라운드 결과 (roundEnd 페이즈에서만) */
  roundResult?: GS2RoundRecord;
  history: GS2RoundRecord[];
  finalWinner: GS2Side | 'tie' | null;
  winType: GS2WinType;
  /** 마지막 라운드 여부 (UI 표시용) */
  isFinalRound: boolean;
}

/* ───────── 액션 페이로드 ───────── */

export type GS2Action =
  | { type: 'submit'; card: GS2CardId; sugar: number }
  | { type: 'cancelSubmit' }
  | { type: 'nextRoundReady' };

/* ───────── 헬퍼 ───────── */

export function makeInitialHand(): GS2CardId[] {
  return [...CARD_IDS];
}
