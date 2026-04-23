import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type { BNW2Phase, BNW2Color, BNW2WinType } from '@shared/types/bnw2.js';
import type { IO } from './constants.js';

export type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings: GameResult['rankings'];
    totalTurns: number;
    gameResultData?: unknown;
  },
) => void;

export interface BNW2PlayerInternal {
  id: string;
  nickname: string;
  score: number;
  remainingPoints: number;
  submitted: boolean;
}

export interface BNW2RoundLog {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    nickname: string;
    points: number;
    color: BNW2Color;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    stageBefore: number;
    stageAfter: number;
  }>;
  winnerId: string | null;
}

export interface BNW2PlayerSnapshot {
  score: number;
  remainingPoints: number;
  submitted: boolean;
}

export interface BNW2UndoSnapshot {
  round: number;
  phase: BNW2Phase;
  firstPlayerId: string;
  firstPoints: number | null;
  player1: BNW2PlayerSnapshot;
  player2: BNW2PlayerSnapshot;
  actionLog: BNW2RoundLog[];
}

export interface InternalState {
  endGameCallback: EndGameFn;
  onAITurn?: (io: IO, s: InternalState) => void;
  roomId: string;
  round: number;
  phase: BNW2Phase;
  firstPlayerId: string;
  player1: BNW2PlayerInternal;
  player2: BNW2PlayerInternal;
  firstPoints: number | null;
  secondPoints: number | null;
  /** AI용: firstSubmit 직전 선플의 단계 */
  prevFirstStage: number;
  winner: string | null;
  winType: BNW2WinType | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  actionLog: BNW2RoundLog[];
  aiGeneration: number;
  undoSnapshots: BNW2UndoSnapshot[];
}
