import type { Player, PlayMode } from '@shared/types/room.js';
import type {
  EskimoBoard,
  EskimoCell,
  EskimoLastAction,
  EskimoPhase,
  EskimoWinType,
} from '@shared/types/eskimo.js';
import type { IO } from '../../types.js';

export type EskimoEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

/** 무르기용 — 한 수를 두기 직전 모습. */
export interface EskimoUndoSnapshot {
  board: EskimoBoard;
  currentPlayerId: string;
  turnNumber: number;
  bearLockTurns: number;
  lastAction: EskimoLastAction | null;
  actionLogLength: number;
  positionCount: number;
}

export interface EskimoState {
  roomId: string;
  /** [선, 후] */
  players: [Player, Player];
  playMode: PlayMode;
  board: EskimoBoard;
  currentPlayerId: string;
  firstPlayerId: string;
  phase: EskimoPhase;
  turnNumber: number;
  /** 이번 턴을 포함해 북극곰을 옮길 수 없는 남은 턴 수. */
  bearLockTurns: number;
  /** 지금까지 나온 판 모양(시작 판 포함, 둔 순서대로). 반복수 판정용. */
  positions: string[];
  actionLog: EskimoLastAction[];
  undoStack: EskimoUndoSnapshot[];
  lastAction: EskimoLastAction | null;
  winnerId: string | null;
  winType: EskimoWinType | null;
  winCells: EskimoCell[];
  finishReason: string | null;
  gameOver: boolean;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: EskimoEndGameFn;
}
