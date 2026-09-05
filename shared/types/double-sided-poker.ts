import type { PlayMode } from './room';

export const DOUBLE_SIDED_POKER_INITIAL_CHIPS = 25;
export const DOUBLE_SIDED_POKER_ANTE = 1;
export const DOUBLE_SIDED_POKER_DOUBLE_BONUS = 10;

export type DoubleSidedPokerSide = 'front' | 'back';
export type DoubleSidedPokerSelection = DoubleSidedPokerSide | 'both' | null;
export type DoubleSidedPokerPhase = 'betting' | 'round-result' | 'finished';

export interface DoubleSidedPokerCard {
  id: string;
  set: number;
  front: number;
  back: number;
}

export type DoubleSidedPokerAction =
  | { type: 'bet'; side: DoubleSidedPokerSide; amount: number }
  | { type: 'call'; side?: DoubleSidedPokerSide }
  | { type: 'raise'; side?: DoubleSidedPokerSide; amount: number }
  /** amount 는 여는 수로 선언할 때만 쓴다. 한 면에 걸 칩이며 실제로는 두 배가 나간다. */
  | { type: 'double'; amount?: number }
  /** 걸 칩이 없는 이월 라운드에서 겨룰 면만 고른다. */
  | { type: 'select'; side: DoubleSidedPokerSide }
  | { type: 'fold' };

export interface DoubleSidedPokerBettingAction {
  round: number;
  playerId: string;
  action: 'bet' | 'call' | 'raise' | 'double' | 'select' | 'fold';
  selection: DoubleSidedPokerSelection;
  payment: number;
  stake: number;
}

export interface DoubleSidedPokerPlayerView {
  id: string;
  nickname: string;
  chips: number;
  card: { front: number; back: number | null } | null;
  selection: DoubleSidedPokerSelection;
  stake: number;
  frontBet: number;
  backBet: number;
}

export type DoubleSidedPokerRoundReason = 'showdown' | 'fold' | 'tie';

export interface DoubleSidedPokerRoundResult {
  round: number;
  winnerId: string | null;
  reason: DoubleSidedPokerRoundReason;
  foldedPlayerId: string | null;
  potAmount: number;
  carriedPotAtStart: boolean;
  doubleBettorId: string | null;
  doubleBonus: number;
  cards: Record<string, { front: number; back: number | null }>;
  selections: Record<string, DoubleSidedPokerSelection>;
  bets: Record<string, { front: number; back: number }>;
  chipCountsAfter: Record<string, number>;
  actions: DoubleSidedPokerBettingAction[];
  deckRemainingAfter: number;
}

export interface DoubleSidedPokerGameData {
  phase: DoubleSidedPokerPhase;
  playMode: PlayMode;
  round: number;
  ante: number;
  carryRound: boolean;
  pot: number;
  deckRemaining: number;
  deckCycles: number;
  players: Record<string, DoubleSidedPokerPlayerView>;
  firstPlayerId: string;
  currentTurnId: string | null;
  bettingOpened: boolean;
  /**
   * 양쪽 다 걸 칩이 없는 이월 라운드. 베팅 없이 겨룰 면만 고르고 바로 승부한다.
   * 예전에는 서버가 앞면끼리 자동 비교했지만, 뒷면으로 겨룰 선택지를 뺏는 것이었다.
   */
  selectOnly: boolean;
  doubleBettorId: string | null;
  currentStake: number;
  toCall: number;
  minBet: number | null;
  maxBet: number | null;
  minRaise: number | null;
  maxRaise: number | null;
  canDouble: boolean;
  /** 응답으로 양면베팅할 때 드는 칩. 여는 수라면 null. */
  doubleCost: number | null;
  /** 여는 수로 양면베팅할 때 한 면에 걸 수 있는 최대 칩. 응답이라면 null. */
  maxDouble: number | null;
  lastRoundResult: DoubleSidedPokerRoundResult | null;
  roundStartedAt: number;
  turnStartedAt: number | null;
  turnSeconds: number | null;
  winnerId: string | null;
  finishReason: string | null;
}

export interface DoubleSidedPokerArchiveRecord {
  rounds: DoubleSidedPokerRoundResult[];
  finalChips: Record<string, number>;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
  totalRounds: number;
  deckCycles: number;
}
