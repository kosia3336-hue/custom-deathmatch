import { describe, it, expect } from 'vitest';
import { judgeNumber } from '../socket/games/number4/judge.js';

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
