import type { PlayMode } from './room';
import type { Position, FourGravityAction } from './four-gravity';
import type { DSCWinType } from './double-sided-chess';
import type { NF4Number, NF4WinType } from './number4';

export interface GameRecordFile {
  version: string;
  gameId: string;
  gameName: string;
  playedAt: string;
  playMode: PlayMode;
  players: Record<string, { nickname: string }>;
  result: {
    rankings: Array<{ nickname: string; rank: number; score: number }>;
    playTime: number;
    totalTurns: number;
  };
  gameRecord: unknown;
}

export interface FourGravityTurnAction {
  turnNumber: number;
  color: 'black' | 'white';
  nickname: string;
  steps: FourGravityAction[];
}

export interface FourGravityRecord {
  winType: string | null;
  winLine: Position[] | null;
  actions: FourGravityTurnAction[];
}

export interface DSCTurnActionLog {
  turnNumber: number;
  player: 'first' | 'second';
  nickname: string;
  action:
    | { type: 'move'; from: Position; to: Position }
    | { type: 'place-prisoner'; pieceType: string; position: Position };
}

export interface DSCRecord {
  winType: DSCWinType | null;
  finalBoard: unknown;
  prisoners: { first: string[]; second: string[] };
  actions: DSCTurnActionLog[];
  players: {
    first: { nickname: string };
    second: { nickname: string };
  };
}

export interface NumberFourRoundAction {
  round: number;
  players: Record<string, {
    nickname: string;
    white: number;
    black: number;
    number: NF4Number;
    success: boolean;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
  }>;
}

export interface NumberFourRecord {
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
  finalScores: Record<string, number>;
  roundHistory: unknown[];
  actions: NumberFourRoundAction[];
  players: Record<string, { nickname: string }>;
}
