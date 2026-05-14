import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  BNW2_INITIAL_POINTS,
  BNW2_MAX_SCORE,
  BNW2_STAGE_UNIT,
  BNW2_TOTAL_STAGES,
  calcBNW2Stage,
  calcBNW2Color,
} from '@shared/types/bnw2.js';

export const AI_DELAY = { min: 800, max: 1500 };
export const REVEAL_DELAY_MS = 5500;
export const WIN_DISPLAY_MS = 3000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
