import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import type { IO } from './socket/types.js';
import config from './config.js';
import { registerGameRoutes, initGames, getGames } from './routes/games.js';
import { registerAdminRoutes } from './routes/admin.js';
import { setupSocketHandlers } from './socket/index.js';
import { preloadBiasTitlesCache } from './shop/biasTitlesCache.js';
import { roomStore } from './store/rooms.js';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigins, credentials: true });

  await registerGameRoutes(app);

  // 배포 스크립트가 "지금 재시작해도 되는가"를 여기서 판단한다. 이 서버는 방
  // 상태를 메모리에 들고 있어, 재시작하면 진행 중이던 게임이 그대로 사라진다.
  // scripts/deploy/release.sh 는 activeRooms 가 0 이 될 때까지 기다렸다가 올린다.
  app.get('/health', async () => {
    const rooms = roomStore.getAll();
    return {
      status: 'ok',
      // 대기 중인 방도 재시작하면 사라지므로 전부 센다
      activeRooms: rooms.length,
      inGameRooms: rooms.filter((r) => r.status === 'playing').length,
      timestamp: Date.now(),
    };
  });

  // io 인스턴스는 listen 후 생성되므로 lazy getter로 전달
  let ioInstance: IO | null = null;
  registerAdminRoutes(app, () => ioInstance);

  await app.listen({ port: config.port, host: config.host });

  ioInstance = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: config.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  });

  setupSocketHandlers(ioInstance);

  await initGames();
  app.log.info(`[games] ${getGames().length}개 게임 로드 완료`);

  // bias 칭호 캐시 미리 로드 (실패해도 앱은 계속 기동)
  try {
    await preloadBiasTitlesCache();
    app.log.info('[shop] bias titles cache preloaded');
  } catch (err) {
    app.log.warn({ err }, '[shop] bias titles cache preload failed');
  }

  app.log.info(`listening on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
