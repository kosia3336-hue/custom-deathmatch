import type { Game } from './game';

export type { Game };

export interface GameWinRate {
  gameId: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

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
  opponentGameStats?: GameWinRate[];
}

export interface BanPickUpdatePayload {
  bannedGames: BannedGame[];
  currentSequenceIdx: number;
  bansRemainingInTurn: number;
  currentPlayer: 'first' | 'second' | 'com';
  banCounts: [number, number];
  turnDeadline: number | null;
  phase: 'banning' | 'lottery';
  lastNobanBy?: 'first' | 'second';
}

export interface BanPickLotteryPayload {
  remainingGameIds: string[];
  pickedGameId: string;
}

export interface BanPickUnbanTurnPayload {
  queue: Array<'first' | 'second'>;
  currentTurn: 'first' | 'second';
  erasableGames: Array<{ gameId: string; bannedBy: 'first' | 'second' }>;
  turnDeadline: number;
}

export interface BanPickUnbanUpdatePayload {
  currentTurn: 'first' | 'second' | null;
  erasedGameId: string | null;
  erasedBy: 'first' | 'second' | null;
  turnDeadline: number | null;
}
