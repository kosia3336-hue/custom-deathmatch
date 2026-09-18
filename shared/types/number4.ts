export const TILES_PER_ROUND = 7;
export const TOTAL_ROUNDS = 6;
export const INITIAL_SCORE = 3;
export const INITIAL_WHITE = 22;
export const INITIAL_BLACK = 20;

export type NF4Phase = 'submit' | 'reveal' | 'finished';
export type NF4WinType = 'score' | 'elimination' | 'tiebreaker' | 'timeout' | 'draw';
export type NF4Number = 0 | 1 | 2 | 3 | 4;

export interface NF4PlayerInfo {
  id: string;
  nickname: string;
  score: number;
  remainingWhite: number;
  remainingBlack: number;
  submitted: boolean;
}

export interface NF4RevealPlayerData {
  number: NF4Number;
  success: boolean;
  scoreChange: number;
  conditionDetail: string;
}

export interface NF4RevealData {
  players: Record<string, NF4RevealPlayerData>;
}

export interface NF4RoundRecord {
  round: number;
  players: Record<string, {
    number: NF4Number;
    success: boolean;
    scoreChange: number;
    scoreAfter: number;
  }>;
}

export interface NumberFourGameData {
  round: number;
  phase: NF4Phase;
  players: Record<string, NF4PlayerInfo>;
  revealData: NF4RevealData | null;
  roundHistory: NF4RoundRecord[];
  winner: string | null;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
  currentSide: 'player1' | 'player2' | null;
}

export type NumberFourAction =
  | { type: 'submit'; white: number; black: number; number: NF4Number };
