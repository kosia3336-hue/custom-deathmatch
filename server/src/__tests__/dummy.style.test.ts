import { describe, it, expect } from 'vitest';
import { dummyStyle, pickWeighted } from '../dummy/style.js';

describe('dummyStyle', () => {
  it('같은 id는 같은 기울기', () => {
    expect(dummyStyle('dummy')).toEqual(dummyStyle('dummy'));
  });

  it('다른 id는 기울기가 다르다', () => {
    const a = dummyStyle('jack-uuid');
    const b = dummyStyle('iron-uuid');
    expect(a.aggression === b.aggression && a.dump === b.dump).toBe(false);
  });

  it('범위 안', () => {
    for (const id of ['dummy', 'a', '캡틴영준', 'dev-dummy:1']) {
      const s = dummyStyle(id);
      expect(s.aggression).toBeGreaterThanOrEqual(-0.35);
      expect(s.aggression).toBeLessThanOrEqual(0.35);
      expect(s.dump).toBeGreaterThanOrEqual(0.2);
      expect(s.dump).toBeLessThanOrEqual(0.7);
    }
  });
});

describe('pickWeighted', () => {
  it('양수 가중만 고른다', () => {
    const got = new Set<string>();
    for (let i = 0; i < 40; i++) {
      got.add(pickWeighted([
        { item: 'a', w: 3 },
        { item: 'b', w: 1 },
        { item: 'c', w: 0 },
      ]));
    }
    expect(got.has('c')).toBe(false);
    expect(got.has('a')).toBe(true);
  });
});
