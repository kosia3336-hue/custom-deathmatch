import type { AbstractAiDifficulty } from '@shared/types/game.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type {
  TripleGomokuBoard,
  TripleGomokuCell,
  TripleGomokuLastAction,
  TripleGomokuPhase,
  TripleGomokuWinType,
} from '@shared/types/triple-gomoku.js';
import type { IO } from '../../types.js';

export type TripleGomokuEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

/** 무르기용 — 한 행동을 적용하기 직전의 판·손 돌·차례. */
export interface TripleGomokuUndoSnapshot {
  board: TripleGomokuBoard;
  reserves: Record<string, number>;
  currentPlayerId: string;
  phase: TripleGomokuPhase;
  turnNumber: number;
  setupTurnIndex: number;
  setupRemaining: number;
  lastAction: TripleGomokuLastAction | null;
  actionLogLength: number;
}

export interface TripleGomokuState {
  roomId: string;
  players: [Player, Player];
  playMode: PlayMode;
  aiDifficulty: AbstractAiDifficulty;
  board: TripleGomokuBoard;
  /** 아직 손에 남은 돌 수. 놓기로만 줄고 이동으로는 줄지 않는다. */
  reserves: Record<string, number>;
  currentPlayerId: string;
  firstPlayerId: string;
  phase: TripleGomokuPhase;
  turnNumber: number;
  /** TG_SETUP_SEQUENCE 의 몇 번째 턴인지. */
  setupTurnIndex: number;
  /** 이번 기본 배치 턴에 더 놓아야 하는 돌 수. */
  setupRemaining: number;
  actionLog: TripleGomokuLastAction[];
  /** 행동마다 적용 직전 모습을 쌓는다. 무르면 위에서부터 꺼낸다. */
  undoStack: TripleGomokuUndoSnapshot[];
  lastAction: TripleGomokuLastAction | null;
  winnerId: string | null;
  winType: TripleGomokuWinType | null;
  winCells: TripleGomokuCell[];
  finishReason: string | null;
  gameOver: boolean;
  startedAt: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  finishTimer: ReturnType<typeof setTimeout> | null;
  endGameCallback: TripleGomokuEndGameFn;
}
