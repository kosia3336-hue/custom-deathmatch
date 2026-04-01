export const DSC_BOARD_SIZE = 5;

export type PieceType = 'infantry' | 'gold' | 'king' | 'silver' | 'copper';
export type Owner = 'first' | 'second';

export const INITIAL_SECOND_ROW: PieceType[] = ['infantry', 'gold', 'king', 'silver', 'copper'];
export const INITIAL_FIRST_ROW: PieceType[] = ['copper', 'silver', 'king', 'gold', 'infantry'];

export interface CellData {
  piece: PieceType;
  owner: Owner;
  isPromoted: boolean;
}

export type Cell = CellData | null;

export interface Position {
  row: number;
  col: number;
}

export type DSCWinType = 'king-captured' | 'king-entered' | 'all-captured' | 'no-moves' | 'timeout';

export interface DSCPlayerInfo {
  id: string;
  nickname: string;
}

export interface DoubleSidedChessGameData {
  board: Cell[][];
  currentPlayer: string;
  currentOwner: Owner;
  turnNumber: number;
  players: {
    first: DSCPlayerInfo;
    second: DSCPlayerInfo;
  };
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
}

export type DoubleSidedChessAction =
  | { type: 'move'; from: Position; to: Position }
  | { type: 'place-prisoner'; pieceType: PieceType; position: Position };
