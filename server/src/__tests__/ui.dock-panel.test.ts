import { describe, expect, it, vi } from 'vitest';
import {
  clampFloating,
  getDockState,
  parseDockState,
  resolveDrop,
  setDockState,
  subscribeDockState,
} from '../../../lib/dockPanel';

describe('끌어서 옮기는 창 — 놓은 자리', () => {
  const W = 1280;
  const H = 800;

  it('가장자리 가까이 놓으면 그쪽에 붙는다', () => {
    expect(resolveDrop(20, 400, W, H)).toBe('left');
    expect(resolveDrop(1270, 400, W, H)).toBe('right');
    expect(resolveDrop(640, 30, W, H)).toBe('top');
    expect(resolveDrop(640, 780, W, H)).toBe('bottom');
  });

  it('가장자리에서 멀면 붙지 않고 그 자리에 띄운다', () => {
    expect(resolveDrop(640, 400, W, H)).toBeNull();
    expect(resolveDrop(81, 400, W, H)).toBeNull();
  });

  it('모서리 근처는 더 가까운 가장자리에 붙는다', () => {
    expect(resolveDrop(30, 20, W, H)).toBe('top');
    expect(resolveDrop(10, 60, W, H)).toBe('left');
  });
});

describe('떠 있는 창 위치', () => {
  it('화면 밖으로 나가지 않게 줄인다', () => {
    expect(clampFloating(-50, 900, 320, 440, 1280, 800)).toEqual({ x: 8, y: 352 });
    expect(clampFloating(400, 200, 320, 440, 1280, 800)).toEqual({ x: 400, y: 200 });
  });

  it('창보다 화면이 작으면 왼쪽 위에 둔다', () => {
    expect(clampFloating(100, 100, 320, 440, 300, 400)).toEqual({ x: 8, y: 8 });
  });
});

describe('기억한 자리 읽기', () => {
  it('점수·추리의 기본 위치를 독립적으로 기억하고 위치 변경을 알린다', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    try {
      const scoreId = 'test-number4-score',
        trackerId = 'test-number4-tracker';
      expect(getDockState(scoreId, { mode: 'docked', edge: 'top' })).toEqual({
        mode: 'docked',
        edge: 'top',
      });
      expect(getDockState(trackerId, { mode: 'docked', edge: 'bottom' })).toEqual({
        mode: 'docked',
        edge: 'bottom',
      });
      const notify = vi.fn();
      const unsubscribe = subscribeDockState(scoreId, notify);
      setDockState(scoreId, { mode: 'floating', x: 180, y: 120 });
      expect(notify).toHaveBeenCalledOnce();
      expect(getDockState(scoreId)).toEqual({ mode: 'floating', x: 180, y: 120 });
      expect(getDockState(trackerId)).toEqual({ mode: 'docked', edge: 'bottom' });
      expect(storage.get(`cdm-dock:${scoreId}`)).toBe('{"mode":"floating","x":180,"y":120}');
      unsubscribe();
      setDockState(scoreId, { mode: 'docked', edge: 'left' });
      expect(notify).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('붙은 자리·떠 있는 자리를 읽고, 깨진 값은 버린다', () => {
    expect(parseDockState('{"mode":"docked","edge":"left"}')).toEqual({
      mode: 'docked',
      edge: 'left',
    });
    expect(parseDockState('{"mode":"floating","x":120,"y":80}')).toEqual({
      mode: 'floating',
      x: 120,
      y: 80,
    });
    expect(parseDockState('{"mode":"docked","edge":"middle"}')).toBeNull();
    expect(parseDockState('{"mode":"floating","x":"a","y":1}')).toBeNull();
    expect(parseDockState('right')).toBeNull();
    expect(parseDockState(null)).toBeNull();
  });
});
