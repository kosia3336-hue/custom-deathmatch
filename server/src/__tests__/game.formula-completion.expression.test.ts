import { describe, expect, it } from 'vitest';
import { judgeExpression } from '../socket/games/formula-completion/expression.js';
import { generatePuzzle } from '../socket/games/formula-completion/generator.js';

describe('수식완성N 수식 판정', () => {
  it('예시 수식 4*6+7-5를 Target 26의 정답으로 인정한다', () => {
    const result = judgeExpression('4*6+7-5', [4, 5, 6, 7], 26);
    expect(result.correct).toBe(true);
    expect(result.evaluatedValue).toBe('26');
  });

  it('곱셈·나눗셈 기호와 괄호를 지원한다', () => {
    const result = judgeExpression('(8 ÷ 4) × (7 + 3)', [8, 4, 7, 3], 20);
    expect(result.correct).toBe(true);
  });

  it('중간 계산이 분수여도 정확한 유리수로 판정한다', () => {
    const result = judgeExpression('(3 / 2) * 8 + 4', [3, 2, 8, 4], 16);
    expect(result.correct).toBe(true);
  });

  it('숫자를 빼먹거나 반복하면 오답 처리한다', () => {
    expect(judgeExpression('4*6+7', [4, 5, 6, 7], 31).correct).toBe(false);
    expect(judgeExpression('4*6+7-4', [4, 5, 6, 7], 31).correct).toBe(false);
  });

  it('숫자 이어붙이기와 0 나누기를 거부한다', () => {
    expect(judgeExpression('45+6+7', [4, 5, 6, 7], 58).correct).toBe(false);
    const dividedByZero = judgeExpression('4/(7-7)+5', [4, 5, 7, 7], 5);
    expect(dividedByZero.correct).toBe(false);
    expect(dividedByZero.reason).toContain('0으로');
  });
});

describe('수식완성N 출제기', () => {
  it.each([4, 5, 6])('N=%i 퍼즐에 검증 가능한 해답을 포함한다', (numberCount) => {
    const used = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const puzzle = generatePuzzle(numberCount, used);
      used.add(puzzle.key);
      expect(puzzle.numbers).toHaveLength(numberCount);
      expect(puzzle.target).toBeGreaterThan(0);
      expect(judgeExpression(puzzle.solution, puzzle.numbers, puzzle.target).correct).toBe(true);
    }
  });
});
