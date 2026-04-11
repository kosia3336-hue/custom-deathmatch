import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  INITIAL_CHIPS_DEFAULT,
  INITIAL_ANTE,
  CARDS_PER_ROUND,
  DECK_RESET_THRESHOLD,
} from '@shared/types/indian-poker.js';

export const INITIAL_CHIPS_MIN = 10;
export const INITIAL_CHIPS_MAX = 200;
export const INITIAL_CHIPS_STEP = 5;

export const DIE_PENALTY: Record<string, number> = {
  noPair: 0,
  double: 5,
  straight: 10,
  triple: 10,
};

export const AI_DELAY_MS = { min: 500, max: 1500 };
export const RESULT_DISPLAY_MS = 5000;
export const WIN_DISPLAY_MS = 2000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
