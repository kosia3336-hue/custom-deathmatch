import type { DockEdge } from './dockPanel';

export interface ToolRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface InsertionGuide {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 드롭 순서와 안내선을 같은 판정으로 계산한다. items는 이동 중인 창을 제외한 화면 순서. */
export function getToolInsertion(
  edge: DockEdge,
  x: number,
  y: number,
  region: ToolRect,
  items: readonly { id: string; rect: ToolRect }[],
): { beforeId?: string; guide: InsertionGuide } | null {
  if (!items.length) return null;
  const horizontal = edge === 'top' || edge === 'bottom';
  const before = items.find(({ rect }) =>
    horizontal ? x < (rect.left + rect.right) / 2 : y < (rect.top + rect.bottom) / 2,
  );
  const last = items[items.length - 1].rect;
  const position = before
    ? (horizontal ? before.rect.left : before.rect.top) - 4
    : (horizontal ? last.right : last.bottom) + 4;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  return {
    beforeId: before?.id,
    guide: horizontal
      ? {
          left: clamp(position - 1.5, region.left + 2, region.right - 5),
          top: region.top + 8,
          width: 3,
          height: Math.max(0, region.bottom - region.top - 16),
        }
      : {
          left: region.left + 8,
          top: clamp(position - 1.5, region.top + 2, region.bottom - 5),
          width: Math.max(0, region.right - region.left - 16),
          height: 3,
        },
  };
}
