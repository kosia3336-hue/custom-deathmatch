import type {
  FarewellFormulaDifficulty,
  FarewellFormulaRoundResult,
} from '@shared/types/farewell-formula.js';
import type {
  FarewellFormulaToken,
  FarewellFormulaSolution,
} from '@shared/logic/farewell-formula.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type FarewellFormulaEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface FarewellFormulaPuzzle {
  key: string;
  source: string;
  tokens: FarewellFormulaToken[];
  goodbyeCount: number;
  difficulty: FarewellFormulaDifficulty;
  solutions: FarewellFormulaSolution[];
}

export interface FarewellFormulaState {
  roomId: string;
  playMode: PlayMode;
  difficulty: FarewellFormulaDifficulty;
  players: [Player, Player];
  phase: 'playing' | 'reveal' | 'finished';
  round: number;
  puzzle: FarewellFormulaPuzzle;
  usedPuzzleKeys: Set<string>;
  scores: Record<string, number>;
  history: FarewellFormulaRoundResult[];
  lastResult: FarewellFormulaRoundResult | null;
  feedbackByPlayer: Record<string, { message: string; attemptedAt: number } | null>;
  lastAttemptAt: Record<string, number>;
  roundStartedAt: number;
  roundSeconds: number | null;
  startedAt: number;
  gameOver: boolean;
  roundTimer: ReturnType<typeof setTimeout> | null;
  transitionTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: FarewellFormulaEndGameFn;
}
