import { describe, expect, it } from 'vitest';
import { calcCounterRankRpParts, calcRankRpParts } from '@shared/types/rank.js';

describe('calcRankRpParts 시즌3 표', () => {
  it('동티어는 ±12, 승패 동일', () => {
    const p = calcRankRpParts(3, 3);
    expect(p.winnerGain).toBe(12);
    expect(p.loserLoss).toBe(12);
  });

  it('챌린저가 골드(2단계 아래)를 이기면 8', () => {
    const p = calcRankRpParts(5, 3);
    expect(p.winnerGain).toBe(8);
    expect(p.loserLoss).toBe(8);
  });

  it('1단계 아래가 이기면 14', () => {
    const p = calcRankRpParts(2, 3);
    expect(p.winnerGain).toBe(14);
    expect(p.loserLoss).toBe(14);
  });

  it('3단계 격차는 6과 20', () => {
    expect(calcRankRpParts(5, 1).winnerGain).toBe(6);
    expect(calcRankRpParts(1, 5).winnerGain).toBe(20);
  });

  it('연승은 이 판 전 3연속부터 6, 6연속은 20', () => {
    expect(calcRankRpParts(3, 3, 2, 0).winnerGain).toBe(12);
    expect(calcRankRpParts(3, 3, 3, 0).winnerGain).toBe(18);
    expect(calcRankRpParts(3, 3, 6, 0).winnerGain).toBe(32);
  });

  it('연패 가산은 패자만', () => {
    const p = calcRankRpParts(3, 3, 0, 4);
    expect(p.winnerGain).toBe(12);
    expect(p.loserLoss).toBe(22);
  });

  it('다이아·챌린저가 하위에게 지면 기본 차감은 12가 상한', () => {
    const p = calcRankRpParts(1, 5, 0, 0, 'challenger');
    expect(p.winnerGain).toBe(20);
    expect(p.loserLoss).toBe(12);
    expect(calcRankRpParts(1, 5, 0, 3, 'diamond').loserLoss).toBe(18);
  });
});

describe('calcCounterRankRpParts', () => {
  it('동티어는 기본 12를 한 번 더해 24', () => {
    const p = calcCounterRankRpParts(3, 3);
    expect(p.winnerGain).toBe(24);
    expect(p.loserLoss).toBe(24);
  });

  it('챌린저가 8 받는 판의 카운터는 20', () => {
    const p = calcCounterRankRpParts(5, 3);
    expect(p.winnerGain).toBe(20);
    expect(p.loserLoss).toBe(20);
  });

  it('연승과 상한은 일반 점수에 12를 더한다', () => {
    expect(calcCounterRankRpParts(3, 3, 3, 0).winnerGain).toBe(30);
    const upset = calcCounterRankRpParts(1, 5, 0, 0, 'challenger');
    expect(upset.winnerGain).toBe(32);
    expect(upset.loserLoss).toBe(24);
  });
});
