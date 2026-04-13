import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  ID_TOTAL_ROUNDS,
  ID_INITIAL_SCORE,
  ID_INITIAL_COIN_STOCK,
} from '@shared/types/invest-donate.js';

export const AI_DELAY = { min: 500, max: 1500 };
export const REVEAL_DELAY_MS = 4000;
export const WIN_DISPLAY_MS = 2000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
