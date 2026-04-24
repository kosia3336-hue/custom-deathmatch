import type { GameResult } from '@shared/types/events.js';
import type { PlayMode } from '@shared/types/room.js';
import type {
  FTActionLogEntry,
  FTInfoResult,
  FTItem,
  FTMilestoneEntry,
  FTPhase,
  FTSecretLog,
  FTStackCount,
  FTTower,
  FTWinType,
} from '@shared/types/five-towers.js';
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

export interface FTPlayerInternal {
  id: string;
  nickname: string;
  score: number;
  /** 본인이 직접 쌓은 탑별 누적값 (시크릿 포함) */
  myStackedHeights: Record<FTTower, number>;
  itemUsed: boolean;
  itemUsedKind: FTItem | null;
  itemUsedTurn: number | null;
  itemUsedDetail:
    | { item: 'info'; targets: [FTTower, FTTower]; sum: number }
    | { item: 'zero'; target: FTTower }
    | { item: 'secret'; target: FTTower; count: FTStackCount }
    | null;
}

export interface FTTowerInternal {
  id: FTTower;
  height: number;
  completed: boolean;
  completedBy: string | null;
  /** 6칸 마일스톤 도달 여부 */
  halfReached: boolean;
  /** 플레이어별 기여도 (실제 쌓인 칸) */
  contributions: Record<string, number>;
}

export interface FTPlayerSnapshot {
  score: number;
  myStackedHeights: Record<FTTower, number>;
  itemUsed: boolean;
  itemUsedKind: FTItem | null;
  itemUsedTurn: number | null;
  itemUsedDetail: FTPlayerInternal['itemUsedDetail'];
}

export interface FTTowerSnapshot {
  height: number;
  completed: boolean;
  completedBy: string | null;
  halfReached: boolean;
  contributions: Record<string, number>;
}

export interface FTUndoSnapshot {
  turn: number;
  phase: FTPhase;
  currentPlayerId: string;
  player1: FTPlayerSnapshot;
  player2: FTPlayerSnapshot;
  towers: Record<FTTower, FTTowerSnapshot>;
  actionLog: FTActionLogEntry[];
  milestoneLog: FTMilestoneEntry[];
  consecutiveTimeouts: Record<string, number>;
  /** 본인 행동만 추적한 시크릿 로그/정보 결과 */
  player1Info: FTInfoResult[];
  player2Info: FTInfoResult[];
  player1Secret: FTSecretLog[];
  player2Secret: FTSecretLog[];
}

export interface InternalState {
  endGameCallback: EndGameFn;
  onAITurn?: (io: IO, s: InternalState) => void;
  roomId: string;

  turn: number;
  phase: FTPhase;
  firstPlayerId: string;
  currentPlayerId: string;

  player1: FTPlayerInternal;
  player2: FTPlayerInternal;

  towers: Record<FTTower, FTTowerInternal>;

  /** 본인만 보는 정보 결과/시크릿 로그 (player별) */
  infoResults: Record<string, FTInfoResult[]>;
  secretLog: Record<string, FTSecretLog[]>;

  actionLog: FTActionLogEntry[];
  milestoneLog: FTMilestoneEntry[];

  winner: string | null;
  winType: FTWinType | null;
  finishReason: string | null;

  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;

  playMode: PlayMode;
  gameOver: boolean;
  aiGeneration: number;
  undoSnapshots: FTUndoSnapshot[];

  consecutiveTimeouts: Record<string, number>;
  lastAutoActedBy?: string | null;
}
