import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type { IPPhase, IPWinType, IPHand, IPBettingAction } from '@shared/types/indian-poker.js';

export type EndGameFn = (
  io: import('./constants.js').IO,
  roomId: string,
  data: {
    rankings: GameResult['rankings'];
    totalTurns: number;
    gameResultData?: unknown;
  },
) => void;

export interface IPPlayerInternal {
  id: string;
  nickname: string;
  chips: number;
  roundBet: number;
  card: number | null;
}

export interface InternalRoundRecord {
  round: number;
  communityCards: [number, number];
  playerCards: Record<string, number>;
  winnerId: string | null;
  isDraw: boolean;
  isDie: boolean;
  chipChanges: Record<string, number>;
  bettingActions: IPBettingAction[];
  hands: Record<string, IPHand>;
}

export interface IPUndoSnapshot {
  round: number;
  phase: IPPhase;
  deck: number[];
  communityCards: [number, number] | null;
  player1: IPPlayerSnapshot;
  player2: IPPlayerSnapshot;
  pot: number;
  currentTurnId: string | null;
  currentBet: number;
  ante: number;
  roundAnte: number;
  deckCycle: number;
  firstBettorId: string;
  bettingStarted: boolean;
  currentRoundActions: IPBettingAction[];
  roundHistory: InternalRoundRecord[];
  usedCards: number[];
  totalBettingActions: number;
}

export interface IPPlayerSnapshot {
  chips: number;
  roundBet: number;
  card: number | null;
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  round: number;
  phase: IPPhase;
  deck: number[];
  communityCards: [number, number] | null;
  player1Id: string;
  player2Id: string;
  players: Record<string, IPPlayerInternal>;
  pot: number;
  currentTurnId: string | null;
  currentBet: number;
  ante: number;
  deckCycle: number;
  firstBettorId: string;
  bettingStarted: boolean;
  showdownData: import('@shared/types/indian-poker.js').IPShowdownData | null;
  dieData: import('@shared/types/indian-poker.js').IPDieData | null;
  winner: string | null;
  winType: IPWinType | null;
  currentRoundActions: IPBettingAction[];
  deckResetOccurred: boolean;
  roundHistory: InternalRoundRecord[];
  usedCards: number[];
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  nextRoundTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  totalBettingActions: number;
  undoSnapshots: IPUndoSnapshot[];
  aiGeneration: number;
  initialChips: number;
  /** 이번 라운드에 실제로 차감된 앤티 (숏스택 시 표준 앤티보다 작을 수 있음) */
  roundAnte: number;
}
