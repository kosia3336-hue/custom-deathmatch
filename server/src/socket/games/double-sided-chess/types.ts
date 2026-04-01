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

export interface TurnActionLog {
  turnNumber: number;
  player: Owner;
  nickname: string;
  action: DoubleSidedChessAction;
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
  gameOver: boolean;
  actionLog: TurnActionLog[];
}
