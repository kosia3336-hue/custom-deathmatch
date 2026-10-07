import type { SBNWRoundRecord, SBNWTile } from '@/shared/types/silper-bnw';

export function computeOpponentUsed(
  history: SBNWRoundRecord[],
  opponentId: string,
): Record<SBNWTile, number> {
  const used: Record<SBNWTile, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of history) {
    const pd = r.players[opponentId];
    if (!pd) continue;
    for (const t of pd.tilesUsed) used[t as SBNWTile] += 1;
  }
  return used;
}
