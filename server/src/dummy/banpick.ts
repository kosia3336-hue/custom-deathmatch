import type { DummyAiTier } from '@shared/dummy.js';

export interface GameWl {
  wins: number;
  losses: number;
}

/** 패 많은 게임 밴, 같으면 승률 낮은 게임. 0전은 후순위 랜덤. */
export function pickBan(availableIds: string[], records: Record<string, GameWl>): string | null {
  if (availableIds.length === 0) return null;

  const played = availableIds
    .map((id) => {
      const rec = records[id] ?? { wins: 0, losses: 0 };
      const n = rec.wins + rec.losses;
      return {
        id,
        losses: rec.losses,
        played: n > 0,
        winRate: n > 0 ? rec.wins / n : null as number | null,
      };
    })
    .filter((g) => g.played);

  if (played.length > 0) {
    played.sort((a, b) => {
      if (b.losses !== a.losses) return b.losses - a.losses;
      const ar = a.winRate ?? 1;
      const br = b.winRate ?? 1;
      if (ar !== br) return ar - br;
      return 0;
    });
    return played[0].id;
  }

  return availableIds[Math.floor(Math.random() * availableIds.length)] ?? null;
}

export function thinkDelayMs(tier: DummyAiTier, kind: 'ban' | 'move' | 'short'): number {
  if (kind === 'short') {
    return 180 + Math.random() * 220;
  }
  if (kind === 'ban') {
    if (tier === '하') return 400 + Math.random() * 500;
    if (tier === '중') return 600 + Math.random() * 700;
    return 800 + Math.random() * 900;
  }
  if (tier === '하') return 280 + Math.random() * 320;
  if (tier === '중') return 450 + Math.random() * 450;
  return 700 + Math.random() * 550;
}
