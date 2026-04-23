import type { SBNWTile } from '@shared/types/silper-bnw.js';

export type SubmitErrorReason =
  | 'empty'
  | 'leadingZero'
  | 'invalidTile'
  | 'tileOverflow';

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: SubmitErrorReason };

export function validateTiles(
  tiles: SBNWTile[],
  pool: Record<SBNWTile, number>,
): ValidationResult {
  if (!Array.isArray(tiles) || tiles.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  for (const t of tiles) {
    if (!Number.isInteger(t) || t < 0 || t > 4) {
      return { ok: false, reason: 'invalidTile' };
    }
  }
  if (tiles.length >= 2 && tiles[0] === 0) {
    return { ok: false, reason: 'leadingZero' };
  }
  const need: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const t of tiles) need[t] = (need[t] ?? 0) + 1;
  for (const k of [0, 1, 2, 3, 4] as SBNWTile[]) {
    if ((pool[k] ?? 0) < need[k]) {
      return { ok: false, reason: 'tileOverflow' };
    }
  }
  return { ok: true };
}

export function tilesToValue(tiles: SBNWTile[]): bigint {
  let v = 0n;
  for (const t of tiles) {
    v = v * 10n + BigInt(t);
  }
  return v;
}

export function tilesToValueStr(tiles: SBNWTile[]): string {
  return tilesToValue(tiles).toString();
}

export function judgeRound(
  firstTiles: SBNWTile[],
  secondTiles: SBNWTile[],
): { winnerId: 'first' | 'second' | null } {
  const a = tilesToValue(firstTiles);
  const b = tilesToValue(secondTiles);
  if (a > b) return { winnerId: 'first' };
  if (b > a) return { winnerId: 'second' };
  return { winnerId: null };
}

export function autoSubmitTiles(pool: Record<SBNWTile, number>): SBNWTile[] {
  for (const t of [1, 2, 3, 4] as SBNWTile[]) {
    if ((pool[t] ?? 0) > 0) return [t];
  }
  if ((pool[0] ?? 0) > 0) return [0];
  return [];
}

export function canAnyLegalSubmit(pool: Record<SBNWTile, number>): boolean {
  return (
    (pool[0] ?? 0) > 0 ||
    (pool[1] ?? 0) > 0 ||
    (pool[2] ?? 0) > 0 ||
    (pool[3] ?? 0) > 0 ||
    (pool[4] ?? 0) > 0
  );
}

export function maxTile(pool: Record<SBNWTile, number>): number {
  for (let t = 4; t >= 0; t--) {
    if ((pool[t as SBNWTile] ?? 0) > 0) return t;
  }
  return -1;
}

export type TiebreakResolution =
  | { kind: 'score'; winner: 'p1' | 'p2' }
  | { kind: 'tiebreakTile'; winner: 'p1' | 'p2' }
  | { kind: 'rematchNeeded' };

export function resolveTiebreaker(
  p1Score: number, p1Tiles: Record<SBNWTile, number>,
  p2Score: number, p2Tiles: Record<SBNWTile, number>,
): TiebreakResolution {
  if (p1Score > p2Score) return { kind: 'score', winner: 'p1' };
  if (p2Score > p1Score) return { kind: 'score', winner: 'p2' };

  const m1 = maxTile(p1Tiles);
  const m2 = maxTile(p2Tiles);
  if (m1 > m2) return { kind: 'tiebreakTile', winner: 'p1' };
  if (m2 > m1) return { kind: 'tiebreakTile', winner: 'p2' };

  return { kind: 'rematchNeeded' };
}

export function consumeTiles(
  pool: Record<SBNWTile, number>,
  tiles: SBNWTile[],
): { pool: Record<SBNWTile, number>; consumed: number } {
  let consumed = 0;
  for (const t of tiles) {
    pool[t] -= 1;
    consumed += 1;
  }
  return { pool, consumed };
}
