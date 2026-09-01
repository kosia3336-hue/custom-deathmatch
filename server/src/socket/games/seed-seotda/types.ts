import type {
  SeedSeotdaBettingAction,
  SeedSeotdaCard,
  SeedSeotdaPhase,
  SeedSeotdaRoundResult,
  SeedSeotdaSeedChoice,
} from '@shared/types/seed-seotda.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type SeedSeotdaEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface SeedSeotdaInternalPlayer {
  chips: number;
  roundBet: number;
  cards: [SeedSeotdaCard, SeedSeotdaCard] | [];
  finalHand: [SeedSeotdaCard, SeedSeotdaCard] | [];
  seedChoice: SeedSeotdaSeedChoice;
  discardIndex: 0 | 1 | null;
}

export interface SeedSeotdaState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  playerStates: Record<string, SeedSeotdaInternalPlayer>;
  phase: SeedSeotdaPhase;
  round: number;
  ante: number;
  carryRound: boolean;
  pot: number;
  deck: SeedSeotdaCard[];
  deckCycles: number;
  seedCard: SeedSeotdaCard | null;
  firstPlayerId: string;
  currentTurnId: string | null;
  bettingOpened: boolean;
  roundActions: SeedSeotdaBettingAction[];
  roundResults: SeedSeotdaRoundResult[];
  lastRoundResult: SeedSeotdaRoundResult | null;
  startedAt: number;
  roundStartedAt: number;
  turnStartedAt: number | null;
  turnSeconds: number | null;
  winnerId: string | null;
  finishReason: string | null;
  gameOver: boolean;
  turnTimer: ReturnType<typeof setTimeout> | null;
  transitionTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: SeedSeotdaEndGameFn;
}
