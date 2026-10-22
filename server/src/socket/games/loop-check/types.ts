import type { LoopCheckGameData, LoopCheckRoundResult } from '@shared/types/loop-check.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type LoopCheckEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface LoopCheckState {
  roomId: string;
  playMode: PlayMode;
  players: Player[];
  phase: LoopCheckGameData['phase'];
  round: number;
  roundId: string;
  bestOf: LoopCheckGameData['bestOf'];
  winScore: number;
  colorMode: LoopCheckGameData['colorMode'];
  board: LoopCheckGameData['board'];
  solution: number[];
  scores: Record<string, number>;
  startedAt: number;
  roundStartedAt: number;
  roundSeconds: number | null;
  history: LoopCheckRoundResult[];
  lastResult: LoopCheckRoundResult | null;
  feedbackByPlayer: Record<string, { message: string; attemptedAt: number }>;
  lastAttemptAt: Record<string, number>;
  gameOver: boolean;
  roundTimer: ReturnType<typeof setTimeout> | null;
  transitionTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: LoopCheckEndGameFn;
}
