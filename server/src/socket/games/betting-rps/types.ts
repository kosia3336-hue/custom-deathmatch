import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  BRPSPhase, BRPSResult, BRPSRole, BRPSBetOutcome, BRPSWinType,
} from '@shared/types/betting-rps.js';
import type { IO } from './constants.js';

export interface BRPSPlayerSnapshot {
  chips: number;
  role: BRPSRole;
  hasChoiceRight: boolean;
  submitted: boolean;
  matchResult: BRPSResult | null;
  prediction: BRPSResult | null;
  betChips: number | null;
}

export interface BRPSUndoSnapshot {
  round: number;
  phase: BRPSPhase;
  player1: BRPSPlayerSnapshot;
  player2: BRPSPlayerSnapshot;
  actionLog: BRPSRoundActionLog[];
}

export type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings: GameResult['rankings'];
    totalTurns: number;
    gameResultData?: unknown;
  },
) => void;

export interface BRPSPlayerInternal {
  id: string;
  nickname: string;
  chips: number;
  role: BRPSRole;
  hasChoiceRight: boolean;
  submitted: boolean;
  matchResult: BRPSResult | null;
  prediction: BRPSResult | null;
  betChips: number | null;
}

export interface BRPSRoundActionLog {
  round: number;
  choiceRightPlayerId: string;
  players: Record<string, {
    nickname: string;
    role: BRPSRole;
    matchResult: BRPSResult | null;
    prediction: BRPSResult | null;
    betChips: number | null;
    betOutcome: BRPSBetOutcome | null;
    chipsBefore: number;
    chipsAfter: number;
    chipChange: number;
  }>;
}

export interface InternalState {
  endGameCallback: EndGameFn;
  onAITurn?: (io: IO, s: InternalState) => void;
  roomId: string;
  round: number;
  totalRounds: number;
  phase: BRPSPhase;
  player1: BRPSPlayerInternal;
  player2: BRPSPlayerInternal;
  roundHistory: BRPSRoundActionLog[];
  winner: string | null;
  winType: BRPSWinType | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  actionLog: BRPSRoundActionLog[];
  aiGeneration: number;
  /** 무르기용 라운드 스냅샷 스택 */
  undoSnapshots: BRPSUndoSnapshot[];
}
