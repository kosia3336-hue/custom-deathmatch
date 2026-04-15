import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  MBNW_TILE_SET,
  MBNW_TOTAL_ROUNDS,
  MBNW_TILE_COLOR,
} from '@shared/types/multiple-bnw.js';

export const AI_TILE_DELAY = { min: 200, max: 400 };
export const AI_SUSPECT_DELAY = { min: 500, max: 800 };
export const REVEAL_DELAY_MS = 3000;
export const WIN_DISPLAY_MS = 2000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
