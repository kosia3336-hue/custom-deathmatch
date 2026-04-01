import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

/** 게임 종료 후 결과 표시 대기 시간 (ms) */
export const WIN_DISPLAY_MS = 2000;

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
