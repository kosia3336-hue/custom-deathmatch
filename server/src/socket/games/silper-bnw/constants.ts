import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  SBNW_MAX_SCORE,
  SBNW_TOTAL_ROUNDS,
  SBNW_MAX_REMATCH,
  SBNW_TOTAL_TILE_COUNT,
  SBNW_INITIAL_TILES,
} from '@shared/types/silper-bnw.js';

export const AI_DELAY = { min: 800, max: 1500 };
export const REVEAL_DELAY_MS = 4500;
export const REMATCH_INTRO_MS = 2500;
export const WIN_DISPLAY_MS = 3000;
export const TIMEOUT_LIMIT = 3;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
