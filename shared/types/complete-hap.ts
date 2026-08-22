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

export interface CompleteHapClaim {
  boardIndex: number;
  cardIndexes: number[];
  playerId: string;
  /** 매치 시작부터 정답 선점까지 걸린 시간. */
  elapsedMs: number;
}

export interface CompleteHapBoard {
  cards: CompleteHapCard[];
  /** 서버가 인정한 합만 공개한다. 전체 정답 목록은 게임 종료 뒤 기록에만 포함된다. */
  claims: CompleteHapClaim[];
}

export type CompleteHapAction = {
  type: 'submit-hap';
  boardIndex: number;
  cardIndexes: number[];
};

export interface CompleteHapGameData {
  phase: CompleteHapPhase;
  boards: CompleteHapBoard[];
  /** 점수가 아니라 플레이어별 선점 정답 수다. */
  correctCounts: Record<string, number>;
  players: Record<string, { nickname: string }>;
  matchStartedAt: number;
  matchSeconds: number;
  claims: CompleteHapClaim[];
  lastClaim: CompleteHapClaim | null;
  isSolo: boolean;
  playMode: 'multi' | 'com' | 'solo';
  winnerId: string | null;
  finishReason: string | null;
}

export type CompleteHapTiebreak = 'solo' | 'count' | 'speed' | 'zero-draw';

export interface CompleteHapArchiveRecord {
  boards: Array<CompleteHapBoard & { allSets: number[][] }>;
  finalCorrectCounts: Record<string, number>;
  claims: CompleteHapClaim[];
  tiebreak: CompleteHapTiebreak;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
}
