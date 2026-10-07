import { useCallback, type RefObject } from 'react';
import { resolveDrop, type DockEdge, type DockState } from '@/lib/dockPanel';
import { getToolInsertion } from '@/lib/gameToolDrop';

export type ToolEdge = DockEdge | 'floating';
export type DockRegions = Partial<Record<ToolEdge, HTMLElement>>;
const edges: DockEdge[] = ['left', 'right', 'top', 'bottom'];
function peers(regions: DockRegions, edge: DockEdge) {
  return Array.from(regions[edge]?.children ?? []).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
}
/** DOM 좌표는 드래그/스크롤/리사이즈마다 새로 읽고 순수 삽입 판정을 재사용한다. */
export function useDockTargets(
  regions: RefObject<DockRegions>,
  id: string,
  dock: DockState,
  moveBefore: (id: string, before?: string) => void,
) {
  const insertion = useCallback(
    (edge: DockEdge, x: number, y: number) => {
      const element = regions.current[edge];
      const region = element?.getBoundingClientRect();
      if (!region || region.width <= 0 || region.height <= 0) return null;
      const items = peers(regions.current, edge).flatMap((item) => {
        const peerId = item.dataset.toolId;
        const rect = item.querySelector('section')?.getBoundingClientRect();
        return peerId && peerId !== id && rect ? [{ id: peerId, rect }] : [];
      });
      return getToolInsertion(
        edge,
        x,
        y,
        region,
        items,
        element ? getComputedStyle(element).flexDirection === 'row' : undefined,
      );
    },
    [regions, id],
  );
  const resolveDockTarget = useCallback(
    (x: number, y: number) => {
      for (const edge of edges) {
        const rect = regions.current[edge]?.getBoundingClientRect();
        if (
          rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        )
          return edge;
      }
      return resolveDrop(x, y, window.innerWidth, window.innerHeight);
    },
    [regions],
  );
  const getInsertionGuide = useCallback(
    (edge: DockEdge, x: number, y: number) => insertion(edge, x, y)?.guide ?? null,
    [insertion],
  );
  const onDockDrop = useCallback(
    (edge: DockEdge, x: number, y: number) => moveBefore(id, insertion(edge, x, y)?.beforeId),
    [moveBefore, id, insertion],
  );
  const onReorder = useCallback(
    (direction: -1 | 1) => {
      if (dock.mode !== 'docked') return;
      const ids = peers(regions.current, dock.edge).map((item) => item.dataset.toolId!);
      const index = ids.indexOf(id);
      if (index < 0 || index + direction < 0 || index + direction >= ids.length) return;
      moveBefore(id, ids[direction < 0 ? index - 1 : index + 2]);
    },
    [regions, dock, id, moveBefore],
  );
  return { resolveDockTarget, getInsertionGuide, onDockDrop, onReorder };
}
