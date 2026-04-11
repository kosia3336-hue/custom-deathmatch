import type { Game } from '@/shared/types/game';

const API_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? '';

export async function fetchGames(): Promise<Game[]> {
  const res = await fetch(`${API_BASE_URL}/api/games`);
  if (!res.ok) throw new Error('Failed to fetch games');
  const json = await res.json();
  return json.data as Game[];
}
