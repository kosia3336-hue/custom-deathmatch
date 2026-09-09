import { describe, expect, it } from 'vitest';
import { calcCounterRankRpParts, calcRankRpParts } from '@shared/types/rank.js';

describe('calcRankRpParts 시즌1 기본 표', () => {
  it('동티어는 ±20, 승패 동일', () => {
    const p = calcRankRpParts(3, 3);
    expect(p.winnerGain).toBe(20);
    expect(p.loserLoss).toBe(20);
  });

  it('1단계 위가 이기면 17', () => {
    const p = calcRankRpParts(3, 2);
    expect(p.winnerGain).toBe(17);
    expect(p.loserLoss).toBe(17);
  });

  it('1단계 아래가 이기면 23', () => {
    const p = calcRankRpParts(2, 3);
    expect(p.winnerGain).toBe(23);
    expect(p.loserLoss).toBe(23);
  });

  it('3단계 격차 클램프', () => {
    const up = calcRankRpParts(5, 1);
    expect(up.winnerGain).toBe(11);
    const down = calcRankRpParts(1, 5);
    expect(down.winnerGain).toBe(29);
  });
});

describe('calcCounterRankRpParts 카운터 매치', () => {
  it('동티어는 ±30, 승패 동일', () => {
    const p = calcCounterRankRpParts(3, 3);
    expect(p.winnerGain).toBe(30);
    expect(p.loserLoss).toBe(30);
  });

  it('브론즈가 챌린저를 이기면 39', () => {
    const p = calcCounterRankRpParts(1, 5);
    expect(p.winnerGain).toBe(39);
    expect(p.loserLoss).toBe(39);
  });

  it('챌린저가 브론즈를 이기면 21', () => {
    const p = calcCounterRankRpParts(5, 1);
    expect(p.winnerGain).toBe(21);
    expect(p.loserLoss).toBe(21);
  });
});
