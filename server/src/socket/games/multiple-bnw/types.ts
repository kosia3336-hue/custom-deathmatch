import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  MBNWPhase, MBNWWinType, MBNWTile, MBNWTileColor,
} from '@shared/types/multiple-bnw.js';
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

export interface MBNWPlayerInternal {
  id: string;
  nickname: string;
  score: number;
  remainingTiles: MBNWTile[];
  submitted: boolean;
  isFirst: boolean;
  /** 이번 라운드에 제출한 타일 (reveal 전까지 비공개) */
  currentTile: MBNWTile | null;
}

export interface MBNWRoundActionLog {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    nickname: string;
    tile: number;
    tileColor: MBNWTileColor;
    suspected: boolean;
    suspectSuccess: boolean | null;
    suspectDetail: string | null;
    bonusPoint: number;
    normalPoint: number;
    totalScoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
  }>;
}

export interface MBNWPlayerSnapshot {
  score: number;
  remainingTiles: MBNWTile[];
  submitted: boolean;
  isFirst: boolean;
  currentTile: MBNWTile | null;
}

export interface MBNWUndoSnapshot {
  round: number;
  phase: MBNWPhase;
  firstPlayerId: string;
  secondPlayerId: string;
  player1: MBNWPlayerSnapshot;
  player2: MBNWPlayerSnapshot;
  colorReveal: InternalState['colorReveal'];
  suspectResult: InternalState['suspectResult'];
  roundHistory: MBNWRoundActionLog[];
  actionLog: MBNWRoundActionLog[];
  suspectSuccessCount: Record<string, number>;
  firstPlayerRounds: Record<string, number>;
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  round: number;
  phase: MBNWPhase;
  firstPlayerId: string;
  secondPlayerId: string;
  initialFirstPlayerId: string;
  player1: MBNWPlayerInternal;
  player2: MBNWPlayerInternal;
  colorReveal: {
    firstPlayerColor: MBNWTileColor | null;
    secondPlayerColor: MBNWTileColor | null;
  } | null;
  suspectResult: {
    firstSuspected: boolean | null;
    firstSuccess: boolean | null;
    secondSkipped: boolean;
    secondSuspected: boolean | null;
    secondSuccess: boolean | null;
  } | null;
  roundHistory: MBNWRoundActionLog[];
  actionLog: MBNWRoundActionLog[];
  suspectSuccessCount: Record<string, number>;
  firstPlayerRounds: Record<string, number>;
  winner: string | null;
  winType: MBNWWinType;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  aiGeneration: number;
  undoSnapshots: MBNWUndoSnapshot[];
  consecutiveTimeouts: Record<string, number>;
  onAITurn?: (io: IO, s: InternalState) => void;
}
