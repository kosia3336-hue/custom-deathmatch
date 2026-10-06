import { useCallback, useSyncExternalStore } from 'react';
import {
  getDockState,
  DEFAULT_DOCK_STATE,
  subscribeDockState,
  type DockState,
} from '@/lib/dockPanel';

/** 끌어서 옮기는 창의 자리(lib/dockPanel.ts). 서버 렌더·첫 화면은 기본값(오른쪽), 이후 기기에 기억한 값. */
export function useDockState(id: string, fallback: DockState = DEFAULT_DOCK_STATE): DockState {
  const subscribe = useCallback((listener: () => void) => subscribeDockState(id, listener), [id]);
  const getSnapshot = useCallback(() => getDockState(id, fallback), [id, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
