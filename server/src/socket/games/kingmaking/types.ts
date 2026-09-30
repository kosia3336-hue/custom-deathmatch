import type {
  KingmakingBoard,
  KingmakingLastAction,
  KingmakingPiece,
  KingmakingWinType,
} from '@shared/types/kingmaking.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type KingmakingEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface KingmakingReserve {
  normal: KingmakingPiece[];
  special: KingmakingPiece | null;
}

/**
 * 무르기 한 수를 되돌리기 위해 남겨 두는 판 상태.
 *
 * 판과 보유 말만으로는 모자란다 — 같은 배치를 두 번 만들 수 없는 규칙이 있어
 * positionHistory 까지 되돌려야 한다. 안 그러면 무른 뒤 같은 자리에 다시 두는 것이
 * '반복' 으로 막힌다.
 */
export interface KingmakingUndoSnapshot {
  board: KingmakingBoard;
  positionHistory: string[];
  reserves: Record<string, KingmakingReserve>;
  currentPlayerId: string;
  turnNumber: number;
  lastAction: KingmakingLastAction | null;
  actionLogLength: number;
}

export interface KingmakingState {
  roomId: string;
  players: [Player, Player];
  playMode: PlayMode;
  board: KingmakingBoard;
  initialBoard: KingmakingBoard;
  /** 현재 판을 포함해 경기 중 한 번이라도 나온 판 배치 키. */
  positionHistory: Set<string>;
  reserves: Record<string, KingmakingReserve>;
  currentPlayerId: string;
  firstPlayerId: string;
  turnNumber: number;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  actionLog: KingmakingLastAction[];
  lastAction: KingmakingLastAction | null;
  winnerId: string | null;
  winType: KingmakingWinType | null;
  finishReason: string | null;
  gameOver: boolean;
  /** 복기 수순을 조용히 다시 적용하는 동안. 방송·종료 예약을 막는다. */
  reviewing: boolean;
  undoStack: KingmakingUndoSnapshot[];
  turnTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: KingmakingEndGameFn;
}
