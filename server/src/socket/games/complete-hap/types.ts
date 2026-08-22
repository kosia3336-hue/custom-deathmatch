import type {
  CompleteHapCard,
  CompleteHapClaim,
  CompleteHapPhase,
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

export interface CompleteHapInternalBoard {
  cards: CompleteHapCard[];
  allSets: number[][];
  allSetKeys: Set<string>;
  claims: CompleteHapClaim[];
  claimedSetKeys: Set<string>;
}

export interface CompleteHapState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  boards: CompleteHapInternalBoard[];
  phase: CompleteHapPhase;
  correctCounts: Record<string, number>;
  matchStartedAt: number;
  claims: CompleteHapClaim[];
  lastClaim: CompleteHapClaim | null;
  tiebreak: CompleteHapTiebreak;
  winnerId: string | null;
  finishReason: string | null;
  gameOver: boolean;
  matchTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: CompleteHapEndGameFn;
}
