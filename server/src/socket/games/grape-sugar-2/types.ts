import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  GS2CardId, GS2Phase, GS2Side, GS2WinType,
  GS2RoundRecord, GS2ResolveStep, GS2PlayerAction,
} from '@shared/types/grape-sugar-2.js';
import type { GrapeSugar2Stage } from '@shared/types/archive.js';
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

export interface GS2PlayerInternal {
  id: string;
  nickname: string;
  side: GS2Side;
  score: number;
  sugarRemain: number;
  hand: GS2CardId[];
  pendingCard: GS2CardId | null;
  pendingSugar: number;
  submitted: boolean;
  hrPenaltyPending: number;
  isAi: boolean;
  /** "숨고르기"를 적용 받은 적이 있는지 (이번 게임 단계에서 1회만 가능) */
  breathUsed: boolean;
}

export interface GS2InternalState {
  endGameCallback: EndGameFn;
  roomId: string;
  phase: GS2Phase;
  round: number;
  maxRound: 8 | 9;
  /** 0 = 본 게임, 1+ = N차 연장 */
  extension: number;
  player1: GS2PlayerInternal;
  player2: GS2PlayerInternal;
  history: GS2RoundRecord[];
  /** 단계별로 분리된 archive용 기록 (본 게임 / 1차 연장 / 2차 연장 …) */
  stages: GrapeSugar2Stage[];
  /** 현재 단계 시작 시점의 양측 누적 점수 (단계 종료 시 차이만 archive에 저장) */
  stageStartScores: { p1: number; p2: number };
  /** 현재 진행 중인 정산 단계 */
  resolveSteps: GS2ResolveStep[];
  resolveTimer: ReturnType<typeof setTimeout> | null;
  /** 라운드 종료 후 다음 라운드 자동 진입 타이머 */
  nextRoundTimer: ReturnType<typeof setTimeout> | null;
  /** 라운드 결과 표시용 임시 보관 */
  lastRoundRecord: GS2RoundRecord | null;
  /** 라운드 입력 마감 타이머 */
  roundTimer: ReturnType<typeof setTimeout> | null;
  roundDeadline: number | null;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  finalWinner: GS2Side | 'tie' | null;
  winType: GS2WinType;
  finishReason: string | null;
  playMode: PlayMode;
  gameOver: boolean;
  /** AI 비동기 캔슬용 generation */
  aiGeneration: number;
  /** 무르기 스냅샷 */
  undoSnapshots: GS2UndoSnapshot[];
  consecutiveTimeouts: Record<string, number>;
  onAITurn?: (io: IO, s: GS2InternalState) => void;
}

export interface GS2PlayerSnapshot {
  score: number;
  sugarRemain: number;
  hand: GS2CardId[];
  pendingCard: GS2CardId | null;
  pendingSugar: number;
  submitted: boolean;
  hrPenaltyPending: number;
  breathUsed: boolean;
}

export interface GS2UndoSnapshot {
  round: number;
  extension: number;
  maxRound: 8 | 9;
  phase: GS2Phase;
  player1: GS2PlayerSnapshot;
  player2: GS2PlayerSnapshot;
  history: GS2RoundRecord[];
  stages: GrapeSugar2Stage[];
  stageStartScores: { p1: number; p2: number };
  consecutiveTimeouts: Record<string, number>;
}

export type { GS2RoundResolveResult } from '@shared/types/grape-sugar-2-resolve.js';

export type { GS2PlayerAction };
