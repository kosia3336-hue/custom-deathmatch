import { describe, expect, it } from 'vitest';
import { createCountdownTickGate } from '../../../lib/countdownTick';

describe('마지막 5초 타이머 효과음', () => {
  it('5~1초에 한 번씩 울리고 0초에는 멈춘다', () => {
    const tick = createCountdownTickGate();
    expect(tick('a', 5.1)).toBeNull();
    for (const second of [5, 4, 3, 2, 1]) {
      expect(tick('a', second)).toBe(second);
      expect(tick('a', second - 0.1)).toBeNull();
    }
    expect(tick('a', 0)).toBeNull();
  });
  it('새 턴에서 다시 울리고 지연된 소리는 재생하지 않는다', () => {
    const tick = createCountdownTickGate();
    expect(tick('a', 5)).toBe(5);
    expect(tick('a', 1.3)).toBe(2);
    expect(tick('a', 3)).toBeNull();
    expect(tick('b', 5)).toBe(5);
    expect(tick(null, null)).toBeNull();
    expect(tick('b', NaN)).toBeNull();
  });
});
