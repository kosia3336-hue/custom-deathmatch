import type { FastifyInstance } from 'fastify';
import type { Game } from '@shared/types/game.js';
import { getSupabaseAdmin } from '../db/supabase.js';

let cachedGames: Game[] | null = null;

// ── DB에서 게임 목록 로드 ─────────────────────────────────────────────

async function loadGamesFromDb(): Promise<Game[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('games')
    .select('id, name, description, min_players, max_players, supports_multi, supports_com, supports_solo')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`[games] DB 조회 실패: ${error.message}`);
  if (!data || data.length === 0) throw new Error('[games] DB에 게임 데이터가 없습니다.');

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    supportsMulti: row.supports_multi,
    supportsCom: row.supports_com,
    supportsSolo: row.supports_solo,
  }));
}

// ── 서버 시작 시 호출 — 캐시를 채움 ─────────────────────────────────

export async function initGames(): Promise<void> {
  cachedGames = await loadGamesFromDb();
}

// ── 동기 접근자 (캐시 기반) ───────────────────────────────────────────

export function getGames(): Game[] {
  if (!cachedGames) throw new Error('[games] initGames()가 아직 호출되지 않았습니다.');
  return cachedGames;
}

export function getGameById(id: string): Game | undefined {
  return getGames().find((g) => g.id === id);
}

// ── HTTP 라우트 등록 ──────────────────────────────────────────────────

export async function registerGameRoutes(app: FastifyInstance) {
  app.get('/api/games', async () => {
    return { success: true, data: getGames() };
  });

  app.get<{ Params: { id: string } }>('/api/games/:id', async (req, reply) => {
    const game = getGameById(req.params.id);
    if (!game) {
      return reply.status(404).send({ success: false, error: '게임을 찾을 수 없습니다.' });
    }
    return { success: true, data: game };
  });
}
