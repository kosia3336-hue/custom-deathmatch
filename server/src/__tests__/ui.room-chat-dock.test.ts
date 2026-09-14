import { describe, expect, it } from 'vitest';
import { nearestDockEdge } from '../../../lib/roomChatDock';

describe('대기실 채팅창 끌어 붙이기 — 가장 가까운 가장자리', () => {
  const W = 1280;
  const H = 800;

  it('가장자리 근처에 놓으면 그쪽에 붙는다', () => {
    expect(nearestDockEdge(20, 400, W, H)).toBe('left');
    expect(nearestDockEdge(1260, 400, W, H)).toBe('right');
    expect(nearestDockEdge(640, 20, W, H)).toBe('top');
    expect(nearestDockEdge(640, 780, W, H)).toBe('bottom');
  });

  it('가로·세로 비율로 비교해 넓은 화면에서도 위·아래에 붙일 수 있다', () => {
    // 픽셀 거리로는 왼쪽(300)이 위(200)보다 멀지만, 비율로는 위(0.25)가 왼쪽(0.23)보다 멀어 왼쪽
    expect(nearestDockEdge(300, 200, W, H)).toBe('left');
    // 가운데 조금 위 — 비율상 위가 가장 가깝다
    expect(nearestDockEdge(640, 300, W, H)).toBe('top');
  });

  it('크기가 0이어도 오류 없이 고른다', () => {
    expect(nearestDockEdge(0, 0, 0, 0)).toBe('left');
  });
});
