import type { FastifyInstance } from 'fastify';
import type { Game } from '../../../../classic-era/shared/types/game.js';

/** 2026-04-01 기준 목록. 사중력 사목만 있다. */
const GAMES: Game[] = [
  {
    id: 'game-001',
    name: '사중력 사목',
    description: '9×9 보드 위에서 중력 방향을 바꿔가며 사목을 만드는 전략 보드게임',
    minPlayers: 2,
    maxPlayers: 2,
    supportsMulti: true,
    supportsCom: true,
    supportsSolo: true,
  },
];

export function getGames(): Game[] {
  return GAMES;
}

export function getGameById(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

export async function registerGameRoutes(app: FastifyInstance) {
  app.get('/api/classic/games', async () => {
    return { success: true, data: getGames() };
  });

  app.get<{ Params: { id: string } }>('/api/classic/games/:id', async (req, reply) => {
    const game = getGameById(req.params.id);
    if (!game) {
      return reply.status(404).send({ success: false, error: '게임을 찾을 수 없습니다.' });
    }
    return { success: true, data: game };
  });
}
