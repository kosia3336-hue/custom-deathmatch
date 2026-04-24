import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  FT_MAX_SCORE,
  FT_TOWER_MAX_HEIGHT,
  FT_HALF_MILESTONE,
  FT_MIN_STACK,
  FT_MAX_STACK,
  FT_TOWERS,
  FT_ITEMS,
} from '@shared/types/five-towers.js';

export const AI_DELAY = { min: 800, max: 1700 };
export const MILESTONE_DISPLAY_MS = 2200;
export const WIN_DISPLAY_MS = 3000;
export const TIMEOUT_LIMIT = 3;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
