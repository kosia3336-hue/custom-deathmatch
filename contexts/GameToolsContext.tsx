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
import { useGameToolsLayout } from '@/hooks/useGameToolsLayout';

export interface GameTool {
  id: string;
  title: string;
  content: ReactNode;
  headerActions?: ReactNode;
  headerTitle?: ReactNode;
  /** 채팅처럼 최소 본문 공간이 필요한 창. 상·하 배치에서도 유지한다. */
  minBodyHeight?: number;
  defaultOrder?: number;
  /** 여러 창을 같은 쪽에 붙이면 이 높이를 유지하고 바깥 영역이 스크롤한다. */
  preferredBodyHeight?: number;
  /** 짧은 입력 창은 고정 높이·내부 스크롤 없이 내용만큼 표시한다. */
  sizeToContent?: boolean;
  /** 모바일 위치를 정하는 대신 이미 렌더한 info/controls의 PC 중복만 막는다. */
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
  const layout = useGameToolsLayout(
    scope,
    defaultTools.map((tool) => tool.id),
  );
  const tools = useMemo(() => {
    const byId = new Map(defaultTools.map((tool) => [tool.id, tool]));
    return layout.orderedIds.map((id) => byId.get(id)!);
  }, [layout.orderedIds, defaultTools]);
  return useMemo(
    () => ({
      scope,
      desktop,
      registration,
      tools,
      docks: layout.docks,
      orderedIds: layout.orderedIds,
      moveBefore: layout.moveBefore,
    }),
    [scope, desktop, registration, tools, layout.docks, layout.orderedIds, layout.moveBefore],
  );
}
export type GameToolsController = ReturnType<typeof useGameToolsController>;
