import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type { NF4Phase, NF4WinType, NF4Number } from '@shared/types/number4.js';
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

export interface NF4PlayerInternal {
  id: string;
  nickname: string;
  score: number;
  remainingWhite: number;
  remainingBlack: number;
  submitted: boolean;
  /** 현재 라운드에서 제출한 타일 (공개 전까지 비공개) */
  submittedWhite: number | null;
  submittedBlack: number | null;
  /** 현재 라운드에서 제출한 넘버 (공개 전까지 비공개) */
  submittedNumber: NF4Number | null;
}

/** 서버 내부 전용 — 타일 정보 포함 (클라이언트에 직접 전송 금지) */
export interface InternalRoundRecord {
  round: number;
  players: Record<string, {
    white: number;
    black: number;
    number: NF4Number;
    success: boolean;
    scoreChange: number;
    scoreAfter: number;
  }>;
}

export interface RoundActionLog {
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
    conditionDetail: string;
    byAi?: boolean;
  }>;
}

export interface NF4PlayerSnapshot {
  score: number;
  remainingWhite: number;
  remainingBlack: number;
  submitted: boolean;
  submittedWhite: number | null;
  submittedBlack: number | null;
  submittedNumber: NF4Number | null;
}

export interface NF4UndoSnapshot {
  round: number;
  phase: NF4Phase;
  player1: NF4PlayerSnapshot;
  player2: NF4PlayerSnapshot;
  roundHistory: InternalRoundRecord[];
  actionLog: RoundActionLog[];
  currentSide: 'player1' | 'player2' | null;
  aiTargetNumber: NF4Number | null;
}

export interface InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  round: number;
  phase: NF4Phase;
  player1: NF4PlayerInternal;
  player2: NF4PlayerInternal;
  roundHistory: InternalRoundRecord[];
  winner: string | null;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  playMode: PlayMode;
  gameOver: boolean;
  actionLog: RoundActionLog[];
  /** 솔로 모드에서 현재 조작 대상 */
  currentSide: 'player1' | 'player2' | null;
  /** COM AI가 타일 제출 시 결정한 넘버 (방별 격리) */
  aiTargetNumber: NF4Number | null;
  /** 무르기용 라운드 스냅샷 스택 */
  undoSnapshots: NF4UndoSnapshot[];
  /** 무르기 발생 시 증가 — AI 비동기 제출 취소 신호 */
  aiGeneration: number;
}

export interface JudgeResult {
  success: boolean;
  scoreChange: number;
  conditionDetail: string;
}
