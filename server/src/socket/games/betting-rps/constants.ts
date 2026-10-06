import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  BRPS_TOTAL_ROUNDS,
  BRPS_INITIAL_CHIPS,
  BRPS_BET_MULTIPLIER,
} from '@shared/types/betting-rps.js';

export const ROLE_SELECT_AI_DELAY = { min: 300, max: 800 };
export const AI_DELAY = { min: 500, max: 1500 };
export {
  BRPS_REVEAL_DELAY_MS as REVEAL_DELAY_MS,
  BRPS_WIN_DISPLAY_MS as WIN_DISPLAY_MS,
} from '@shared/types/betting-rps.js';

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
