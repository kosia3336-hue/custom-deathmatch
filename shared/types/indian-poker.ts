export const INITIAL_CHIPS_DEFAULT = 25;
export const INITIAL_ANTE = 1;
export const CARDS_PER_ROUND = 4;
export const DECK_RESET_THRESHOLD = 4;

export type IPPhase = 'dealing' | 'betting' | 'showdown' | 'dieResult' | 'finished';
export type IPHand = 'noPair' | 'double' | 'straight' | 'triple';
export type IPWinType = 'chipOut' | 'anteLack' | 'timeout' | 'leave';
export type IPActionType = 'check' | 'call' | 'raise' | 'die';

export interface IPPlayerInfo {
  id: string;
  nickname: string;
  chips: number;
  roundBet: number;
  card: number | null;
  hand: IPHand | null;
}

export interface IPShowdownData {
  players: Record<string, {
    card: number;
    hand: IPHand;
    chipChange: number;
  }>;
  winnerId: string | null;
  isDraw: boolean;
}

export interface IPDieData {
  diedPlayerId: string;
  diedCard: number;
  diedHand: IPHand;
  penalty: number;
  potAmount: number;
  chipChanges: Record<string, number>;
}

export interface IPBettingAction {
  playerId: string;
  action: IPActionType;
  amount?: number;
}

export interface IPRoundRecord {
  round: number;
  communityCards: [number, number];
  winnerId: string | null;
  isDraw: boolean;
  isDie: boolean;
  chipChanges: Record<string, number>;
  bettingActions: IPBettingAction[];
  hands?: Record<string, { card: number; hand: IPHand }>;
}

export interface IndianPokerGameData {
  round: number;
  phase: IPPhase;
  communityCards: [number, number] | null;
  players: Record<string, IPPlayerInfo>;
  pot: number;
  currentTurnId: string | null;
  currentBet: number;
  ante: number;
  deckRemaining: number;
  deckCycle: number;
  firstBettorId: string | null;
  bettingStarted: boolean;
  /** 이번 라운드 베팅 순서 (무르기·표시용, 라운드 종료 시 비움) */
  currentRoundActions: IPBettingAction[];
  /** 이번 라운드 시작 전 덱 리셋이 발생했으면 true */
  deckResetOccurred: boolean;
  showdownData: IPShowdownData | null;
  dieData: IPDieData | null;
  winner: string | null;
  winType: IPWinType | null;
  roundHistory: IPRoundRecord[];
}

export type IndianPokerAction =
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'die' };
