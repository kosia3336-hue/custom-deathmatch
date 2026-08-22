import type {
  CompleteHapCard,
  CompleteHapPhase,
  CompleteHapRoundResult,
  CompleteHapTiebreak,
} from '@shared/types/complete-hap.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type CompleteHapEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface CompleteHapInternalRound {
  cards: CompleteHapCard[];
  allSets: number[][];
  allSetKeys: Set<string>;
  result: CompleteHapRoundResult | null;
}

export interface CompleteHapState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  rounds: CompleteHapInternalRound[];
  currentRoundIndex: number;
  totalRounds: number;
  phase: CompleteHapPhase;
  scores: Record<string, number>;
  roundStartedAt: number;
  matchStartedAt: number;
  matchSeconds: number | null;
  roundResults: CompleteHapRoundResult[];
  lastRoundResult: CompleteHapRoundResult | null;
  tiebreak: CompleteHapTiebreak;
  winnerId: string | null;
  finishReason: string | null;
  gameOver: boolean;
  matchTimer: ReturnType<typeof setTimeout> | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: CompleteHapEndGameFn;
}
