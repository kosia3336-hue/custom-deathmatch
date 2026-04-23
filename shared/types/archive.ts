import type { PlayMode } from './room';
import type { Position, FourGravityAction } from './four-gravity';
import type { DSCWinType } from './double-sided-chess';
import type { NF4Number, NF4WinType } from './number4';
import type { IPHand, IPWinType, IPActionType } from './indian-poker';
import type { IDCoinAllocation, IDCoinStock, IDBadge, IDWinType } from './invest-donate';
import type { BRPSResult, BRPSRole, BRPSBetOutcome, BRPSWinType } from './betting-rps';
import type { MBNWTileColor, MBNWWinType } from './multiple-bnw';
import type { WSCardType, WSMatchResult, WSWinType } from './winning-streak';
import type { BNW2Color, BNW2WinType } from './bnw2';
import type {
  SBNWTile,
  SBNWWinType,
  SBNWSegmentSummary,
  SBNWRoundRecord,
} from './silper-bnw';

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

export interface IndianPokerBettingAction {
  playerId: string;
  action: IPActionType;
  amount?: number;
}

export interface IndianPokerRoundRecord {
  round: number;
  communityCards: [number, number];
  /** 플레이어별 카드 숫자 (서버 내부 포맷에서 저장) */
  playerCards?: Record<string, number>;
  winnerId: string | null;
  isDraw: boolean;
  isDie: boolean;
  chipChanges: Record<string, number>;
  bettingActions: IndianPokerBettingAction[];
  /** 서버 내부 포맷: Record<string, IPHand> (족보 문자열) */
  hands?: Record<string, IPHand | { card: number; hand: IPHand }>;
}

export interface IndianPokerRecord {
  winType: IPWinType | null;
  finalChips: Record<string, number>;
  totalRounds: number;
  deckCycles: number;
  finalAnte: number;
  initialChips: number;
  roundHistory: IndianPokerRoundRecord[];
  players: Record<string, { nickname: string }>;
}

export interface InvestDonateRoundAction {
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

export interface InvestDonateRecord {
  winType: IDWinType | null;
  finalScores: Record<string, number>;
  finalCoinStocks: Record<string, IDCoinStock>;
  totalRounds: number;
  actions: InvestDonateRoundAction[];
  players: Record<string, { nickname: string }>;
}

export interface BettingRpsRoundAction {
  round: number;
  choiceRightPlayerId: string;
  players: Record<string, {
    nickname: string;
    role: BRPSRole;
    matchResult: BRPSResult | null;
    prediction: BRPSResult | null;
    betChips: number | null;
    betOutcome: BRPSBetOutcome | null;
    chipsBefore: number;
    chipsAfter: number;
    chipChange: number;
  }>;
}

export interface BettingRpsRecord {
  winType: BRPSWinType | null;
  finalChips: Record<string, number>;
  totalRounds: number;
  actions: BettingRpsRoundAction[];
  players: Record<string, { nickname: string }>;
}

export interface MultipleBnwRoundAction {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    nickname: string;
    tile: number;
    tileColor: MBNWTileColor;
    suspected: boolean;
    suspectSuccess: boolean | null;
    suspectDetail: string | null;
    bonusPoint: number;
    normalPoint: number;
    totalScoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
  }>;
}

export interface MultipleBnwArchiveRecord {
  winType: MBNWWinType;
  finalScores: Record<string, number>;
  actions: MultipleBnwRoundAction[];
  players: Record<string, { nickname: string }>;
}

export interface WinningStreakRoundAction {
  round: number;
  matchDescription: string;
  players: Record<string, {
    card: WSCardType;
    result: WSMatchResult;
    /** 없으면 이전 라운드의 streakAfter로 복원 */
    streakBefore?: number;
    streakAfter: number;
    maxStreakAfter: number;
    totalWinsAfter: number;
  }>;
}

export interface WinningStreakArchiveRecord {
  winType: WSWinType | null;
  finalStats: Record<string, { maxStreak: number; totalWins: number }>;
  actions: WinningStreakRoundAction[];
  players: Record<string, { nickname: string }>;
}

export interface BNW2RoundAction {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    nickname: string;
    color: BNW2Color;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    stageBefore: number;
    stageAfter: number;
  }>;
  winnerId: string | null;
}

export interface BNW2ArchiveRecord {
  winType: BNW2WinType | null;
  finalScores: Record<string, number>;
  finalPoints: Record<string, number>;
  actions: BNW2RoundAction[];
  players: Record<string, { nickname: string }>;
}

export type SilperBnwRoundAction = SBNWRoundRecord;

export interface SilperBnwArchiveRecord {
  winType: SBNWWinType | null;
  winnerId: string | null;
  finalScores: Record<string, number>;
  finalTiles: Record<string, Record<SBNWTile, number>>;
  totalRounds: number;
  rematchCount: number;
  segmentsHistory: SBNWSegmentSummary[];
  actions: SilperBnwRoundAction[];
  players: Record<string, { nickname: string }>;
  finishReason: string | null;
}
