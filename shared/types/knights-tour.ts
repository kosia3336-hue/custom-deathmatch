/** 나이트의 여행 — 같은 판의 모든 칸을 먼저 방문하는 7라운드 레이스. */

export const KT_TOTAL_ROUNDS = 7;
export const KT_WIN_SCORE = 4;

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
  /** 자신의 경로와 라운드 결과에서만 공개된다. */
  path?: KnightTourCell[];
}

export type KnightTourAction =
  | { type: 'move'; row: number; col: number }
  | { type: 'backtrack' }
  | { type: 'reset' };

export interface KnightTourRoundResult {
  round: number;
  winnerId: string | null;
  reason: 'completed' | 'timeout';
  elapsedMs: number | null;
  matchElapsedMs: number | null;
  winningPath: KnightTourCell[];
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
  roundSeconds: number | null;
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
