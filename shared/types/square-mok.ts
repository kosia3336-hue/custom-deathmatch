/**
 * 사각목 — 6×5 판에 번갈아 말을 놓아, 내 말 네 개로 만든 정사각형의 넓이를 겨룬다.
 *
 * 놓는 수: 선 1개 → 후 2개 → 선 2개 → … → 선 2개 → 후 1개 (빈칸이 다 차면 끝).
 * 승점: 내 말 네 개가 꼭짓점인 정사각형마다 넓이(한 변 길이²)만큼. 기울어진 정사각형도 센다.
 *   칸과 칸 사이 거리를 1로 본다 — 두 칸 간격 정사각형은 2×2=4점, (1,2) 기울기는 1²+2²=5점.
 * 동점이면: ① 가장 넓은 정사각형 ② 육목 수 ③ 오목 수(육목 제외) ④ 사목 수(오목·육목 제외).
 *   목은 가로·세로·대각선으로 이어진 내 말 줄(딱 그 길이만). 그래도 같으면 무승부.
 */

export const SQM_COLS = 6;
export const SQM_ROWS = 5;

/** board[row][col] — 놓은 사람 id, 빈칸은 null */
export type SquareMokBoard = (string | null)[][];

export interface SquareMokCell {
  row: number;
  col: number;
}

/** 이번 차례에 놓을 칸들 — 정해진 개수(1 또는 2)만큼 한 번에 낸다 */
export type SquareMokAction = { type: 'place'; cells: SquareMokCell[] };

export interface SquareMokSquare {
  /** 꼭짓점 네 개 (둘레 순서) */
  cells: SquareMokCell[];
  area: number;
}

export interface SquareMokLineCounts {
  six: number;
  five: number;
  four: number;
}

export interface SquareMokScore {
  points: number;
  maxArea: number;
  squares: SquareMokSquare[];
  lines: SquareMokLineCounts;
}

/** 무엇으로 승부가 갈렸나 */
export type SquareMokDecider = 'points' | 'max-square' | 'six' | 'five' | 'four' | 'draw';

export interface SquareMokTurnLog {
  turn: number;
  actorId: string;
  cells: SquareMokCell[];
}

export type SquareMokPhase = 'playing' | 'finished';

export interface SquareMokGameData {
  board: SquareMokBoard;
  players: Record<string, { nickname: string }>;
  firstPlayerId: string;
  currentPlayerId: string;
  phase: SquareMokPhase;
  /** 1부터 — 몇 번째 차례인가 */
  turnNumber: number;
  /** 이번 차례에 놓을 말 개수 */
  quota: number;
  history: SquareMokTurnLog[];
  /** 지금 판 기준 점수 (판이 공개라 실시간으로 보여 준다) */
  scores: Record<string, SquareMokScore>;
  winnerId: string | null;
  decider: SquareMokDecider | null;
  finishReason: string | null;
  turnStartedAt: number | null;
  timeLimitSeconds: number | null;
}

export interface SquareMokArchiveRecord {
  actions: SquareMokTurnLog[];
  players: Record<string, { nickname: string }>;
  firstPlayerId: string;
  secondPlayerId: string;
  finalBoard: SquareMokBoard;
  scores: Record<string, SquareMokScore>;
  winnerId: string | null;
  decider: SquareMokDecider | null;
  finishReason: string;
}
