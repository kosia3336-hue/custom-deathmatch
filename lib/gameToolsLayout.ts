import { DEFAULT_DOCK_STATE, getDockState, subscribeDockState, type DockState } from './dockPanel';
import { getToolOrder, getServerToolOrder, subscribeToolOrder } from './gameToolOrder';

export const gameToolDockId = (scope: string, id: string) => `game-tools:v2:${scope}:${id}`;
/** aside와 hud.memo가 같은 정보를 제공해도 원본은 한 벌만 선택한다. */
export function selectGameToolSources<T extends { id: string; defaultOrder?: number }>(
  extra: T[],
  registered: Record<string, T>,
) {
  const byId = { ...Object.fromEntries(extra.map((tool) => [tool.id, tool])), ...registered };
  return {
    reference: byId.reference,
    tools: Object.values(byId)
      .filter((tool) => tool.id !== 'reference')
      .sort((a, b) => (a.defaultOrder ?? 50) - (b.defaultOrder ?? 50)),
  };
}
export interface GameToolsSnapshot {
  order: readonly string[];
  docks: Record<string, DockState>;
}
/** 위치/순서는 기존 v2 키를 유지한다. snapshot 참조는 실제 변경이 있을 때만 바뀐다. */
export function createGameToolsLayoutStore(scope: string, ids: string[]) {
  const server: GameToolsSnapshot = {
    order: getServerToolOrder(),
    docks: Object.fromEntries(ids.map((id) => [id, DEFAULT_DOCK_STATE])),
  };
  let previous: GameToolsSnapshot | undefined;
  return {
    subscribe(notify: () => void) {
      const cleanups = [
        subscribeToolOrder(scope, notify),
        ...ids.map((id) => subscribeDockState(gameToolDockId(scope, id), notify)),
      ];
      return () => cleanups.forEach((cleanup) => cleanup());
    },
    getServerSnapshot: () => server,
    getSnapshot() {
      const order = getToolOrder(scope);
      const docks = Object.fromEntries(
        ids.map((id) => [id, getDockState(gameToolDockId(scope, id))]),
      );
      if (
        previous &&
        previous.order === order &&
        ids.every((id) => previous!.docks[id] === docks[id])
      )
        return previous;
      previous = { order, docks };
      return previous;
    },
  };
}
/** 헤더(최대 32px 버튼+패딩+테두리)의 여유도 포함해 창별 최소 높이에서 계산한다. */
export const DOCK_HEADER_SPACE = 52;
export function horizontalDockLimit(edge: 'top' | 'bottom', minimumBodyHeight: number) {
  if (!minimumBodyHeight) return edge === 'top' ? 'min(30dvh, 240px)' : 'min(23dvh, 190px)';
  const minimum = minimumBodyHeight + DOCK_HEADER_SPACE;
  return `max(${minimum}px, min(40dvh, ${Math.max(300, minimum)}px))`;
}
