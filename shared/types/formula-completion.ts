/** 수식완성N — 제시된 N개의 수를 각각 한 번씩 사용해 타깃넘버를 만드는 스피드 게임. */

export const FC_TOTAL_ROUNDS = 7;
export const FC_MIN_NUMBER_COUNT = 4;
export const FC_MAX_NUMBER_COUNT = 6;
export const FC_DEFAULT_NUMBER_COUNT = 4;
export const FC_REVEAL_MS = 3200;

export type FormulaCompletionPhase = 'playing' | 'reveal' | 'finished';
export type FormulaCompletionRoundOutcome = 'correct' | 'wrong' | 'timeout';

export type FormulaCompletionAction = {
  type: 'submit';
  expression: string;
};

export interface FormulaCompletionRoundResult {
  round: number;
  numbers: number[];
  target: number;
  outcome: FormulaCompletionRoundOutcome;
  callerId: string | null;
  expression: string | null;
  evaluatedValue: string | null;
  scoreDelta: number;
  scoresAfter: Record<string, number>;
  /** 출제기가 보장한 예시 해답. 정답은 이것과 다른 수식이어도 된다. */
  solution: string;
  reason: string;
  elapsedMs: number | null;
}

export interface FormulaCompletionGameData {
  phase: FormulaCompletionPhase;
  round: number;
  totalRounds: number;
  numberCount: number;
  numbers: number[];
  target: number;
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  roundStartedAt: number;
  /** null이면 라운드 시간 제한 없음. */
  roundSeconds: number | null;
  lastResult: FormulaCompletionRoundResult | null;
  history: FormulaCompletionRoundResult[];
  /** 1인 솔로 모드 — 상대 없이 혼자 7라운드를 푼다. */
  isSolo: boolean;
}

export interface FormulaCompletionArchiveRecord {
  numberCount: number;
  finalScores: Record<string, number>;
  history: FormulaCompletionRoundResult[];
  players: Record<string, { nickname: string }>;
}
