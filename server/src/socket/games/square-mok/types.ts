import type { Player, PlayMode } from '@shared/types/room.js';
import type {
  SquareMokBoard,
  SquareMokDecider,
  SquareMokPhase,
  SquareMokTurnLog,
} from '@shared/types/square-mok.js';
import type { IO } from '../../types.js';

export type SquareMokEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

/** 무르기용 — 한 차례를 두기 직전 모습. */
export interface SquareMokUndoSnapshot {
  board: SquareMokBoard;
  currentPlayerId: string;
  turnNumber: number;
  historyLength: number;
}

export interface SquareMokState {
  roomId: string;
  /** [선, 후] */
  players: [Player, Player];
  playMode: PlayMode;
  board: SquareMokBoard;
  currentPlayerId: string;
  firstPlayerId: string;
  phase: SquareMokPhase;
  turnNumber: number;
  history: SquareMokTurnLog[];
  undoStack: SquareMokUndoSnapshot[];
  winnerId: string | null;
  decider: SquareMokDecider | null;
  finishReason: string | null;
  gameOver: boolean;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: SquareMokEndGameFn;
}
