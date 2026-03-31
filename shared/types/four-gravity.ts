export const BOARD_SIZE = 9;

export type CellType = 'empty' | 'black' | 'white' | 'neutral';
export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';
export type Phase = 'place' | 'gravity' | 'neutral' | 'waiting';

export interface Position {
  row: number;
  col: number;
}

export interface FourGravityPlayerInfo {
  id: string;
  nickname: string;
  stoneCount: number;
}

export interface FourGravityGameData {
  board: CellType[][];
  currentPlayer: string;
  currentColor: 'black' | 'white';
  phase: Phase;
  lastGravity: Direction | null;
  placedPosition: Position | null;
  movedPosition: Position | null;
  neutralCandidates: Position[];
  players: {
    black: FourGravityPlayerInfo;
    white: FourGravityPlayerInfo;
  };
  neutralCount: number;
  winner: string | null;
  winLine: Position[] | null;
  winType: 'black' | 'white' | 'neutral' | 'no-space' | 'no-neutral' | 'timeout' | null;
}

export type FourGravityAction =
  | { type: 'place'; row: number; col: number }
  | { type: 'gravity'; direction: Direction }
  | { type: 'neutral'; row: number; col: number };
