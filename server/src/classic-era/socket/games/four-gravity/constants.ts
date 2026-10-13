import type { Namespace, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../../../../classic-era/shared/types/events.js';

export const BOARD_SIZE = 9;

export const AI_DELAY = { min: 500, max: 1000 };
export const WIN_DISPLAY_MS = 2000;

export const DIRS_4 = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

export type IO = Namespace<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
