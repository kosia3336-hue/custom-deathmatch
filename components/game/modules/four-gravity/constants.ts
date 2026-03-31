import type { Direction, FourGravityGameData } from '@/shared/types/four-gravity';

export const DIR_LABEL: Record<Direction, string> = {
  up: '▲ 상',
  down: '▼ 하',
  left: '◀ 좌',
  right: '▶ 우',
  none: '무',
};

export const DIRECTION_LIST: { key: Direction; label: string }[] = [
  { key: 'up', label: DIR_LABEL.up },
  { key: 'down', label: DIR_LABEL.down },
  { key: 'left', label: DIR_LABEL.left },
  { key: 'right', label: DIR_LABEL.right },
  { key: 'none', label: DIR_LABEL.none },
];

export const WIN_TYPE_LABEL: Record<NonNullable<FourGravityGameData['winType']>, string> = {
  black: '사목 완성 (흑)',
  white: '사목 완성 (백)',
  neutral: '중립 돌 사목',
  'no-space': '둘 곳 없음',
  'no-neutral': '중립 돌 놓을 곳 없음',
  timeout: '⏱ 시간 초과',
};

export const WIN_TYPE_TOAST_LABEL: Record<NonNullable<FourGravityGameData['winType']>, string> = {
  black: '흑 사목 완성!',
  white: '백 사목 완성!',
  neutral: '중립 사목 완성!',
  'no-space': '더 이상 둘 곳 없음',
  'no-neutral': '중립 돌을 놓지 못함',
  timeout: '시간 초과!',
};

export const STONE_COLOR_CLASS: Record<'black' | 'white', string> = {
  black: 'bg-[#1a1a2e]',
  white: 'border border-gray-300 bg-white',
};
