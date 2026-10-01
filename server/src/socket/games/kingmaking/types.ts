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
  turnTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: KingmakingEndGameFn;
}
