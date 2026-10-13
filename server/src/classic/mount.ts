import type { FastifyInstance } from 'fastify';
import type { Server } from 'socket.io';
import { registerGameRoutes } from '../classic-era/routes/games.js';
import { setupSocketHandlers } from '../classic-era/socket/index.js';
import { roomStore } from '../classic-era/store/rooms.js';

export async function registerClassicRoutes(app: FastifyInstance) {
  await registerGameRoutes(app);
}

export function mountClassicSockets(io: Server) {
  setupSocketHandlers(io.of('/classic') as never);
}

/** 재시작 시 같이 사라지는 초창기 방. 드레인 대기에서 현재 방과 같이 센다. */
export function countClassicOccupiedRooms(): number {
  return roomStore
    .getAll()
    .filter((r) => r.players.length > 0 || r.spectators.length > 0).length;
}
