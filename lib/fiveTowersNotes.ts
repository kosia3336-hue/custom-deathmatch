export interface TowerNote {
  height: number;
  /** 이 칸부터 맨 위까지 회색. null이면 모두 원래 탑 색. */
  grayFrom: number | null;
}
export const EMPTY_TOWER_NOTE: TowerNote = { height: 0, grayFrom: null };

/** 같은 맨 위 칸은 색 → 해당 칸 회색 → 원복. 아래 칸은 회색 구간을 확장한다. */
export function cycleTowerNote(note: TowerNote, level: number): TowerNote {
  const height = Math.max(1, Math.min(10, Math.floor(level)));
  if (height === note.height)
    return note.grayFrom === null ? { height, grayFrom: height } : { ...EMPTY_TOWER_NOTE };
  if (note.grayFrom !== null)
    return { height: Math.max(note.height, height), grayFrom: Math.min(note.grayFrom, height) };
  return { height, grayFrom: null };
}

export function towerNoteTone(note: TowerNote, level: number): 'empty' | 'color' | 'gray' {
  if (level > note.height) return 'empty';
  return note.grayFrom !== null && level >= note.grayFrom ? 'gray' : 'color';
}

/** 이전 숫자/탑 전체 회색 저장값을 새 구간 메모로 옮긴다. */
export function parseTowerNote(value: unknown): TowerNote {
  if (typeof value === 'number' && Number.isFinite(value))
    return { height: Math.max(0, Math.min(10, Math.floor(value))), grayFrom: null };
  if (value && typeof value === 'object' && 'height' in value) {
    if (typeof value.height !== 'number' || !Number.isFinite(value.height))
      return { ...EMPTY_TOWER_NOTE };
    const height = Math.max(0, Math.min(10, Math.floor(value.height)));
    if ('grayFrom' in value) {
      const gray = value.grayFrom;
      if (gray === null) return { height, grayFrom: null };
      if (typeof gray === 'number' && Number.isFinite(gray))
        return {
          height,
          grayFrom: height ? Math.max(1, Math.min(height, Math.floor(gray))) : null,
        };
    } else if ('tone' in value && (value.tone === 'color' || value.tone === 'gray')) {
      return { height, grayFrom: height && value.tone === 'gray' ? height : null };
    }
  }
  return { ...EMPTY_TOWER_NOTE };
}
