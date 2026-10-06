import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { createGameToolsLayoutStore } from '@/lib/gameToolsLayout';
import { moveToolBefore, orderedToolIds, setToolOrder } from '@/lib/gameToolOrder';

export function useGameToolsLayout(scope: string, availableIds: string[]) {
  const idsKey = JSON.stringify(availableIds);
  const store = useMemo(
    () => createGameToolsLayoutStore(scope, JSON.parse(idsKey)),
    [scope, idsKey],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const orderedIds = useMemo(
    () => orderedToolIds(snapshot.order, JSON.parse(idsKey)),
    [snapshot.order, idsKey],
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
