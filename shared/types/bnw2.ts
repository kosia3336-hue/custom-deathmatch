export const BNW2_INITIAL_POINTS = 200;
export const BNW2_MAX_SCORE = 10;
export const BNW2_STAGE_UNIT = 20;
export const BNW2_TOTAL_STAGES = 10;

export type BNW2Phase = 'firstSubmit' | 'secondSubmit' | 'reveal' | 'finished';
export type BNW2Color = 'black' | 'white';
export type BNW2WinType = 'score' | 'exhaustion' | 'draw' | 'timeout' | 'leave';

export function calcBNW2Stage(remainingPoints: number): number {
  if (remainingPoints <= 0) return 0;
  return Math.ceil(remainingPoints / BNW2_STAGE_UNIT);
}

export function calcBNW2Color(points: number): BNW2Color {
  return points < 10 ? 'black' : 'white';
}

export interface BNW2PlayerInfo {
  id: string;
  nickname: string;
  score: number;
  stage: number;
  /** 본인에게만 공개. 상대방/관전자는 null */
  remainingPoints: number | null;
  submitted: boolean;
}

export interface BNW2RevealData {
  players: Record<string, {
    color: BNW2Color;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    stageBefore: number;
    stageAfter: number;
  }>;
  winnerId: string | null;
}

export interface BNW2RoundRecord {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    color: BNW2Color;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    stageBefore: number;
    stageAfter: number;
  }>;
  winnerId: string | null;
}

export interface BNW2GameData {
  phase: BNW2Phase;
  round: number;
  firstPlayerId: string;
  players: Record<string, BNW2PlayerInfo>;
  /** secondSubmit 페이즈에만 존재. 선플의 제시 전 단계 */
  prevFirstStage: number | null;
  /** secondSubmit 페이즈에만 존재. 선플이 제시한 포인트의 색(흑/백) */
  firstPlayerColor: BNW2Color | null;
  revealData: BNW2RevealData | null;
  roundHistory: BNW2RoundRecord[];
  winner: string | null;
  winType: BNW2WinType | null;
}

export type BNW2Action =
  | { type: 'submitFirst'; points: number }
  | { type: 'submitSecond'; points: number };
