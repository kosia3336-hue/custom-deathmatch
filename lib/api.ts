import type { Game } from '@/shared/types/game';

// 게임 목록은 same-origin(/api/games, next.config rewrite → 4001)으로 요청해 CORS 를 피한다.
export async function fetchGames(): Promise<Game[]> {
  const res = await fetch('/api/games');
  if (!res.ok) throw new Error('Failed to fetch games');
  const json = await res.json();
  return json.data as Game[];
}
