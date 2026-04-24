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
import type { FTTower, FTItem, FTWinType } from './five-towers';
import type {
  GS2CardId,
  GS2RoundRecord,
  GS2Side,
  GS2WinType,
} from './grape-sugar-2';

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

/* ════════ 5개의 탑 (Five Towers) ════════ */

export type FiveTowersActionKind = 'stack' | 'item-info' | 'item-zero' | 'item-secret';

export interface FiveTowersActionRecord {
  turn: number;
  actorId: string;
  actorNickname: string;
  kind: FiveTowersActionKind;
  /** stack/zero/secret 대상 탑 */
  tower?: FTTower;
  /** info 아이템 대상 탑 */
  targets?: [FTTower, FTTower];
  /** 실제 쌓은 칸 수 (stack/zero/secret) */
  count?: 0 | 1 | 2 | 3;
  /** info 아이템 결과 합계 */
  sum?: number;
  /** 마일스톤 동시 발생 시 */
  milestone?: 'half' | 'complete';
  /** 점수 변동 (탑 완성 시) */
  scoreChange?: number;
}

export interface FiveTowersMilestoneRecord {
  turn: number;
  tower: FTTower;
  kind: 'half' | 'complete';
  actorId: string;
  actorNickname: string;
}

export interface FiveTowersTowerRecord {
  finalHeight: number;
  completedBy: string | null;
  /** 각 플레이어가 누적한 칸 수 */
  contributions: Record<string, number>;
}

export interface FiveTowersItemUsage {
  item: FTItem;
  turn: number;
  /** info: targets, sum / zero: tower / secret: tower, count */
  detail: {
    tower?: FTTower;
    targets?: [FTTower, FTTower];
    count?: 0 | 1 | 2 | 3;
    sum?: number;
  };
}

export interface FiveTowersArchiveRecord {
  winType: FTWinType | null;
  winnerId: string | null;
  finalScores: Record<string, number>;
  totalTurns: number;
  finishReason: string | null;
  finalTowers: Record<FTTower, FiveTowersTowerRecord>;
  itemsUsed: Record<string, FiveTowersItemUsage>;
  actions: FiveTowersActionRecord[];
  milestones: FiveTowersMilestoneRecord[];
  players: Record<string, { nickname: string }>;
}

/* ════════ 포도설탕2 (Grape Sugar 2) ════════ */

/** 본 게임 + N차 연장전 단계 단위 */
export interface GrapeSugar2Stage {
  /** 0 = 본 게임, 1+ = N차 연장전 */
  extension: number;
  maxRound: 8 | 9;
  rounds: GS2RoundRecord[];
  /** 단계 종료 시 사이드별 점수 */
  scoreAfter: { p1: number; p2: number };
  /** 단계 결과: 승자 사이드 또는 'tie' (연장전 진입) */
  result: GS2Side | 'tie';
}

export interface GrapeSugar2CardUsage {
  card: GS2CardId;
  count: number;
}

export interface GrapeSugar2ArchiveRecord {
  winType: GS2WinType;
  winnerId: string | null;
  finalScores: Record<string, number>;
  /** 본 게임 + 연장전 모두 합한 라운드 수 */
  totalRounds: number;
  extensions: number;
  stages: GrapeSugar2Stage[];
  /** 사이드별 ↔ playerId 매핑 */
  sides: { p1: string; p2: string };
  /** 사이드별 카드 사용 통계 */
  cardUsage: { p1: GrapeSugar2CardUsage[]; p2: GrapeSugar2CardUsage[] };
  players: Record<string, { nickname: string }>;
  finishReason: string | null;
}
