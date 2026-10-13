import type { PlayMode } from './room';
import type { Position, FourGravityAction } from './four-gravity';

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
