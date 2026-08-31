import type {
  ChoiceHoldemBettingAction,
  ChoiceHoldemCard,
  ChoiceHoldemPhase,
  ChoiceHoldemRoundResult,
} from '@shared/types/choice-holdem.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type ChoiceHoldemEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface ChoiceHoldemInternalPlayer {
  chips: number;
  roundBet: number;
  cards: ChoiceHoldemCard[];
}

export interface ChoiceHoldemState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  playerStates: Record<string, ChoiceHoldemInternalPlayer>;
  phase: ChoiceHoldemPhase;
  round: number;
  ante: number;
  carryRound: boolean;
  pot: number;
  communityCards: ChoiceHoldemCard[];
  choiceCards: [ChoiceHoldemCard, ChoiceHoldemCard];
  faceUpIndex: 0 | 1 | null;
  faceUpOwnerId: string | null;
  faceDownOwnerId: string | null;
  firstPlayerId: string;
  currentTurnId: string | null;
  actedSinceRaise: Set<string>;
  roundActions: ChoiceHoldemBettingAction[];
  roundResults: ChoiceHoldemRoundResult[];
  lastRoundResult: ChoiceHoldemRoundResult | null;
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
  endGameCallback: ChoiceHoldemEndGameFn;
}
