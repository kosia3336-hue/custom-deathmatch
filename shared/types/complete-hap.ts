/** 컴플릿 결! 합! — 27장 덱에서 3개의 3×3 보드를 동시에 푸는 관찰 게임. */

export const CH_BOARD_COUNT = 3;
export const CH_CARDS_PER_BOARD = 9;
export const CH_MATCH_SECONDS = 10 * 60;
export const CH_TURN_SECONDS = 10;
export const CH_CALL_SECONDS = 5;
export const CH_HAP_SCORE = 1;
export const CH_GYUL_SCORE = 3;

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

export type CompleteHapPhase = 'turn' | 'selecting' | 'finished';

export interface CompleteHapBoard {
  cards: CompleteHapCard[];
  /** 이미 정답으로 인정된 카드 번호 조합. 번호는 0부터 시작하고 항상 오름차순이다. */
  claimedSets: number[][];
  completed: boolean;
}

export type CompleteHapAction =
  | { type: 'call-hap'; boardIndex: number }
  | { type: 'submit-hap'; boardIndex: number; cardIndexes: number[] }
  | { type: 'call-gyul'; boardIndex: number };

export type CompleteHapActionKind =
  | 'hap'
  | 'gyul'
  | 'wrong-hap'
  | 'wrong-gyul'
  | 'duplicate-hap'
  | 'call-timeout'
  | 'turn-timeout';

export interface CompleteHapActionRecord {
  turn: number;
  playerId: string;
  kind: CompleteHapActionKind;
  boardIndex: number | null;
  cardIndexes: number[] | null;
  scoreDelta: number;
  scoreAfter: number;
  elapsedMs: number;
  createdAt: number;
}

export interface CompleteHapGameData {
  phase: CompleteHapPhase;
  boards: CompleteHapBoard[];
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  currentPlayerId: string;
  selectedBoardIndex: number | null;
  turn: number;
  phaseStartedAt: number;
  matchStartedAt: number;
  matchSeconds: number;
  turnSeconds: number;
  callSeconds: number;
  actionLog: CompleteHapActionRecord[];
  lastAction: CompleteHapActionRecord | null;
  isSolo: boolean;
  playMode: 'multi' | 'com' | 'solo';
  winnerId: string | null;
  finishReason: string | null;
}

export interface CompleteHapArchiveRecord {
  boards: Array<CompleteHapBoard & { allSets: number[][] }>;
  finalScores: Record<string, number>;
  correctElapsedMs: Record<string, number>;
  actionLog: CompleteHapActionRecord[];
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
}
