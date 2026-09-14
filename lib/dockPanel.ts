/**
 * 끌어서 옮기는 창(DockablePanel)의 자리 — 가장자리에 붙었거나(상·하·좌·우), 원하는 곳에 떠 있거나.
 * 창마다 id 로 기기(브라우저)에 기억한다. 대기실 채팅창이 처음 쓰고, 인게임 메모 등도 같은 파츠를 쓸 수 있다.
 *
 * React 를 모르는 순수 모듈이다(테스트용). 컴포넌트에서는 hooks/useDockState.ts 로 읽는다.
 */

export type DockEdge = 'left' | 'right' | 'top' | 'bottom';

export type DockState =
  | { mode: 'docked'; edge: DockEdge }
  | { mode: 'floating'; x: number; y: number };

/** 기본은 오른쪽에 붙어 있다. 서버 렌더도 이 값으로 그린다(같은 참조를 유지해야 한다). */
export const DEFAULT_DOCK_STATE: DockState = Object.freeze({ mode: 'docked', edge: 'right' }) as DockState;

/** 가장자리에서 이만큼(px) 안에 놓으면 붙는다. 그 밖이면 놓은 자리에 띄운다. */
export const SNAP_DISTANCE = 80;

const EDGES: readonly DockEdge[] = ['left', 'right', 'top', 'bottom'];
const cache = new Map<string, DockState>();
const listeners = new Map<string, Set<() => void>>();
const storageKey = (id: string) => `cdm-dock:${id}`;

export function parseDockState(raw: string | null): DockState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { mode?: unknown; edge?: unknown; x?: unknown; y?: unknown };
    if (value.mode === 'docked' && EDGES.includes(value.edge as DockEdge)) {
      return { mode: 'docked', edge: value.edge as DockEdge };
    }
    if (value.mode === 'floating' && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { mode: 'floating', x: value.x as number, y: value.y as number };
    }
  } catch {
    // 깨진 값은 기본으로
  }
  return null;
}

export function getDockState(id: string): DockState {
  const hit = cache.get(id);
  if (hit) return hit;
  let state = DEFAULT_DOCK_STATE;
  try {
    state = parseDockState(window.localStorage.getItem(storageKey(id))) ?? DEFAULT_DOCK_STATE;
  } catch {
    // 저장소를 못 읽는 환경
  }
  cache.set(id, state);
  return state;
}

export function getServerDockState(): DockState {
  return DEFAULT_DOCK_STATE;
}

export function setDockState(id: string, next: DockState): void {
  cache.set(id, next);
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(next));
  } catch {
    // 저장 불가 환경이면 이번 방문 동안만 기억
  }
  listeners.get(id)?.forEach((listener) => listener());
}

export function subscribeDockState(id: string, listener: () => void): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}

/** 놓은 지점이 가장자리 SNAP_DISTANCE 안이면 가장 가까운 가장자리, 아니면 null(그 자리에 띄움). */
export function resolveDrop(
  x: number,
  y: number,
  width: number,
  height: number,
  snap: number = SNAP_DISTANCE,
): DockEdge | null {
  const distances: [DockEdge, number][] = [
    ['left', x],
    ['right', width - x],
    ['top', y],
    ['bottom', height - y],
  ];
  let best: [DockEdge, number] | null = null;
  for (const entry of distances) {
    if (entry[1] <= snap && (!best || entry[1] < best[1])) best = entry;
  }
  return best ? best[0] : null;
}

/** 떠 있는 창이 화면 밖으로 나가지 않게 왼쪽 위 좌표를 줄인다. */
export function clampFloating(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): { x: number; y: number } {
  const maxX = Math.max(margin, viewportWidth - panelWidth - margin);
  const maxY = Math.max(margin, viewportHeight - panelHeight - margin);
  return {
    x: Math.round(Math.min(Math.max(x, margin), maxX)),
    y: Math.round(Math.min(Math.max(y, margin), maxY)),
  };
}
