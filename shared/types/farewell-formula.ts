import type { FarewellFormulaToken } from '../logic/farewell-formula';

/** 이별 공식 — 정해진 횟수만큼 문자/기호를 지워 올바른 등식을 만드는 선착순 게임. */
export const FF_TOTAL_ROUNDS = 7;
export const FF_WIN_SCORE = 4;
export const FF_REVEAL_MS = 2800;

export type FarewellFormulaPhase = 'playing' | 'reveal' | 'finished';

export type FarewellFormulaAction = {
  type: 'submit';
  removedUnitIds: number[];
};

export interface FarewellFormulaAttemptFeedback {
  message: string;
  attemptedAt: number;
}

export interface FarewellFormulaRoundResult {
  round: number;
  source: string;
  goodbyeCount: number;
  callerId: string | null;
  outcome: 'correct' | 'timeout';
  removedUnitIds: number[];
  correctedExpression: string;
  answerRemovedUnitIds: number[];
  answerExpression: string;
  reason: string;
  elapsedMs: number | null;
  scoresAfter: Record<string, number>;
}

export interface FarewellFormulaGameData {
  phase: FarewellFormulaPhase;
  round: number;
  totalRounds: number;
  source: string;
  tokens: FarewellFormulaToken[];
  goodbyeCount: number;
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  roundStartedAt: number;
  roundSeconds: number | null;
  lastResult: FarewellFormulaRoundResult | null;
  history: FarewellFormulaRoundResult[];
  myFeedback: FarewellFormulaAttemptFeedback | null;
  isSolo: boolean;
}

export interface FarewellFormulaArchiveRecord {
  finalScores: Record<string, number>;
  history: FarewellFormulaRoundResult[];
  players: Record<string, { nickname: string }>;
}
