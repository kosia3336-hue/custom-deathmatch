import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type { IDPhase, IDWinType, IDBadge, IDCoinAllocation, IDCoinStock } from '@shared/types/invest-donate.js';
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

export interface IDPlayerInternal {
  id: string;
  nickname: string;
  score: number;
  coinStock: IDCoinStock;
  submitted: boolean;
  investCoins: IDCoinAllocation | null;
  donateCoins: IDCoinAllocation | null;
  investBadge: IDBadge;
  donateBadge: IDBadge;
}

export interface InternalRoundRecord {
  round: number;
  players: Record<string, {
    investCoins: IDCoinAllocation;
    donateCoins: IDCoinAllocation;
    investTotal: number;
    donateTotal: number;
    investBadge: IDBadge;
    donateBadge: IDBadge;
    scoreChange: number;
    scoreAfter: number;
    coinStockAfter: IDCoinStock;
  }>;
}

export interface RoundActionLog {
  round: number;
  players: Record<string, {
    nickname: string;
    investCoins: IDCoinAllocation;
    donateCoins: IDCoinAllocation;
    investTotal: number;
    donateTotal: number;
    investBadge: IDBadge;
    donateBadge: IDBadge;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    coinStockAfter: IDCoinStock;
  }>;
}

export interface IDPlayerSnapshot {
  score: number;
  coinStock: IDCoinStock;
  submitted: boolean;
  investCoins: IDCoinAllocation | null;
  donateCoins: IDCoinAllocation | null;
  investBadge: IDBadge;
  donateBadge: IDBadge;
}

export interface IDUndoSnapshot {
  round: number;
  phase: IDPhase;
  player1: IDPlayerSnapshot;
  player2: IDPlayerSnapshot;
  roundHistory: InternalRoundRecord[];
  actionLog: RoundActionLog[];
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  round: number;
  totalRounds: number;
  phase: IDPhase;
  player1: IDPlayerInternal;
  player2: IDPlayerInternal;
  roundHistory: InternalRoundRecord[];
  winner: string | null;
  winType: IDWinType | null;
  rematchReason: string | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  actionLog: RoundActionLog[];
  undoSnapshots: IDUndoSnapshot[];
  aiGeneration: number;
}
