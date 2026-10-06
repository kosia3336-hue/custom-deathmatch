import { describe, expect, it, vi } from 'vitest';
import {
  getToolOrder,
  moveToolBefore,
  orderedToolIds,
  parseToolOrder,
  setToolOrder,
  subscribeToolOrder,
} from '../../../lib/gameToolOrder';

describe('편의기능 순서 변경', () => {
  const defaults = ['score', 'tracker', 'chat'];
  it('같은 영역의 창 앞과 뒤로 옮기되 다른 창 순서는 유지한다', () => {
    expect(moveToolBefore(defaults, 'chat', 'score')).toEqual(['chat', 'score', 'tracker']);
    expect(moveToolBefore(defaults, 'score')).toEqual(['tracker', 'chat', 'score']);
    expect(moveToolBefore(defaults, 'score', 'score')).toEqual(defaults);
    expect(moveToolBefore(defaults, 'missing', 'chat')).toEqual(defaults);
    expect(moveToolBefore(defaults, 'score', 'missing')).toEqual(defaults);
    expect(defaults).toEqual(['score', 'tracker', 'chat']);
  });
  it('새 창 등록과 임시 해제 후에도 저장된 순서를 복원한다', () => {
    const saved = ['chat', 'score', 'tracker'];
    expect(orderedToolIds(saved, ['score', 'chat'])).toEqual(['chat', 'score']);
    expect(orderedToolIds(saved, [...defaults, 'reference'])).toEqual([...saved, 'reference']);
    expect(orderedToolIds([], defaults)).toEqual(defaults);
  });
  it('깨진 저장값과 중복·잘못된 id를 제거한다', () => {
    expect(parseToolOrder('broken')).toEqual([]);
    expect(parseToolOrder('{"score":1}')).toEqual([]);
    expect(parseToolOrder('["chat",null,"score","chat",3,""]')).toEqual(['chat', 'score']);
  });
  it('게임별 저장·알림·기본 순서 복원을 분리한다', () => {
    const storage = new Map<string, string>([
      ['cdm-game-tools-order:v2:restore-test', '["chat","score"]'],
    ]);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    try {
      expect(getToolOrder('restore-test')).toEqual(['chat', 'score']);
      const notify = vi.fn();
      const unsubscribe = subscribeToolOrder('order-test', notify);
      setToolOrder('order-test', ['chat', 'tracker', 'score']);
      expect(notify).toHaveBeenCalledOnce();
      expect(getToolOrder('order-test')).toEqual(['chat', 'tracker', 'score']);
      expect(getToolOrder('other-game-test')).toEqual([]);
      expect(storage.get('cdm-game-tools-order:v2:order-test')).toBe('["chat","tracker","score"]');
      setToolOrder('order-test', []);
      expect(orderedToolIds(getToolOrder('order-test'), defaults)).toEqual(defaults);
      unsubscribe();
      setToolOrder('order-test', ['score']);
      expect(notify).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
