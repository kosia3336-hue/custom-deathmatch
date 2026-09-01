import type { PlayMode } from './room';

export const DOUBLE_SIDED_POKER_INITIAL_CHIPS = 25;
export const DOUBLE_SIDED_POKER_ANTE = 1;
export const DOUBLE_SIDED_POKER_DOUBLE_BONUS = 10;

export type DoubleSidedPokerSide = 'front' | 'back';
export type DoubleSidedPokerSelection = DoubleSidedPokerSide | 'both' | null;
export type DoubleSidedPokerPhase = 'betting' | 'round-result' | 'finished';

export interface DoubleSidedPokerCard {
  id: string;
  set: number;
  front: number;
  back: number;
}

export type DoubleSidedPokerAction =
  | { type: 'bet'; side: DoubleSidedPokerSide; amount: number }
  | { type: 'call'; side?: DoubleSidedPokerSide }
  | { type: 'raise'; side?: DoubleSidedPokerSide; amount: number }
  | { type: 'double' }
  | { type: 'fold' };

export interface DoubleSidedPokerBettingAction {
  round: number;
  playerId: string;
  action: 'bet' | 'call' | 'raise' | 'double' | 'fold';
  selection: DoubleSidedPokerSelection;
  payment: number;
  stake: number;
}

export interface DoubleSidedPokerPlayerView {
  id: string;
  nickname: string;
  chips: number;
  card: { front: number; back: number | null } | null;
  selection: DoubleSidedPokerSelection;
  stake: number;
  frontBet: number;
  backBet: number;
}

export type DoubleSidedPokerRoundReason = 'showdown' | 'fold' | 'tie';

export interface DoubleSidedPokerRoundResult {
  round: number;
  winnerId: string | null;
  reason: DoubleSidedPokerRoundReason;
  foldedPlayerId: string | null;
  potAmount: number;
  carriedPotAtStart: boolean;
  doubleBettorId: string | null;
  doubleBonus: number;
  cards: Record<string, { front: number; back: number | null }>;
  selections: Record<string, DoubleSidedPokerSelection>;
  bets: Record<string, { front: number; back: number }>;
  chipCountsAfter: Record<string, number>;
  actions: DoubleSidedPokerBettingAction[];
  deckRemainingAfter: number;
}

export interface DoubleSidedPokerGameData {
  phase: DoubleSidedPokerPhase;
  playMode: PlayMode;
  round: number;
  ante: number;
  carryRound: boolean;
  pot: number;
  deckRemaining: number;
  deckCycles: number;
  players: Record<string, DoubleSidedPokerPlayerView>;
  firstPlayerId: string;
  currentTurnId: string | null;
  bettingOpened: boolean;
  doubleBettorId: string | null;
  currentStake: number;
  toCall: number;
  minBet: number | null;
  maxBet: number | null;
  minRaise: number | null;
  maxRaise: number | null;
  canDouble: boolean;
  doubleCost: number | null;
  lastRoundResult: DoubleSidedPokerRoundResult | null;
  roundStartedAt: number;
  turnStartedAt: number | null;
  turnSeconds: number | null;
  winnerId: string | null;
  finishReason: string | null;
}

export interface DoubleSidedPokerArchiveRecord {
  rounds: DoubleSidedPokerRoundResult[];
  finalChips: Record<string, number>;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
  totalRounds: number;
  deckCycles: number;
}
