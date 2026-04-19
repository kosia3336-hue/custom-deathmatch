import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  WSCardType, WSPhase, WSWinType, WSCardCount, WSMatchResult,
} from '@shared/types/winning-streak.js';
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

export interface WSPlayerInternal {
  id: string;
  nickname: string;
  currentStreak: number;
  maxStreak: number;
  totalWins: number;
  remainingCards: WSCardCount;
  lastPlayedCard: WSCardType | null;
  selectedCard: WSCardType | null;
  submitted: boolean;
}

export interface WSRoundActionLog {
  round: number;
  players: Record<string, {
    nickname: string;
    card: WSCardType;
    result: WSMatchResult;
    streakBefore: number;
    streakAfter: number;
    maxStreakAfter: number;
    totalWinsAfter: number;
  }>;
  matchDescription: string;
}

export interface WSPlayerSnapshot {
  currentStreak: number;
  maxStreak: number;
  totalWins: number;
  remainingCards: WSCardCount;
  lastPlayedCard: WSCardType | null;
  selectedCard: WSCardType | null;
  submitted: boolean;
}

export interface WSUndoSnapshot {
  round: number;
  phase: WSPhase;
  player1: WSPlayerSnapshot;
  player2: WSPlayerSnapshot;
  roundHistory: WSRoundActionLog[];
  actionLog: WSRoundActionLog[];
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  round: number;
  phase: WSPhase;
  player1: WSPlayerInternal;
  player2: WSPlayerInternal;
  roundHistory: WSRoundActionLog[];
  actionLog: WSRoundActionLog[];
  winner: string | null;
  winType: WSWinType;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  aiGeneration: number;
  undoSnapshots: WSUndoSnapshot[];
  consecutiveTimeouts: Record<string, number>;
  onAITurn?: (io: IO, s: InternalState) => void;
}
