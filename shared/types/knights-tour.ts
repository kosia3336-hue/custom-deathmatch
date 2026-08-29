/** 나이트의 여행 — 60초 동안 같은 판에서 더 많은 칸을 방문하는 7라운드 레이스. */

export const KT_TOTAL_ROUNDS = 7;
export const KT_WIN_SCORE = 4;
export const KT_ROUND_SECONDS = 60;

export interface KnightTourCell {
  row: number;
  col: number;
}

export interface KnightTourBoard {
  size: number;
  activeCells: KnightTourCell[];
  shapeId: string;
}

export type KnightTourPhase = 'playing' | 'round-result' | 'finished';

export interface KnightTourPlayerProgress {
  current: KnightTourCell | null;
  visitedCount: number;
  submitted: boolean;
  submittedElapsedMs: number | null;
  /** 자신의 경로와 라운드 결과에서만 공개된다. */
  path?: KnightTourCell[];
}

export type KnightTourAction =
  | { type: 'move'; row: number; col: number }
  | { type: 'backtrack' }
  | { type: 'reset' }
  | { type: 'submit' };

export interface KnightTourRoundResult {
  round: number;
  winnerId: string | null;
  reason: 'submitted' | 'timeout' | 'completed';
  elapsedMs: number | null;
  matchElapsedMs: number | null;
  winningPath: KnightTourCell[];
  paths: Record<string, KnightTourCell[]>;
  visitedCounts: Record<string, number>;
  submissionElapsedMs: Record<string, number>;
  autoSubmitted: Record<string, boolean>;
  /** COM이 참고하는 유효 경로. 모든 열린 칸을 포함하지 않을 수 있다. */
  solution: KnightTourCell[];
  scoresAfter: Record<string, number>;
}

export interface KnightTourGameData {
  phase: KnightTourPhase;
  board: KnightTourBoard;
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  progress: Record<string, KnightTourPlayerProgress>;
  roundStartedAt: number;
  roundSeconds: number;
  lastRoundResult: KnightTourRoundResult | null;
  isSolo: boolean;
  playMode: 'multi' | 'com' | 'solo';
  winnerId: string | null;
  finishReason: string | null;
}

export type KnightTourTiebreak = 'solo' | 'count' | 'speed' | 'zero-draw';

export interface KnightTourArchiveRound {
  round: number;
  board: KnightTourBoard;
  solution: KnightTourCell[];
  result: KnightTourRoundResult | null;
}

export interface KnightTourArchiveRecord {
  rounds: KnightTourArchiveRound[];
  totalRounds: number;
  finalScores: Record<string, number>;
  roundResults: KnightTourRoundResult[];
  tiebreak: KnightTourTiebreak;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
}
