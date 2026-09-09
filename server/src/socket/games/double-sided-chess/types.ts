import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  Cell,
  PieceType,
  Owner,
  Position,
  DSCWinType,
  DSCPlayerInfo,
  DoubleSidedChessAction,
} from '@shared/types/double-sided-chess.js';
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

export type { Cell, PieceType, Owner, Position, DSCWinType, DSCPlayerInfo };

export type AIMove =
  | { type: 'move'; from: Position; to: Position }
  | { type: 'place-prisoner'; pieceType: PieceType; position: Position };

export interface TurnActionLog {
  turnNumber: number;
  player: Owner;
  nickname: string;
  action: DoubleSidedChessAction;
}

export interface DSCUndoSnapshot {
  board: Cell[][];
  currentPlayer: string;
  currentOwner: Owner;
  turnNumber: number;
  firstPlayer: DSCPlayerInfo;
  secondPlayer: DSCPlayerInfo;
  prisoners: { first: PieceType[]; second: PieceType[] };
  lastMove: {
    type: 'move' | 'place-prisoner';
    from: Position | null;
    to: Position;
    captured: PieceType | null;
  } | null;
  actionLog: TurnActionLog[];
  winner: string | null;
  winType: DSCWinType | null;
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  board: Cell[][];
  currentPlayer: string;
  currentOwner: Owner;
  turnNumber: number;
  firstPlayer: DSCPlayerInfo;
  secondPlayer: DSCPlayerInfo;
  prisoners: {
    first: PieceType[];
    second: PieceType[];
  };
  lastMove: {
    type: 'move' | 'place-prisoner';
    from: Position | null;
    to: Position;
    captured: PieceType | null;
  } | null;
  winner: string | null;
  winType: DSCWinType | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  aiThinkSeconds: number;
  gameOver: boolean;
  actionLog: TurnActionLog[];
  undoSnapshots: DSCUndoSnapshot[];
  ownerToken: string | null;
}
