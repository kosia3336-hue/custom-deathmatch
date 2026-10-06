import { describe, expect, it } from 'vitest';
import { getToolInsertion } from '../../../lib/gameToolDrop';

describe('편의기능 드롭 안내선', () => {
  const region = { left: 900, right: 1200, top: 100, bottom: 700 };
  const items = [
    { id: 'score', rect: { left: 900, right: 1180, top: 100, bottom: 300 } },
    { id: 'chat', rect: { left: 900, right: 1180, top: 308, bottom: 600 } },
  ];
  it('창의 앞·중간·뒤 순서와 같은 위치에 가로 안내선을 표시한다', () => {
    const first = getToolInsertion('right', 1000, 140, region, items)!;
    expect(first.beforeId).toBe('score');
    expect(first.guide).toEqual({ left: 908, top: 102, width: 284, height: 3 });
    const middle = getToolInsertion('left', 1000, 350, region, items)!;
    expect(middle.beforeId).toBe('chat');
    expect(middle.guide.top).toBe(302.5);
    const last = getToolInsertion('right', 1000, 550, region, items)!;
    expect(last.beforeId).toBeUndefined();
    expect(last.guide.top).toBe(602.5);
  });
  it('상·하 영역은 가로 순서에 따라 세로 안내선을 표시한다', () => {
    const area = { left: 100, right: 1000, top: 100, bottom: 300 };
    const row = [
      { id: 'score', rect: { left: 100, right: 480, top: 100, bottom: 300 } },
      { id: 'chat', rect: { left: 488, right: 868, top: 100, bottom: 300 } },
    ];
    const between = getToolInsertion('top', 500, 200, area, row)!;
    expect(between.beforeId).toBe('chat');
    expect(between.guide).toEqual({ left: 482.5, top: 108, width: 3, height: 184 });
    const end = getToolInsertion('bottom', 900, 200, area, row)!;
    expect(end.beforeId).toBeUndefined();
    expect(end.guide.left).toBe(870.5);
  });
  it('스크롤 밖의 창을 향해도 선은 보이는 영역 안에 유지한다', () => {
    const scrolled = [{ id: 'chat', rect: { ...items[1].rect, top: 800, bottom: 1000 } }];
    const insertion = getToolInsertion('right', 1000, 650, region, scrolled)!;
    expect(insertion.beforeId).toBe('chat');
    expect(insertion.guide.top + insertion.guide.height).toBeLessThanOrEqual(region.bottom);
    expect(getToolInsertion('right', 1000, 200, region, [])).toBeNull();
  });
});
