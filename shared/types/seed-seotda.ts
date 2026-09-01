import type { PlayMode } from './room';

export const SEED_SEOTDA_INITIAL_CHIPS = 20;
export const SEED_SEOTDA_ANTE = 1;

export type SeedSeotdaMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SeedSeotdaCardVariant = 'a' | 'b';
export type SeedSeotdaCardKind = 'bright' | 'animal' | 'ribbon';

export interface SeedSeotdaCard {
  id: string;
  month: SeedSeotdaMonth;
  variant: SeedSeotdaCardVariant;
  kind: SeedSeotdaCardKind;
}

export type SeedSeotdaPhase = 'seed-choice' | 'betting' | 'round-result' | 'finished';
export type SeedSeotdaSeedChoice = 'pending' | 'used' | 'unused';
export type SeedSeotdaHandKind =
  | '38-gwang-ddaeng'
  | 'gwang-ddaeng'
  | 'ddaeng'
  | 'ali'
  | 'doksa'
  | 'guping'
  | 'jangping'
  | 'jangsa'
  | 'seryuk'
  | 'gapoh'
  | 'kkeut'
  | 'mangtong'
  | 'amhaeng-eosa'
  | 'ddaeng-jabi'
  | 'gusa'
  | 'mung-gusa';

export interface SeedSeotdaEvaluation {
  kind: SeedSeotdaHandKind;
  name: string;
  strength: number;
  pairMonth: SeedSeotdaMonth | null;
  point: number | null;
}

export type SeedSeotdaAction =
  | { type: 'use-seed'; discardIndex: 0 | 1 }
  | { type: 'skip-seed' }
  | { type: 'bet'; amount: number }
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'die' };

export interface SeedSeotdaBettingAction {
  round: number;
  playerId: string;
  action: 'bet' | 'call' | 'raise' | 'die';
  amount: number;
  totalBet: number;
}

export interface SeedSeotdaPlayerView {
  id: string;
  nickname: string;
  chips: number;
  roundBet: number;
  cards: Array<SeedSeotdaCard | null>;
  finalHand: Array<SeedSeotdaCard | null>;
  seedChoice: SeedSeotdaSeedChoice;
}

export type SeedSeotdaRoundReason =
  | 'showdown'
  | 'die'
  | 'tie'
  | 'gusa-rematch'
  | 'mung-gusa-rematch';

export interface SeedSeotdaRoundResult {
  round: number;
  winnerId: string | null;
  reason: SeedSeotdaRoundReason;
  foldedPlayerId: string | null;
  potAmount: number;
  carryRound: boolean;
  seedCard: SeedSeotdaCard;
  hands: Record<string, SeedSeotdaCard[] | null>;
  evaluations: Record<string, SeedSeotdaEvaluation | null>;
  seedChoices: Record<string, Exclude<SeedSeotdaSeedChoice, 'pending'>>;
  diePenalty: number;
  chipCountsAfter: Record<string, number>;
  actions: SeedSeotdaBettingAction[];
  deckRemainingAfter: number;
}

export interface SeedSeotdaGameData {
  phase: SeedSeotdaPhase;
  playMode: PlayMode;
  round: number;
  ante: number;
  carryRound: boolean;
  players: Record<string, SeedSeotdaPlayerView>;
  seedCard: SeedSeotdaCard | null;
  pot: number;
  deckRemaining: number;
  currentTurnId: string | null;
  firstPlayerId: string;
  bettingOpened: boolean;
  currentBet: number;
  toCall: number;
  minBet: number | null;
  maxBet: number | null;
  minRaise: number | null;
  maxRaise: number | null;
  lastRoundResult: SeedSeotdaRoundResult | null;
  roundStartedAt: number;
  turnStartedAt: number | null;
  turnSeconds: number | null;
  winnerId: string | null;
  finishReason: string | null;
}

export interface SeedSeotdaArchiveRecord {
  rounds: SeedSeotdaRoundResult[];
  finalChips: Record<string, number>;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
  totalRounds: number;
  deckCycles: number;
}
