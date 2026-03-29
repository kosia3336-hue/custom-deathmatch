import type { Direction } from '@/shared/types/four-gravity';

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
