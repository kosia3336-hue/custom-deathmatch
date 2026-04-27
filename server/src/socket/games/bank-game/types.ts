import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  BankBet,
  BankPhase,
  BankResolveStep,
  BankRoundResult,
  BankSide,
  BankWinType,
} from '@shared/types/bank-game.js';
import type { BankRoundArchiveRecord } from '@shared/types/archive.js';
import type { BankAiDifficulty, IO } from './constants.js';

export type EndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings: GameResult['rankings'];
    totalTurns: number;
    gameResultData?: unknown;
  },
) => void;

export interface BankPlayerInternal {
  id: string;
  nickname: string;
  side: BankSide;
  score: number;
  /** 액면별 보유 잔량 (서버 권위) */
  inventory: BankBet;
  /** 이번 라운드 pending 베팅 (확정 시 채워짐, 취소 시 null) */
  pendingBet: BankBet | null;
  betConfirmedAt: number | null;
  /** 이번 라운드에서 자동 제출(타임아웃)이 발생했는가 */
  autoThisRound: boolean;
  /** 이번 라운드에서 자동 0장 제출이 inventory가 0이라 강제 발생했는가 (타임아웃은 아님) */
  autoZeroForcedThisRound: boolean;
  isAi: boolean;
}

/** 서버 내부에서 보관하는 정밀 라운드 정보 (사후 아카이브용) */
export interface BankRoundFullRecord {
  round: number;
  firstSide: BankSide;
  outcome: 'first_win' | 'second_win' | 'draw';
  bets: { p1: BankBet; p2: BankBet };
  amounts: { p1: number; p2: number };
  counts: { p1: number; p2: number };
  scoreDelta: { p1: number; p2: number };
  scoreAfter: { p1: number; p2: number };
  inventoryBefore: { p1: BankBet; p2: BankBet };
  inventoryAfter: { p1: BankBet; p2: BankBet };
  auto: { p1: boolean; p2: boolean };
}

export interface BankPlayerSnapshot {
  score: number;
  inventory: BankBet;
  pendingBet: BankBet | null;
  betConfirmedAt: number | null;
  autoThisRound: boolean;
  autoZeroForcedThisRound: boolean;
}

export interface BankUndoSnapshot {
  round: number;
  phase: BankPhase;
  firstSide: BankSide;
  player1: BankPlayerSnapshot;
  player2: BankPlayerSnapshot;
  history: BankRoundFullRecord[];
  loserAmountTotal: number;
  consecutiveTimeouts: Record<string, number>;
}

export interface BankInternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  phase: BankPhase;
  round: number;
  maxRound: number;
  firstSide: BankSide;
  player1: BankPlayerInternal;
  player2: BankPlayerInternal;
  /** 서버 권위 — 라운드 풀 기록 */
  history: BankRoundFullRecord[];
  /** 누적 패자 금액 (양측 공개) */
  loserAmountTotal: number;
  /** 정산 애니메이션 스텝 */
  resolveSteps: BankResolveStep[];
  /** 클라이언트로 전송할 마지막 라운드 결과 (마스킹은 view 단계에서) */
  lastRoundResult: BankRoundResult | null;
  /** 마지막 라운드의 풀 기록 (본인 시점 마스킹 해제용 참조) */
  lastRoundFull: BankRoundFullRecord | null;
  resolveTimer: ReturnType<typeof setTimeout> | null;
  firstRevealTimer: ReturnType<typeof setTimeout> | null;
  nextRoundTimer: ReturnType<typeof setTimeout> | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  roundDeadline: number | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  finalWinner: BankSide | 'draw' | null;
  winType: BankWinType;
  finishReason: string | null;
  playMode: PlayMode;
  gameOver: boolean;
  options: {
    enableUndo: boolean;
    aiDifficulty: BankAiDifficulty;
  };
  aiGeneration: number;
  undoSnapshots: BankUndoSnapshot[];
  consecutiveTimeouts: Record<string, number>;
  onAITurn?: (io: IO, s: BankInternalState) => void;
}

export type BankRoundArchive = BankRoundArchiveRecord;
