import { describe, it, expect } from 'vitest';
import { evaluateHand, judgeShowdown, getDiePenalty } from '../socket/games/indian-poker/judge.js';

// DIE_PENALTY: noPair=0, double=5, straight=10, triple=10

describe('evaluateHand', () => {
  it('세 장이 모두 같으면 triple', () => {
    expect(evaluateHand(5, [5, 5])).toBe('triple');
  });

  it('플레이어 카드와 커뮤니티 카드 1번이 같으면 double', () => {
    expect(evaluateHand(3, [3, 7])).toBe('double');
  });

  it('플레이어 카드와 커뮤니티 카드 2번이 같으면 double', () => {
    expect(evaluateHand(7, [3, 7])).toBe('double');
  });

  it('세 장이 연속이면 straight', () => {
    // 1,2,3
    expect(evaluateHand(2, [1, 3])).toBe('straight');
  });

  it('정렬 후 연속이면 straight (순서 무관)', () => {
    // 7,8,9
    expect(evaluateHand(9, [7, 8])).toBe('straight');
  });

  it('triple이 straight 조건을 동시에 만족해도 triple 우선', () => {
    // 5,5,5 → triple이지만 straight가 아님 (연속이 아님)
    // 4,5,6은 triple이 아니고 straight
    expect(evaluateHand(5, [5, 5])).toBe('triple');
  });

  it('아무 족보도 없으면 noPair', () => {
    expect(evaluateHand(1, [3, 7])).toBe('noPair');
  });

  it('두 커뮤니티 카드가 같고 플레이어 카드가 다르면 noPair', () => {
    // 1, [5, 5] → 플레이어 1은 5,5와 다름. double 조건: playerCard === c1 OR c2
    // 1 !== 5 이므로 noPair
    expect(evaluateHand(1, [5, 5])).toBe('noPair');
  });
});

describe('judgeShowdown', () => {
  it('족보가 높은 플레이어가 이긴다', () => {
    const result = judgeShowdown(
      { id: 'a', card: 1, hand: 'triple' },
      { id: 'b', card: 9, hand: 'noPair' },
    );
    expect(result.winnerId).toBe('a');
    expect(result.isDraw).toBe(false);
  });

  it('족보가 같으면 카드 숫자가 높은 쪽이 이긴다', () => {
    const result = judgeShowdown(
      { id: 'a', card: 8, hand: 'double' },
      { id: 'b', card: 3, hand: 'double' },
    );
    expect(result.winnerId).toBe('a');
  });

  it('족보와 카드가 모두 같으면 무승부', () => {
    const result = judgeShowdown(
      { id: 'a', card: 5, hand: 'straight' },
      { id: 'b', card: 5, hand: 'straight' },
    );
    expect(result.isDraw).toBe(true);
    expect(result.winnerId).toBeNull();
  });

  it('straight vs double 이면 straight 승리', () => {
    const result = judgeShowdown(
      { id: 'a', card: 1, hand: 'straight' },
      { id: 'b', card: 9, hand: 'double' },
    );
    expect(result.winnerId).toBe('a');
  });

  it('족보 순서: noPair < double < straight < triple', () => {
    const hands = ['noPair', 'double', 'straight', 'triple'] as const;
    for (let i = 0; i < hands.length - 1; i++) {
      const result = judgeShowdown(
        { id: 'high', card: 1, hand: hands[i + 1] },
        { id: 'low', card: 9, hand: hands[i] },
      );
      expect(result.winnerId).toBe('high');
    }
  });
});

describe('getDiePenalty', () => {
  it('noPair는 페널티 0', () => {
    expect(getDiePenalty('noPair')).toBe(0);
  });

  it('double는 페널티 5', () => {
    expect(getDiePenalty('double')).toBe(5);
  });

  it('straight는 페널티 10', () => {
    expect(getDiePenalty('straight')).toBe(10);
  });

  it('triple은 페널티 10', () => {
    expect(getDiePenalty('triple')).toBe(10);
  });
});
