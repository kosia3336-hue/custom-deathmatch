import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  BANK_TOTAL_ROUNDS,
  BANK_DENOMINATIONS,
  BANK_INITIAL_INVENTORY,
  BANK_INITIAL_TOTAL_COUNT,
  BANK_INITIAL_TOTAL_AMOUNT,
} from '@shared/types/bank-game.js';

/* 정산 애니메이션 타이밍 (ms) */
export const FIRST_REVEAL_BANNER_MS = 1300;
export const RESOLVE_START_DELAY_MS = 400;
export const RESOLVE_FLIP_DELAY_MS = 1000;
export const RESOLVE_CROWN_DELAY_MS = 600;
export const RESOLVE_SUMMARY_DELAY_MS = 800;
export const RESOLVE_FINISH_HOLD_MS = 600;

/* 라운드 전환 / 마감 */
export const ROUND_END_AUTO_DELAY_MS = 6000;
export const FINAL_RESULT_HOLD_MS = 3000;

export const AI_THINK_DELAY_EASY = { min: 600, max: 1200 };
export const AI_THINK_DELAY_NORMAL = { min: 800, max: 1600 };
export const AI_THINK_DELAY_HARD = { min: 1100, max: 2200 };

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export type BankAiDifficulty = 'easy' | 'normal' | 'hard';
