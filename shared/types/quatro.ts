/**
 * 콰트로 (Quatro) — 심리 카드 게임 공통 타입.
 *
 * 카드: 4문양(스페이드=파랑 > 다이아=노랑 > 하트=빨강 > 클로버=초록) × 1~6 (24장)
 *       + 검정 0 카드 2장 = 총 26장.
 * 콰트로 = 4장의 숫자와 문양이 모두 다른 조합 (검정0은 만능 문양·숫자로 인정,
 *          단 검정0 2장을 모두 보유하면 콰트로 실패).
 */

export type QuatroSuit = 'spade' | 'diamond' | 'heart' | 'club' | 'black';

export interface QuatroCard {
  /** 덱 내 고유 id (예: 'spade-5', 'black-0-a') */
  id: string;
  suit: QuatroSuit;
  num: number; // black = 0, 그 외 1~6
}

/** 문양 우선순위 (높을수록 우선) — 스페이드 > 다이아 > 하트 > 클로버 */
export const QUATRO_SUIT_PRIORITY: Record<QuatroSuit, number> = {
  spade: 4,
  diamond: 3,
  heart: 2,
  club: 1,
  black: 0,
};

export const QUATRO_MAX_MULLIGANS = 2;
export const QUATRO_VP_COUNT = 6;
export const QUATRO_HAND_SIZE = 4;
export const QUATRO_TURN_SECONDS = 60;

export type QuatroPhase =
  | 'mulligan'   // 멀리건 결정 (선→후→선→후)
  | 'open'       // 라운드 시작 — 각자 오픈할 카드 1장 선택 (동시)
  | 'exchange'   // 가상 플레이어와 교환 (A-B-B-A-A-B 순)
  | 'reveal'     // 최종 공개 + 결과
  | 'finished';

export type QuatroAction =
  | { type: 'mulligan'; use: boolean }
  | { type: 'open'; cardId: string }
  | { type: 'exchange'; vpIndex: number; giveCardId: string }
  | { type: 'stop' };

/** 내 시점 카드 (상대 비공개 카드는 null) */
export interface QuatroVisibleCard {
  card: QuatroCard | null; // null = 뒷면
  open: boolean;
}

export interface QuatroVpView {
  index: number;
  /** 플레이어가 넘겨서 공개된 카드들 */
  receivedOpen: QuatroCard[];
  /** 남은 비공개 카드 수 */
  hiddenCount: number;
  /** 나와 교환했는지 */
  usedByMe: boolean;
  /** 상대와 교환했는지 (교환 사실만 공개) */
  usedByOpp: boolean;
  /** 관전자 전용 — 가상 플레이어의 전체 패 (플레이어에게는 없음) */
  cards?: QuatroCard[];
}

/** 아카이브용 진행 로그 */
export type QuatroLogEntry =
  | { round: number; type: 'mulligan'; actorId: string; used: boolean }
  | { round: number; type: 'open'; actorId: string; card: QuatroCard }
  | { round: number; type: 'exchange'; actorId: string; vpIndex: number; gave: QuatroCard; received: QuatroCard }
  | { round: number; type: 'stop'; actorId: string };

export interface QuatroPlayerView {
  id: string;
  nickname: string;
  mulligansUsed: number;
  /** 이번 교환 페이즈에서 스탑 선언 여부 */
  stopped: boolean;
  /** 교환 완료한 가상 플레이어 수 */
  vpUsedCount: number;
  hand: QuatroVisibleCard[]; // 항상 4장 (본인=전부 공개, 상대=오픈만)
}

export interface QuatroResultSummary {
  winnerId: string | null; // null = 무승부
  reason: string;
  hands: Record<string, QuatroCard[]>;
  quatro: Record<string, boolean>;
  sums: Record<string, number>;
}

export interface QuatroGameData {
  phase: QuatroPhase;
  round: number; // 1~4 (오픈 라운드)
  firstId: string; // 이번 라운드 선
  currentTurnId: string | null; // 지금 행동할 사람 (open 단계는 null=동시)
  me: QuatroPlayerView | null; // 관전자는 null
  opp: QuatroPlayerView | null;
  players: Record<string, { nickname: string }>;
  vps: QuatroVpView[];
  /** open 단계: 내가 선택 완료했는지 */
  iOpened: boolean;
  oppOpened: boolean;
  /** 마지막 교환 페이즈(3라운드)에서 남은 필수 교환 수 */
  mustExchangeRemaining: number;
  result: QuatroResultSummary | null;
  /** 턴 제한(초). 0 = 무제한 */
  turnSeconds: number;
}
