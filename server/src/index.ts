import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import config from './config.js';
import { registerGameRoutes } from './routes/games.js';
import { setupSocketHandlers } from './socket/index.js';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigins, credentials: true });

  await registerGameRoutes(app);

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  await app.listen({ port: config.port, host: config.host });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: config.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  });

  setupSocketHandlers(io);

  app.log.info(`listening on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
