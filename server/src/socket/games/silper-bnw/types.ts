import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  SBNWPhase,
  SBNWTile,
  SBNWWinType,
  SBNWRoundRecord,
  SBNWSegmentSummary,
} from '@shared/types/silper-bnw.js';
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

export interface SBNWPlayerInternal {
  id: string;
  nickname: string;
  score: number;
  tiles: Record<SBNWTile, number>;
  tileCount: number;
  submitted: boolean;
}

export interface SBNWPlayerSnapshot {
  score: number;
  tiles: Record<SBNWTile, number>;
  tileCount: number;
  submitted: boolean;
}

export interface SBNWUndoSnapshot {
  round: number;
  phase: SBNWPhase;
  rematchIndex: number;
  firstPlayerId: string;
  firstTiles: SBNWTile[] | null;
  firstDigits: number | null;
  player1: SBNWPlayerSnapshot;
  player2: SBNWPlayerSnapshot;
  actionLog: SBNWRoundRecord[];
  consecutiveTimeouts: Record<string, number>;
}

export interface InternalState {
  endGameCallback: EndGameFn;
  onAITurn?: (io: IO, s: InternalState) => void;
  roomId: string;

  round: number;
  phase: SBNWPhase;
  firstPlayerId: string;
  rematchIndex: number;

  player1: SBNWPlayerInternal;
  player2: SBNWPlayerInternal;

  firstTiles: SBNWTile[] | null;
  firstDigits: number | null;
  secondTiles: SBNWTile[] | null;

  actionLog: SBNWRoundRecord[];
  segmentsHistory: SBNWSegmentSummary[];

  winner: string | null;
  winType: SBNWWinType | null;
  finishReason: string | null;

  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;

  playMode: PlayMode;
  gameOver: boolean;
  aiGeneration: number;
  undoSnapshots: SBNWUndoSnapshot[];

  consecutiveTimeouts: Record<string, number>;
  /** 마지막 자동 제시(타임아웃)된 플레이어 ID (UI 알림용) */
  lastAutoSubmittedBy?: string | null;
}
