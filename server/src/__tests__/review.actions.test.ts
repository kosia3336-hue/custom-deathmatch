import { describe, expect, it } from 'vitest';
import { isAbstractReviewGame, readReviewActions } from '@shared/review.js';

describe('복기 수순', () => {
  it('review 가 없으면 일반 방이다', () => {
    expect(readReviewActions(undefined)).toEqual({ ok: true, actions: null });
    expect(readReviewActions({})).toEqual({ ok: true, actions: null });
  });

  it('행동 배열만 받는다', () => {
    expect(readReviewActions({ review: { actions: [{ type: 'move' }] } })).toEqual({
      ok: true,
      actions: [{ type: 'move' }],
    });
    expect(readReviewActions({ review: { actions: 'nope' } })).toEqual({ ok: false });
    expect(readReviewActions({ review: null })).toEqual({ ok: false });
  });

  it('추상전략 네 게임만 복기한다', () => {
    expect(isAbstractReviewGame('game-002')).toBe(true);
    expect(isAbstractReviewGame('game-023')).toBe(true);
    expect(isAbstractReviewGame('game-007')).toBe(false);
  });
});
