import type { Game } from './game';

export type { Game };

export interface BanTurn {
  playerIdx: number;
  count: number;
}

export interface BannedGame {
  gameId: string;
  bannedBy: 'first' | 'second' | 'com';
  bannedAt: number;
  isTimeout?: boolean;
}

export interface BanPickStartPayload {
  games: Game[];
  sequence: BanTurn[];
  currentSequenceIdx: number;
  bansRemainingInTurn: number;
  currentPlayer: 'first' | 'second' | 'com';
  banCount: number;
  timeLimit: number;
  turnDeadline: number | null;
  bannedGames: BannedGame[];
  banCounts: [number, number];
  players: [{ id: string; nickname: string }, { id: string; nickname: string }];
}

export interface BanPickUpdatePayload {
  bannedGames: BannedGame[];
  currentSequenceIdx: number;
  bansRemainingInTurn: number;
  currentPlayer: 'first' | 'second' | 'com';
  banCounts: [number, number];
  turnDeadline: number | null;
  phase: 'banning' | 'lottery';
}

export interface BanPickLotteryPayload {
  remainingGameIds: string[];
  pickedGameId: string;
}
