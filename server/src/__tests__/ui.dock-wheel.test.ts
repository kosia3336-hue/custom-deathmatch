import { describe, expect, it } from 'vitest';
import { shouldRevealDock } from '../../../lib/dockWheel';

describe('잘린 도킹 창의 세로 스크롤 우선순위', () => {
  const viewport = { top: 90, bottom: 600, scrollTop: 0, maxScroll: 400 };
  it('하단 전송 영역이 화면 밖이면 가로 이동 대신 전체 화면을 아래로 스크롤한다', () => {
    expect(shouldRevealDock(80, { top: 450, bottom: 850 }, viewport)).toBe(true);
    expect(shouldRevealDock(-80, { top: 450, bottom: 850 }, viewport)).toBe(false);
  });
  it('위쪽으로 잘린 창은 위로 스크롤할 때만 복원한다', () => {
    const scrolled = { ...viewport, scrollTop: 200 };
    expect(shouldRevealDock(-80, { top: -50, bottom: 250 }, scrolled)).toBe(true);
    expect(shouldRevealDock(80, { top: -50, bottom: 250 }, scrolled)).toBe(false);
  });
  it('창 전체가 보이거나 전체 스크롤 끝이면 기존 가로 이동을 허용한다', () => {
    expect(shouldRevealDock(80, { top: 100, bottom: 500 }, viewport)).toBe(false);
    expect(shouldRevealDock(80, { top: 450, bottom: 850 }, { ...viewport, scrollTop: 400 })).toBe(
      false,
    );
    expect(shouldRevealDock(0, { top: 450, bottom: 850 }, viewport)).toBe(false);
  });
});
