import { useCallback, useSyncExternalStore } from 'react';
import {
  getDockState,
  getServerDockState,
  subscribeDockState,
  type DockState,
} from '@/lib/dockPanel';

/** 끌어서 옮기는 창의 자리(lib/dockPanel.ts). 서버 렌더·첫 화면은 기본값(오른쪽), 이후 기기에 기억한 값. */
export function useDockState(id: string): DockState {
  const subscribe = useCallback((listener: () => void) => subscribeDockState(id, listener), [id]);
  const getSnapshot = useCallback(() => getDockState(id), [id]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerDockState);
}
