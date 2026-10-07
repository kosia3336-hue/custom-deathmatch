import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { createGameToolsLayoutStore } from '@/lib/gameToolsLayout';
import { moveToolBefore, orderedToolIds, setToolOrder } from '@/lib/gameToolOrder';
import type { DockEdge } from '@/lib/dockPanel';

export function useGameToolsLayout(
  scope: string,
  availableIds: string[],
  defaultEdges: Record<string, DockEdge> = {},
) {
  const idsKey = JSON.stringify(availableIds);
  const edgesKey = JSON.stringify(defaultEdges);
  const store = useMemo(
    () => createGameToolsLayoutStore(scope, JSON.parse(idsKey), JSON.parse(edgesKey)),
    [scope, idsKey, edgesKey],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const orderedIds = useMemo(
    () => orderedToolIds(snapshot.order, JSON.parse(idsKey), Object.keys(JSON.parse(edgesKey))),
    [snapshot.order, idsKey, edgesKey],
  );
  const moveBefore = useCallback(
    (id: string, before?: string) => {
      const ids = [...new Set([...snapshot.order, ...orderedIds])];
      setToolOrder(scope, moveToolBefore(ids, id, before));
    },
    [scope, snapshot.order, orderedIds],
  );
  return { orderedIds, docks: snapshot.docks, moveBefore };
}
