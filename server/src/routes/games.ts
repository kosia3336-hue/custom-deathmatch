import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Game } from '@shared/types/game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadGames(): Game[] {
  const candidates = [
    resolve(process.cwd(), 'data', 'games.json'),
    resolve(__dirname, '../data/games.json'),
  ];
  let last: unknown;
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf-8')) as Game[];
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export function getGames(): Game[] {
  return loadGames();
}

export function getGameById(id: string): Game | undefined {
  return loadGames().find((g) => g.id === id);
}

export async function registerGameRoutes(app: FastifyInstance) {
  app.get('/api/games', async () => {
    return { success: true, data: loadGames() };
  });

  app.get<{ Params: { id: string } }>('/api/games/:id', async (req, reply) => {
    const game = getGameById(req.params.id);
    if (!game) {
      return reply.status(404).send({ success: false, error: '게임을 찾을 수 없습니다.' });
    }
    return { success: true, data: game };
  });
}
