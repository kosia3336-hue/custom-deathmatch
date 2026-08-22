/** 컴플릿 합! — 27장 덱에서 3개의 3×3 보드를 동시에 푸는 선착순 관찰 게임. */

export const CH_BOARD_COUNT = 3;
export const CH_CARDS_PER_BOARD = 9;
export const CH_MATCH_SECONDS = 10 * 60;

export type CompleteHapShape = 'circle' | 'triangle' | 'square';
export type CompleteHapBackground = 'black' | 'gray' | 'white';
export type CompleteHapCardColor = 'red' | 'yellow' | 'blue';

export interface CompleteHapCard {
  shape: CompleteHapShape;
  background: CompleteHapBackground;
  color: CompleteHapCardColor;
}

export function completeHapCardKey(card: CompleteHapCard): string {
  return `${card.shape}:${card.background}:${card.color}`;
}

export type CompleteHapPhase = 'playing' | 'finished';

/** 한 플레이어가 보드 안의 합 하나를 맞힌 기록. 개별 합에는 점수가 없다. */
export interface CompleteHapCall {
  boardIndex: number;
  cardIndexes: number[];
  playerId: string;
  elapsedMs: number;
}

/** 보드의 모든 합을 먼저 완성해 문제 정답 1개를 획득한 기록. */
export interface CompleteHapProblemClaim {
  boardIndex: number;
  playerId: string;
  elapsedMs: number;
}

export interface CompleteHapBoard {
  cards: CompleteHapCard[];
  winnerId: string | null;
  claimedAtMs: number | null;
  /** 플레이어별로 현재까지 찾은 서로 다른 합 개수. */
  progress: Record<string, number>;
  /** 현재 접속자 본인이 찾은 합만 공개한다. 관전자에게는 빈 배열이다. */
  myFoundSets: number[][];
}

export type CompleteHapAction = {
  type: 'submit-hap';
  boardIndex: number;
  cardIndexes: number[];
};

export interface CompleteHapGameData {
  phase: CompleteHapPhase;
  boards: CompleteHapBoard[];
  /** 플레이어별로 먼저 완성한 문제 수. */
  correctCounts: Record<string, number>;
  players: Record<string, { nickname: string }>;
  matchStartedAt: number;
  /** null이면 멀티 무제한 방. COM·솔로는 기본 10분이다. */
  matchSeconds: number | null;
  problemClaims: CompleteHapProblemClaim[];
  lastProblemClaim: CompleteHapProblemClaim | null;
  isSolo: boolean;
  playMode: 'multi' | 'com' | 'solo';
  winnerId: string | null;
  finishReason: string | null;
}

export type CompleteHapTiebreak = 'solo' | 'count' | 'speed' | 'zero-draw';

export interface CompleteHapArchiveBoard {
  cards: CompleteHapCard[];
  allSets: number[][];
  calls: CompleteHapCall[];
  winnerId: string | null;
  claimedAtMs: number | null;
}

export interface CompleteHapArchiveRecord {
  boards: CompleteHapArchiveBoard[];
  finalCorrectCounts: Record<string, number>;
  problemClaims: CompleteHapProblemClaim[];
  tiebreak: CompleteHapTiebreak;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
}
