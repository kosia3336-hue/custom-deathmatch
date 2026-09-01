import type {
  DoubleSidedPokerBettingAction,
  DoubleSidedPokerCard,
  DoubleSidedPokerPhase,
  DoubleSidedPokerRoundResult,
  DoubleSidedPokerSelection,
} from '@shared/types/double-sided-poker.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type DoubleSidedPokerEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface DoubleSidedPokerInternalPlayer {
  chips: number;
  card: DoubleSidedPokerCard | null;
  selection: DoubleSidedPokerSelection;
  stake: number;
  frontBet: number;
  backBet: number;
}

export interface DoubleSidedPokerState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  playerStates: Record<string, DoubleSidedPokerInternalPlayer>;
  phase: DoubleSidedPokerPhase;
  round: number;
  ante: number;
  carryRound: boolean;
  pot: number;
  deck: DoubleSidedPokerCard[];
  deckCycles: number;
  firstPlayerId: string;
  currentTurnId: string | null;
  bettingOpened: boolean;
  doubleBettorId: string | null;
  roundActions: DoubleSidedPokerBettingAction[];
  roundResults: DoubleSidedPokerRoundResult[];
  lastRoundResult: DoubleSidedPokerRoundResult | null;
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
  endGameCallback: DoubleSidedPokerEndGameFn;
}
