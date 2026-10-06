'use client';

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { DockEdge } from '@/lib/dockPanel';
import {
  getToolOrder,
  getServerToolOrder,
  subscribeToolOrder,
  setToolOrder,
  orderedToolIds,
  moveToolBefore,
} from '@/lib/gameToolOrder';

export interface GameTool {
  id: string;
  title: string;
  content: ReactNode;
  defaultEdge: DockEdge;
  defaultOrder?: number;
  /** 여러 창을 같은 쪽에 붙이면 이 높이를 유지하고 바깥 영역이 스크롤한다. */
  height?: number;
  /** 짧은 입력 창은 고정 높이·내부 스크롤 없이 내용만큼 표시한다. */
  sizeToContent?: boolean;
  mobileSlot?: 'info' | 'controls';
}

interface Registration {
  desktop: boolean;
  register: (tool: GameTool) => void;
  unregister: (id: string) => void;
}
export const GameToolsContext = createContext<Registration | null>(null);
export const useGameToolsRegistration = () => useContext(GameToolsContext);

const subscribeDesktop = (notify: () => void) => {
  const query = window.matchMedia('(min-width: 1024px)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const getDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
const getServerDesktop = () => false;

/** 게임별 배치 id는 독립적이다. 넘버 4에서 옮겨도 다른 게임·대기실 배치는 바뀌지 않는다. */
export function useGameToolsController(scope: string, extraTools: GameTool[] = []) {
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktop, getServerDesktop);
  const [registered, setRegistered] = useState<Record<string, GameTool>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const register = useCallback(
    (tool: GameTool) =>
      setRegistered((prev) => (prev[tool.id] === tool ? prev : { ...prev, [tool.id]: tool })),
    [],
  );
  const unregister = useCallback(
    (id: string) =>
      setRegistered((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }),
    [],
  );
  const setVisible = useCallback(
    (id: string, visible: boolean) => setHidden((prev) => ({ ...prev, [id]: !visible })),
    [],
  );
  const registration = useMemo(
    () => ({ desktop, register, unregister }),
    [desktop, register, unregister],
  );
  const defaultTools = useMemo(
    () =>
      Object.values({
        ...Object.fromEntries(extraTools.map((t) => [t.id, t])),
        ...registered,
      }).sort((a, b) => (a.defaultOrder ?? 50) - (b.defaultOrder ?? 50)),
    [extraTools, registered],
  );
  const subscribeOrder = useCallback(
    (notify: () => void) => subscribeToolOrder(scope, notify),
    [scope],
  );
  const getOrder = useCallback(() => getToolOrder(scope), [scope]);
  const savedOrder = useSyncExternalStore(subscribeOrder, getOrder, getServerToolOrder);
  const tools = useMemo(() => {
    const ids = orderedToolIds(
      savedOrder,
      defaultTools.map((tool) => tool.id),
    );
    const byId = new Map(defaultTools.map((tool) => [tool.id, tool]));
    return ids.map((id) => byId.get(id)!);
  }, [savedOrder, defaultTools]);
  const moveBefore = useCallback(
    (id: string, before?: string) => {
      // 아직 등록되지 않은 창도 저장 순서에서는 지우지 않는다.
      const ids = [...new Set([...savedOrder, ...tools.map((tool) => tool.id)])];
      setToolOrder(scope, moveToolBefore(ids, id, before));
    },
    [scope, savedOrder, tools],
  );
  const resetOrder = useCallback(() => setToolOrder(scope, []), [scope]);
  return useMemo(
    () => ({ scope, desktop, registration, tools, hidden, setVisible, moveBefore, resetOrder }),
    [scope, desktop, registration, tools, hidden, setVisible, moveBefore, resetOrder],
  );
}
export type GameToolsController = ReturnType<typeof useGameToolsController>;
