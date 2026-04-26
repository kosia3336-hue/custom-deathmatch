import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  SMS2ChipBet,
  SMS2MarkId,
  SMS2Phase,
  SMS2PowderSubmission,
  SMS2ResolveStep,
  SMS2RoundRecord,
  SMS2Side,
  SMS2WinType,
} from '@shared/types/sun-moon-star-2.js';
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

export interface SMS2PlayerInternal {
  id: string;
  nickname: string;
  side: SMS2Side;
  chips: number;
  powderRemain: number;
  /** 표식별 본인 누적 기여 (라운드 간 이월) */
  markContribution: { sun: number; moon: number; star: number };
  /** 이번 라운드 pending 빛가루 분배 */
  pendingPowder: SMS2PowderSubmission | null;
  powderSubmittedAt: number | null;
  /** 이번 라운드 pending 칩 베팅 */
  pendingBet: SMS2ChipBet | null;
  betConfirmedAt: number | null;
  /** 이번 라운드 자동 제출/베팅 발생 여부 */
  autoThisRound: boolean;
  isAi: boolean;
}

export interface SMS2MarkPool {
  /** p1/p2 기여 누적 + 합산 총합 (total = p1 + p2) */
  p1: number;
  p2: number;
  total: number;
}

export interface SMS2InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  phase: SMS2Phase;
  round: number;
  maxRound: number;
  suddenDeath: boolean;
  suddenDeathConsumed: boolean;
  firstPlayerSide: SMS2Side;
  player1: SMS2PlayerInternal;
  player2: SMS2PlayerInternal;
  /** 표식별 양측 실제 누적 (서버만 보유) */
  markPool: Record<SMS2MarkId, SMS2MarkPool>;
  history: SMS2RoundRecord[];
  resolveSteps: SMS2ResolveStep[];
  resolveTimer: ReturnType<typeof setTimeout> | null;
  nextRoundTimer: ReturnType<typeof setTimeout> | null;
  lastRoundRecord: SMS2RoundRecord | null;
  /** 라운드 입력 마감 타이머 */
  roundTimer: ReturnType<typeof setTimeout> | null;
  roundDeadline: number | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  finalWinner: SMS2Side | 'draw' | null;
  winType: SMS2WinType;
  finishReason: string | null;
  playMode: PlayMode;
  gameOver: boolean;
  /** 옵션 */
  options: {
    enableSuddenDeath: boolean;
    enableUndo: boolean;
  };
  /** AI 비동기 캔슬용 generation */
  aiGeneration: number;
  undoSnapshots: SMS2UndoSnapshot[];
  consecutiveTimeouts: Record<string, number>;
  onAITurn?: (io: IO, s: SMS2InternalState) => void;
}

export interface SMS2PlayerSnapshot {
  chips: number;
  powderRemain: number;
  markContribution: { sun: number; moon: number; star: number };
  pendingPowder: SMS2PowderSubmission | null;
  pendingBet: SMS2ChipBet | null;
  powderSubmittedAt: number | null;
  betConfirmedAt: number | null;
  autoThisRound: boolean;
}

export interface SMS2UndoSnapshot {
  round: number;
  phase: SMS2Phase;
  firstPlayerSide: SMS2Side;
  suddenDeath: boolean;
  suddenDeathConsumed: boolean;
  markPool: Record<SMS2MarkId, SMS2MarkPool>;
  player1: SMS2PlayerSnapshot;
  player2: SMS2PlayerSnapshot;
  history: SMS2RoundRecord[];
  consecutiveTimeouts: Record<string, number>;
}
