import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGameToolsLayoutStore,
  gameToolDockId,
  horizontalDockLimit,
} from '../../../lib/gameToolsLayout';
import { setDockState } from '../../../lib/dockPanel';
import { setToolOrder } from '../../../lib/gameToolOrder';

afterEach(() => vi.unstubAllGlobals());
describe('공용 창 배치 저장 계약', () => {
  it('기존 v2 위치/순서를 읽으며 실제 변경이 없으면 동일한 snapshot을 반환한다', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    const scope = 'layout-contract-v2';
    setToolOrder(scope, ['tracker', 'future-tool', 'chat']);
    setDockState(gameToolDockId(scope, 'chat'), { mode: 'docked', edge: 'top' });
    const store = createGameToolsLayoutStore(scope, ['chat', 'tracker']);
    const first = store.getSnapshot();
    expect(first.order).toEqual(['tracker', 'future-tool', 'chat']);
    expect(first.docks.chat).toEqual({ mode: 'docked', edge: 'top' });
    expect(store.getSnapshot()).toBe(first);
    const notify = vi.fn();
    const unsubscribe = store.subscribe(notify);
    setDockState(gameToolDockId(scope, 'chat'), { mode: 'docked', edge: 'bottom' });
    expect(notify).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).not.toBe(first);
    unsubscribe();
    setToolOrder(scope, ['chat', 'future-tool', 'tracker']);
    expect(notify).toHaveBeenCalledOnce();
  });
  it('저장소를 사용할 수 없어도 방문 중 위치를 바꾸고 구독을 정리할 수 있다', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
    });
    const store = createGameToolsLayoutStore('layout-blocked-storage', ['chat']);
    setDockState(gameToolDockId('layout-blocked-storage', 'chat'), {
      mode: 'floating',
      x: 120,
      y: 80,
    });
    expect(store.getSnapshot().docks.chat).toEqual({ mode: 'floating', x: 120, y: 80 });
  });
  it('상·하 채팅의 최소 높이는 본문과 헤더를 포함하고 짧은 창은 기존 제한을 유지한다', () => {
    expect(horizontalDockLimit('top', 220)).toBe('max(272px, min(40dvh, 300px))');
    expect(horizontalDockLimit('bottom', 220)).toBe('max(272px, min(40dvh, 300px))');
    expect(horizontalDockLimit('bottom', 0)).toBe('min(23dvh, 190px)');
  });
});
