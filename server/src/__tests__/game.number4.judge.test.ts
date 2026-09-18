import { describe, it, expect } from 'vitest';
import { judgeNumber, tiebreaker } from '../socket/games/number4/judge.js';
import type { InternalState } from '../socket/games/number4/types.js';

/** 동점 판정에 필요한 것만 채운 상태: 라운드별 넘버·백색 제출 + 잔여 백색 */
function tieState(
  p1: { numbers: number[]; whites: number[]; remainingWhite: number },
  p2: { numbers: number[]; whites: number[]; remainingWhite: number },
): InternalState {
  const roundHistory = p1.numbers.map((_, i) => ({
    round: i + 1,
    players: {
      p1: { white: p1.whites[i], black: 7 - p1.whites[i], number: p1.numbers[i] },
      p2: { white: p2.whites[i], black: 7 - p2.whites[i], number: p2.numbers[i] },
    },
  }));
  return {
    player1: { id: 'p1', remainingWhite: p1.remainingWhite },
    player2: { id: 'p2', remainingWhite: p2.remainingWhite },
    roundHistory,
  } as unknown as InternalState;
}

describe('tiebreaker - 승점 동점 (룰 I)', () => {
  it('넘버 합이 낮은 쪽이 이긴다 (잔여 백색과 무관)', () => {
    const s = tieState(
      { numbers: [4, 4, 3, 2, 1, 1], whites: [1, 1, 1, 1, 1, 1], remainingWhite: 18 },
      { numbers: [1, 1, 1, 1, 1, 1], whites: [4, 4, 4, 4, 4, 4], remainingWhite: 0 },
    );
    const tb = tiebreaker(s);
    expect(tb.winnerId).toBe('p2');
    expect(tb.reason).toContain('넘버 합 15 vs 6');
  });

  it('넘버 합이 같으면 잔여 백색 타일이 많은 쪽이 이긴다 (제보: 잔여가 많은데 짐)', () => {
    // p1 은 백색을 적게 써서 잔여 백색이 많다. 예전 코드는 '쓴 백색 합'이 많은 p2 를 이기게 했다.
    const s = tieState(
      { numbers: [2, 2, 2, 2, 2, 2], whites: [1, 2, 1, 2, 1, 2], remainingWhite: 15 },
      { numbers: [2, 2, 2, 2, 2, 2], whites: [4, 4, 4, 4, 4, 4], remainingWhite: 0 },
    );
    const tb = tiebreaker(s);
    expect(tb.winnerId).toBe('p1');
    expect(tb.reason).toContain('잔여 백색 타일 15 vs 0');
  });

  it('반대편이 잔여가 많아도 똑같이 판정한다', () => {
    const s = tieState(
      { numbers: [3, 3, 0, 0, 1, 1], whites: [5, 5, 5, 3, 3, 3], remainingWhite: 0 },
      { numbers: [1, 1, 2, 2, 1, 1], whites: [2, 2, 2, 2, 2, 2], remainingWhite: 12 },
    );
    expect(tiebreaker(s).winnerId).toBe('p2');
  });

  it('넘버 합도 잔여 백색도 같으면 무승부다 (자리 순서로 가르지 않는다)', () => {
    /*
      예전에는 여기서 선 플레이어를 이기게 했다. 룰 I 에 그런 근거가 없고
      앉은 자리만으로 승패가 갈리는 셈이라, 승자 없음으로 돌려준다.
    */
    const s = tieState(
      { numbers: [2, 2, 2, 2, 2, 2], whites: [3, 3, 3, 3, 3, 3], remainingWhite: 6 },
      { numbers: [2, 2, 2, 2, 2, 2], whites: [3, 3, 3, 3, 3, 3], remainingWhite: 6 },
    );
    const tb = tiebreaker(s);
    expect(tb.winnerId).toBeNull();
    expect(tb.reason).toContain('무승부');
  });

});

/**
 * judgeNumber(myWhite, myBlack, opWhite, opBlack, myNumber)
 *
 * 넘버별 승리 조건:
 *   0: (myBlack + opBlack) >= 11 → 성공 시 +5, 실패 시 -1
 *   1: myWhite >= opWhite         → 성공 시 +1, 실패 시 -1
 *   2: myWhite*myBlack > opWhite*opBlack → 성공 시 +2, 실패 시 -1
 *   3: myWhite >= opBlack + 2    → 성공 시 +3, 실패 시 -1
 *   4: myWhite >= opBlack * 2    → 성공 시 +4, 실패 시 -1
 */

