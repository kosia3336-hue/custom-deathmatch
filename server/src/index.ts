import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import type { IO } from './socket/types.js';
import config from './config.js';
import { registerGameRoutes, initGames, getGames } from './routes/games.js';
import { countClassicOccupiedRooms, mountClassicSockets, registerClassicRoutes } from './classic/mount.js';
import { registerAdminRoutes } from './routes/admin.js';
import { setupSocketHandlers } from './socket/index.js';
import { preloadBiasTitlesCache } from './shop/biasTitlesCache.js';
import { roomStore } from './store/rooms.js';
import { startGuildRankSettleLoop } from './rank/settleGuildRankDueV4.js';
import { warmFarewellFormulaPuzzles } from './socket/games/farewell-formula/generator.js';

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
      // 대기 중인 방도 재시작하면 사라지므로 함께 센다.
      // /classic 네임스페이스 방도 같은 프로세스 메모리라 같이 센다.
      activeRooms: occupied.length + countClassicOccupiedRooms(),
      inGameRooms: occupied.filter((r) => r.status === 'playing').length,
      timestamp: Date.now(),
    };
  });

  await registerClassicRoutes(app);

  // io 인스턴스는 listen 후 생성되므로 lazy getter로 전달
  let ioInstance: IO | null = null;
  registerAdminRoutes(app, () => ioInstance);

  await app.listen({ port: config.port, host: config.host });

  ioInstance = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: config.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  });

  setupSocketHandlers(ioInstance);
  mountClassicSockets(ioInstance);

  void warmFarewellFormulaPuzzles().catch((err: unknown) => {
    app.log.warn({ err }, '[이별 공식] 자동 출제 캐시 준비 실패');
  });

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

  startGuildRankSettleLoop();

  app.log.info(`listening on http://${config.host}:${config.port}`);
}

// 이 서버는 방·게임 상태를 전부 메모리에 들고 있다(위 /health 주석 참고).
// socket.io 는 리스너에서 던진 예외를 잡지 않고 process.nextTick 밖으로
// 흘려보내므로, 게임 모듈의 예외 하나가 프로세스를 죽이고 진행 중이던 모든
// 방을 함께 날린다. 개별 핸들러의 방어를 뚫고 올라온 예외까지 여기서 받아
// 기록만 남기고 계속 살려 둔다 — 한 방의 버그 때문에 전체를 잃지 않기 위해
// 프로세스 상태가 흐트러졌을 가능성보다 가동 유지를 우선한다.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] 프로세스를 유지한다', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] 프로세스를 유지한다', reason);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
