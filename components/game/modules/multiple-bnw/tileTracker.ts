import type { MBNWTile } from '@/shared/types/multiple-bnw';

export type TileNote = 'uncertain' | 'used';
export type TileNotes = Partial<Record<MBNWTile, TileNote>>;

/** 추리 메모는 미확정 → 사용됨 → 원래 타일 순서로 순환한다. */
export function cycleTileNote(notes: TileNotes, tile: MBNWTile): TileNotes {
  const next = { ...notes };
  if (notes[tile] === 'used') delete next[tile];
  else next[tile] = notes[tile] === 'uncertain' ? 'used' : 'uncertain';
  return next;
}
