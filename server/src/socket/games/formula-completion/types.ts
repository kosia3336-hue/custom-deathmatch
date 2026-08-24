import type { Player, PlayMode } from '@shared/types/room.js';
import type { FormulaCompletionRoundResult } from '@shared/types/formula-completion.js';
import type { IO } from '../../types.js';

export type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface FormulaPuzzle {
  numbers: number[];
  target: number;
  solution: string;
  key: string;
  pattern: 'balanced' | 'left-chain' | 'right-chain';
}

export interface FormulaCompletionState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  phase: 'playing' | 'reveal' | 'finished';
  round: number;
  numberCount: number;
  numbers: number[];
  target: number;
  solution: string;
  usedPuzzleKeys: Set<string>;
  scores: Record<string, number>;
  history: FormulaCompletionRoundResult[];
  lastResult: FormulaCompletionRoundResult | null;
  roundStartedAt: number;
  roundSeconds: number | null;
  startedAt: number;
  gameOver: boolean;
  roundTimer: ReturnType<typeof setTimeout> | null;
  transitionTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EndGameFn;
}
