/**
 * 에스키모 — 5×5 판에서 말을 미끄러뜨리거나 북극곰을 한 칸 옮겨, 북극곰의 사방을 먼저
 * 막는 쪽이 이기는 1:1 추상전략.
 */

export const ESKIMO_SIZE = 5;
/** 북극곰을 옮기면 그다음 이만큼의 턴(양쪽 차례를 모두 센다) 동안 아무도 못 옮긴다. */
export const ESKIMO_BEAR_LOCK_TURNS = 4;
/** 한 수 제한 시간 기본값. 방에서 에스키모를 고르면 시간 제한을 이 값으로 맞춘다. */
export const ESKIMO_DEFAULT_TURN_SECONDS = 120;

/** 판 위 북극곰 말. 플레이어 말은 그 사람의 id 를 칸에 적는다. */
export const ESKIMO_BEAR = 'bear';

export interface EskimoCell {
  row: number;
  col: number;
}

/** [row][col]. 칸 값은 플레이어 id · ESKIMO_BEAR · 빈칸 null. 0행이 후 플레이어 쪽이다. */
export type EskimoBoard = (string | null)[][];

export type EskimoPhase = 'playing' | 'finished';

export type EskimoWinType = 'surround' | 'repetition' | 'timeout' | 'no-move' | 'forfeit';

/**
 * 말 하나를 옮긴다. 내 말은 고른 방향으로 막힐 때까지 미끄러진 칸, 북극곰은 붙은 한 칸이
 * 도착점이다. 방향은 from·to 로 정해진다.
 */
export interface EskimoAction {
  type: 'move';
  from: EskimoCell;
  to: EskimoCell;
}

export interface EskimoLastAction {
  turn: number;
  actorId: string;
  action: EskimoAction;
  /** 옮긴 말이 북극곰이었는지 */
  bear: boolean;
}

export interface EskimoGameData {
  board: EskimoBoard;
  players: Record<string, { nickname: string }>;
  firstPlayerId: string;
  currentPlayerId: string;
  phase: EskimoPhase;
  turnNumber: number;
  /** 이번 턴을 포함해 북극곰을 옮길 수 없는 남은 턴 수. 0 이면 지금 옮길 수 있다. */
  bearLockTurns: number;
  lastAction: EskimoLastAction | null;
  /** 지금까지 둔 수 전부(둔 순서대로). 판이 작아 길어 봐야 수백 개다. */
  history: EskimoLastAction[];
  winnerId: string | null;
  winType: EskimoWinType | null;
  /** 승리를 만든 칸들(북극곰과 그 사방의 말). 판과 무관한 승리는 빈 배열. */
  winCells: EskimoCell[];
  finishReason: string | null;
  turnStartedAt: number | null;
  timeLimitSeconds: number | null;
}

export interface EskimoArchiveRecord {
  actions: EskimoLastAction[];
  players: Record<string, { nickname: string }>;
  firstPlayerId: string;
  /** 후 플레이어 id. 첫 판을 다시 세울 때 쓴다. */
  secondPlayerId: string;
  finalBoard: EskimoBoard;
  winnerId: string | null;
  winType: EskimoWinType | null;
  winCells: EskimoCell[];
  finishReason: string;
}
