import type { GameResult } from '@shared/types/events.js';
import type { AbstractAiDifficulty } from '@shared/types/game.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  CellType,
  Direction,
  Phase,
  Position,
  FourGravityPlayerInfo,
  FourGravityAction,
  FgTutorialStepId,
} from '@shared/types/four-gravity.js';
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

export type { CellType, Direction, Phase, Position, FourGravityPlayerInfo };

export interface TurnActionLog {
  turnNumber: number;
  color: 'black' | 'white';
  nickname: string;
  steps: FourGravityAction[];
}

/** 무르기용 스냅샷(undoSnapshots 스택에만 쌓임) */
export interface FourGravityUndoSnapshot {
  board: CellType[][];
  currentPlayer: string;
  currentColor: 'black' | 'white';
  phase: Phase;
  turnNumber: number;
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
  placedPosition: Position | null;
  movedPosition: Position | null;
  neutralCandidates: Position[];
  blackPlayer: FourGravityPlayerInfo;
  whitePlayer: FourGravityPlayerInfo;
  neutralCount: number;
  winner: string | null;
  winLine: Position[] | null;
  winType: 'black' | 'white' | 'neutral' | 'no-space' | 'no-neutral' | 'timeout' | null;
  actionLog: TurnActionLog[];
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  board: CellType[][];
  currentPlayer: string;
  currentColor: 'black' | 'white';
  phase: Phase;
  turnNumber: number;
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
  placedPosition: Position | null;
  movedPosition: Position | null;
  neutralCandidates: Position[];
  blackPlayer: FourGravityPlayerInfo;
  whitePlayer: FourGravityPlayerInfo;
  neutralCount: number;
  winner: string | null;
  winLine: Position[] | null;
  winType: 'black' | 'white' | 'neutral' | 'no-space' | 'no-neutral' | 'timeout' | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  aiDifficulty: AbstractAiDifficulty;
  gameOver: boolean;
  actionLog: TurnActionLog[];
  undoSnapshots: FourGravityUndoSnapshot[];
  ownerToken: string | null;
  tutorialStep: FgTutorialStepId | null;
  tutorialCom: TutorialComPlayback | null;
  tutorialComTimer: ReturnType<typeof setTimeout> | null;
}

export type TutorialComScript = 'first' | 'down' | 'down-neutral';
export type TutorialComBeat = 'place' | 'gravity' | 'neutral';

export interface TutorialComPlayback {
  script: TutorialComScript;
  beat: TutorialComBeat;
  left: number;
}

export interface WinResult {
  winner: 'current' | 'opponent';
  type: 'black' | 'white' | 'neutral';
  line: Position[];
}

export interface AIMove {
  place: Position;
  gravity: Direction;
  neutral: Position | null;
}
