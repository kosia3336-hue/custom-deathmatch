import type {
  KnightTourCell,
  KnightTourPhase,
  KnightTourRoundResult,
  KnightTourTiebreak,
} from '@shared/types/knights-tour.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';
import type { KnightTourRoundDefinition } from './generator.js';

export type KnightTourEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface KnightTourInternalRound extends KnightTourRoundDefinition {
  result: KnightTourRoundResult | null;
}

export interface KnightTourState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  rounds: KnightTourInternalRound[];
  currentRoundIndex: number;
  totalRounds: number;
  phase: KnightTourPhase;
  scores: Record<string, number>;
  paths: Record<string, KnightTourCell[]>;
  roundStartedAt: number;
  matchStartedAt: number;
  roundSeconds: number | null;
  roundResults: KnightTourRoundResult[];
  lastRoundResult: KnightTourRoundResult | null;
  tiebreak: KnightTourTiebreak;
  winnerId: string | null;
  finishReason: string | null;
  gameOver: boolean;
  roundTimer: ReturnType<typeof setTimeout> | null;
  transitionTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: KnightTourEndGameFn;
}
