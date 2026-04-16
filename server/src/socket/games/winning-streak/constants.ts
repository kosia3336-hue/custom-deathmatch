import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  WS_TOTAL_ROUNDS,
  CARD_TYPES,
  WS_INITIAL_CARDS,
} from '@shared/types/winning-streak.js';

export const AI_CARD_DELAY = { min: 500, max: 1000 };
export const REVEAL_DELAY_MS = 3000;
export const WIN_DISPLAY_MS = 2000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
