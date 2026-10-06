import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  ID_TOTAL_ROUNDS,
  ID_INITIAL_SCORE,
  ID_INITIAL_COIN_STOCK,
} from '@shared/types/invest-donate.js';

export const AI_DELAY = { min: 500, max: 1500 };
export {
  ID_REVEAL_DELAY_MS as REVEAL_DELAY_MS,
  ID_WIN_DISPLAY_MS as WIN_DISPLAY_MS,
} from '@shared/types/invest-donate.js';

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
