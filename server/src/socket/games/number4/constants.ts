import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  TOTAL_ROUNDS,
  INITIAL_SCORE,
  INITIAL_WHITE,
  INITIAL_BLACK,
  TILES_PER_ROUND,
  NF4_REVEAL_DELAY_MS as REVEAL_DELAY_MS,
} from '@shared/types/number4.js';

export const AI_DELAY = { min: 500, max: 1000 };
export const WIN_DISPLAY_MS = 2000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
