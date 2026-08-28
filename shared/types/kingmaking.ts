/** 킹메이킹 — 5×5 보드에서 탑을 분할 이동해 6층을 만드는 추상전략 게임. */

export const KM_BOARD_SIZE = 5;
export const KM_NORMAL_PIECES = 15;
export const KM_MAX_HEIGHT = 6;

export type KingmakingPieceKind = 'normal' | 'special';
export type KingmakingWinType = 'six-stack' | 'timeout' | 'no-action';

export interface KingmakingPosition {
  row: number;
  col: number;
}

export interface KingmakingPiece {
  id: string;
  ownerId: string;
  kind: KingmakingPieceKind;
}

/** 아래층부터 위층 순서. 빈칸은 빈 배열이다. */
export type KingmakingStack = KingmakingPiece[];
export type KingmakingBoard = KingmakingStack[][];

export type KingmakingAction =
  | { type: 'place'; kind: KingmakingPieceKind; to: KingmakingPosition }
  | {
      type: 'move';
      from: KingmakingPosition;
      to: KingmakingPosition;
      /** 원래 탑 위에서부터 함께 떼어 이동할 말의 수. 이동법도 이 높이로 정한다. */
      count: number;
    };

export interface KingmakingLastAction {
  turn: number;
  actorId: string;
  action: KingmakingAction;
  winnerId: string | null;
}

export interface KingmakingGameData {
  board: KingmakingBoard;
  players: Record<string, { nickname: string }>;
  reserves: Record<string, { normal: number; special: number }>;
  currentPlayerId: string;
  firstPlayerId: string;
  turnNumber: number;
  phase: 'playing' | 'finished';
  lastAction: KingmakingLastAction | null;
  winnerId: string | null;
  winType: KingmakingWinType | null;
  finishReason: string | null;
  turnStartedAt: number | null;
  timeLimitSeconds: number | null;
}

export interface KingmakingArchiveRecord {
  initialBoard: KingmakingBoard;
  finalBoard: KingmakingBoard;
  actions: KingmakingLastAction[];
  finalReserves: Record<string, { normal: number; special: number }>;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  winType: KingmakingWinType | null;
  finishReason: string;
}
