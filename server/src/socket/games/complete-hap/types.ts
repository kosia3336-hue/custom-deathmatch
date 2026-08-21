import type {
  CompleteHapActionRecord,
  CompleteHapCard,
  CompleteHapPhase,
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
  claimedSets: number[][];
  claimedSetKeys: Set<string>;
  completed: boolean;
}

export interface CompleteHapState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  boards: CompleteHapInternalBoard[];
  phase: CompleteHapPhase;
  scores: Record<string, number>;
  correctElapsedMs: Record<string, number>;
  firstCorrectAt: Record<string, number | null>;
  currentPlayerId: string;
  selectedBoardIndex: number | null;
  turn: number;
  turnStartedAt: number;
  phaseStartedAt: number;
  matchStartedAt: number;
  actionLog: CompleteHapActionRecord[];
  lastAction: CompleteHapActionRecord | null;
  winnerId: string | null;
  finishReason: string | null;
  gameOver: boolean;
  matchTimer: ReturnType<typeof setTimeout> | null;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: CompleteHapEndGameFn;
}