describe('judgeNumber - 넘버 0 (흑색 합계)', () => {
  it('흑색 합계 >= 11이면 성공, +5점', () => {
    const result = judgeNumber(5, 6, 3, 5, 0);
    // myBlack=6, opBlack=5 → 합=11 ≥ 11 → 성공
    expect(result.success).toBe(true);
    expect(result.scoreChange).toBe(5);
  });

  it('흑색 합계 < 11이면 실패, -1점', () => {
    const result = judgeNumber(5, 5, 3, 5, 0);
    // myBlack=5, opBlack=5 → 합=10 < 11 → 실패
    expect(result.success).toBe(false);
    expect(result.scoreChange).toBe(-1);
  });

  it('경계값: 합 정확히 11이면 성공', () => {
    const result = judgeNumber(0, 8, 0, 3, 0);
    // 8+3=11 → 성공
    expect(result.success).toBe(true);
  });
});

describe('judgeNumber - 넘버 1 (내 백색 ≥ 상대 백색)', () => {
  it('내 백색 > 상대 백색이면 성공, +1점', () => {
    const result = judgeNumber(8, 2, 5, 3, 1);
    expect(result.success).toBe(true);
    expect(result.scoreChange).toBe(1);
  });

  it('내 백색 === 상대 백색이어도 성공 (같아도 됨)', () => {
    const result = judgeNumber(5, 2, 5, 3, 1);
    expect(result.success).toBe(true);
  });

  it('내 백색 < 상대 백색이면 실패, -1점', () => {
    const result = judgeNumber(3, 5, 7, 3, 1);
    expect(result.success).toBe(false);
    expect(result.scoreChange).toBe(-1);
  });
});

describe('judgeNumber - 넘버 2 (내 백×흑 > 상대 백×흑)', () => {
  it('내 곱 > 상대 곱이면 성공, +2점', () => {
    const result = judgeNumber(5, 4, 3, 6, 2);
    // 5*4=20 > 3*6=18 → 성공
    expect(result.success).toBe(true);
    expect(result.scoreChange).toBe(2);
  });

  it('같으면 실패 (초과가 아님)', () => {
    const result = judgeNumber(4, 3, 3, 4, 2);
    // 4*3=12, 3*4=12 → 실패
    expect(result.success).toBe(false);
  });

  it('내 곱 < 상대 곱이면 실패, -1점', () => {
    const result = judgeNumber(2, 3, 4, 5, 2);
    // 2*3=6 < 4*5=20 → 실패
    expect(result.success).toBe(false);
    expect(result.scoreChange).toBe(-1);
  });
});

describe('judgeNumber - 넘버 3 (내 백색 ≥ 상대 흑색+2)', () => {
  it('내 백색 >= 상대 흑색+2이면 성공, +3점', () => {
    const result = judgeNumber(7, 3, 4, 5, 3);
    // 7 >= 5+2=7 → 성공
    expect(result.success).toBe(true);
    expect(result.scoreChange).toBe(3);
  });

  it('경계값 미만이면 실패', () => {
    const result = judgeNumber(6, 3, 4, 5, 3);
    // 6 < 5+2=7 → 실패
    expect(result.success).toBe(false);
  });
});

describe('judgeNumber - 넘버 4 (내 백색 ≥ 상대 흑색×2)', () => {
  it('내 백색 >= 상대 흑색×2이면 성공, +4점', () => {
    const result = judgeNumber(8, 2, 3, 4, 4);
    // 8 >= 4*2=8 → 성공
    expect(result.success).toBe(true);
    expect(result.scoreChange).toBe(4);
  });

  it('내 백색 < 상대 흑색×2이면 실패, -1점', () => {
    const result = judgeNumber(7, 2, 3, 4, 4);
    // 7 < 4*2=8 → 실패
    expect(result.success).toBe(false);
    expect(result.scoreChange).toBe(-1);
  });

  it('상대 흑색이 0이면 0×2=0 이므로 항상 성공', () => {
    const result = judgeNumber(0, 5, 3, 0, 4);
    // 0 >= 0*2=0 → 성공
    expect(result.success).toBe(true);
  });
});
