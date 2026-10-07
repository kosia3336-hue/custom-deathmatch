export interface TowerNote {
  height: number;
  tone: 'color' | 'gray';
}
export const EMPTY_TOWER_NOTE: TowerNote = { height: 0, tone: 'color' };

/** 같은 높이는 색 → 회색 → 원복. 다른 높이는 현재 표시 상태를 이어받는다. */
export function cycleTowerNote(note: TowerNote, level: number): TowerNote {
  const height = Math.max(1, Math.min(10, Math.floor(level)));
  if (note.height !== height) return { height, tone: note.height ? note.tone : 'color' };
  return note.tone === 'color' ? { height, tone: 'gray' } : { ...EMPTY_TOWER_NOTE };
}

/** 이전 숫자 메모도 보존하면서 손상된 저장값은 빈 메모로 처리한다. */
export function parseTowerNote(value: unknown): TowerNote {
  if (typeof value === 'number' && Number.isFinite(value))
    return { height: Math.max(0, Math.min(10, Math.floor(value))), tone: 'color' };
  if (value && typeof value === 'object' && 'height' in value && 'tone' in value) {
    const { height, tone } = value;
    if (
      typeof height === 'number' &&
      Number.isFinite(height) &&
      (tone === 'color' || tone === 'gray')
    )
      return { height: Math.max(0, Math.min(10, Math.floor(height))), tone };
  }
  return { ...EMPTY_TOWER_NOTE };
}
