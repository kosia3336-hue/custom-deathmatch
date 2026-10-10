import { ESKIMO_SIZE, type EskimoCell, type EskimoLastAction } from '@/shared/types/eskimo';

const FILES = ['A', 'B', 'C', 'D', 'E'];

/** 칸 이름. 선 쪽에서 본 체스식 — 왼쪽부터 A~E, 선의 줄이 1. */
export function eskimoCellName(cell: EskimoCell) {
  return `${FILES[cell.col]}${ESKIMO_SIZE - cell.row}`;
}

export function eskimoMoveLabel(entry: EskimoLastAction) {
  const { from, to } = entry.action;
  return `${entry.bear ? '🐻‍❄️ ' : ''}${eskimoCellName(from)} → ${eskimoCellName(to)}`;
}

export const ESKIMO_WIN_HINT: Record<string, string> = {
  surround: '북극곰 포위',
  repetition: '반복수',
  timeout: '제한시간 초과',
  'no-move': '둘 수 없음',
  forfeit: '기권',
};
