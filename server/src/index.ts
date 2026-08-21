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
    // 시스템 룸(이벤트 룸)은 기동 시 만들어져 status 가 늘 'playing' 이고 사람이
    // 없어도 사라지지 않는다. 이걸 세면 activeRooms 가 0 이 되는 순간이 없어
    // 드레인 대기가 영원히 끝나지 않는다. 잃을 것이 있는 방 — 사람이 들어
    // 있는 일반 방 — 만 센다.
    const occupied = roomStore
      .getAll()
      .filter((r) => !roomStore.isSystemRoom(r.id))
      .filter((r) => r.players.length > 0 || r.spectators.length > 0);

    return {
      status: 'ok',
      // 대기 중인 방도 재시작하면 사라지므로 함께 센다
      activeRooms: occupied.length,
      inGameRooms: occupied.filter((r) => r.status === 'playing').length,
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

  const { startLiveDummy } = await import('./dummy/live/index.js');
  void startLiveDummy(ioInstance).catch((err) => {
    console.warn('[liveDummy] start 실패', (err as Error).message);
  });

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
