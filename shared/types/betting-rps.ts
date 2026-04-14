export const BRPS_TOTAL_ROUNDS = 10;
export const BRPS_INITIAL_CHIPS = 2;
export const BRPS_BET_MULTIPLIER = 3;

/** 승부 플레이어가 '승'을 선택했을 때 획득하는 칩 수 (라운드 기반 스케일링) */
export function brpsMatchWinBonus(round: number): number {
  return Math.ceil(round / 3);
}

export type BRPSPhase = 'roleSelect' | 'submit' | 'reveal' | 'finished';
export type BRPSResult = 'win' | 'draw' | 'lose';
export type BRPSRole = 'match' | 'bet' | null;
export type BRPSBetOutcome = 'success' | 'fail' | 'refund';
export type BRPSWinType = 'chips' | 'draw' | 'timeout' | 'leave';

export interface BRPSPlayerInfo {
  id: string;
  nickname: string;
  chips: number;
  role: BRPSRole;
  hasChoiceRight: boolean;
  submitted: boolean;
  /** submit 페이즈: 본인(match 역할)에게만 공개, 나머지 null */
  matchResult: BRPSResult | null;
  /** submit 페이즈: 본인(bet 역할)에게만 공개, 나머지 null */
  prediction: BRPSResult | null;
  /** submit 페이즈: 본인(bet 역할)에게만 공개, 나머지 null */
  betChips: number | null;
}

export interface BRPSRevealPlayerData {
  role: BRPSRole;
  matchResult: BRPSResult | null;
  prediction: BRPSResult | null;
  betChips: number | null;
  betOutcome: BRPSBetOutcome | null;
  chipsBefore: number;
  chipsAfter: number;
  chipChange: number;
}

export interface BRPSRevealData {
  players: Record<string, BRPSRevealPlayerData>;
}

export interface BRPSRoundRecord {
  round: number;
  choiceRightPlayerId: string;
  players: Record<string, {
    role: BRPSRole;
    matchResult: BRPSResult | null;
    prediction: BRPSResult | null;
    betChips: number | null;
    betOutcome: BRPSBetOutcome | null;
    chipsBefore: number;
    chipsAfter: number;
    chipChange: number;
  }>;
}

export interface BettingRpsGameData {
  phase: BRPSPhase;
  round: number;
  totalRounds: number;
  players: Record<string, BRPSPlayerInfo>;
  revealData: BRPSRevealData | null;
  roundHistory: BRPSRoundRecord[];
  winner: string | null;
  winType: BRPSWinType | null;
}

export type BettingRpsAction =
  | { type: 'selectRole'; role: 'match' | 'bet' }
  | { type: 'submitMatch'; result: BRPSResult }
  | { type: 'submitBet'; prediction: BRPSResult; chips: number };
