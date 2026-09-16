/** 삼층 오목 — 삼각격자에 돌을 3층까지 쌓아 세 가지 승리 조건 중 하나를 노리는 1:1 추상전략. */

/**
 * 판의 반지름. 5면 가로 11줄이다.
 * 순수 육각형(91칸)이 아니라 여섯 모서리를 한 칸씩 도려낸 85칸이다
 * (도려낸 칸은 shared/logic/triple-gomoku.ts 의 TRIMMED_CORNERS).
 */
export const TG_BOARD_RADIUS = 5;
export const TG_STONES_PER_PLAYER = 25;
export const TG_MAX_HEIGHT = 3;
/** 오목으로 인정하는 길이. 이보다 길게 이어지면 인정하지 않는다. */
export const TG_LINE_LENGTH = 5;
/** 3층에 올라간 자기 돌이 이 개수면 승리. */
export const TG_TOP_LAYER_WIN = 5;
/** 서로 인접한 3층 돌이 이 개수면 승리. */
export const TG_TOP_CLUSTER_WIN = 3;
/** 기본 배치에서 턴마다 놓는 돌 수. 선 1 → 후 2 → 선 2 → 후 1 로 각자 3개씩 놓는다. */
export const TG_SETUP_SEQUENCE = [1, 2, 2, 1] as const;

export interface TripleGomokuCell {
  q: number;
  r: number;
}

/** 아래층부터 위층 순서로 쌓인 돌 주인의 id. 길이가 곧 층수다. */
export type TripleGomokuStack = string[];

/** 좌표 키(`q,r`) → 돌 더미. 빈칸은 키를 갖지 않는다. */
export type TripleGomokuBoard = Record<string, TripleGomokuStack>;

export type TripleGomokuPhase = 'setup' | 'playing' | 'finished';

export type TripleGomokuWinType =
  | 'line'
  | 'top-count'
  | 'top-cluster'
  | 'timeout'
  | 'no-action'
  | 'forfeit';

export type TripleGomokuAction =
  | { type: 'place'; to: TripleGomokuCell }
  | { type: 'move'; from: TripleGomokuCell; to: TripleGomokuCell };

export interface TripleGomokuLastAction {
  turn: number;
  actorId: string;
  action: TripleGomokuAction;
}

export interface TripleGomokuWin {
  playerId: string;
  type: TripleGomokuWinType;
  /** 승리를 만든 칸들. 시간 초과처럼 판과 무관한 승리는 빈 배열이다. */
  cells: TripleGomokuCell[];
}

export interface TripleGomokuGameData {
  board: TripleGomokuBoard;
  players: Record<string, { nickname: string }>;
  /** 아직 손에 남은 돌 수. */
  reserves: Record<string, number>;
  currentPlayerId: string;
  firstPlayerId: string;
  phase: TripleGomokuPhase;
  turnNumber: number;
  /** 기본 배치 단계에서 이번 턴에 더 놓아야 하는 돌 수. 본 게임에서는 0이다. */
  setupRemaining: number;
  lastAction: TripleGomokuLastAction | null;
  winnerId: string | null;
  winType: TripleGomokuWinType | null;
  winCells: TripleGomokuCell[];
  finishReason: string | null;
  turnStartedAt: number | null;
  timeLimitSeconds: number | null;
}

export interface TripleGomokuArchiveRecord {
  finalBoard: TripleGomokuBoard;
  actions: TripleGomokuLastAction[];
  finalReserves: Record<string, number>;
  players: Record<string, { nickname: string }>;
  firstPlayerId: string;
  winnerId: string | null;
  winType: TripleGomokuWinType | null;
  winCells: TripleGomokuCell[];
  finishReason: string;
}
