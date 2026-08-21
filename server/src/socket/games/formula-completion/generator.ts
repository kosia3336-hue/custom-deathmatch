import { FC_MAX_TARGET, FC_MIN_TARGET } from './constants.js';
import type { FormulaPuzzle } from './types.js';

interface ExpressionNode {
  value: number;
  expression: string;
  operators: Set<string>;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function combine(left: ExpressionNode, right: ExpressionNode): ExpressionNode[] {
  const create = (value: number, operator: string, a = left, b = right): ExpressionNode => ({
    value,
    expression: `(${a.expression} ${operator} ${b.expression})`,
    operators: new Set([...a.operators, ...b.operators, operator]),
  });

  const candidates: ExpressionNode[] = [
    create(left.value + right.value, '+'),
  ];

  if (left.value * right.value <= FC_MAX_TARGET * 4) {
    candidates.push(create(left.value * right.value, '×'));
  }
  if (left.value > right.value) candidates.push(create(left.value - right.value, '−'));
  if (right.value > left.value) candidates.push(create(right.value - left.value, '−', right, left));
  if (right.value !== 0 && left.value % right.value === 0) {
    candidates.push(create(left.value / right.value, '÷'));
  }
  if (left.value !== 0 && right.value % left.value === 0) {
    candidates.push(create(right.value / left.value, '÷', right, left));
  }

  return shuffled(candidates);
}

function buildCandidate(numbers: number[]): ExpressionNode {
  const nodes: ExpressionNode[] = shuffled(numbers).map((value) => ({
    value,
    expression: String(value),
    operators: new Set<string>(),
  }));

  while (nodes.length > 1) {
    const leftIndex = Math.floor(Math.random() * nodes.length);
    const [left] = nodes.splice(leftIndex, 1);
    const rightIndex = Math.floor(Math.random() * nodes.length);
    const [right] = nodes.splice(rightIndex, 1);
    nodes.push(combine(left!, right!)[0]!);
  }
  return nodes[0]!;
}

function puzzleKey(numbers: number[], target: number): string {
  return `${[...numbers].sort((a, b) => a - b).join(',')}=>${target}`;
}

/** 모든 숫자를 사용해 만든 해답에서 타깃을 역산하므로 항상 적어도 한 해답이 존재한다. */
export function generatePuzzle(numberCount: number, usedKeys: Set<string> = new Set()): FormulaPuzzle {
  for (let attempt = 0; attempt < 800; attempt++) {
    const numbers = Array.from({ length: numberCount }, () => randomInt(1, 9));
    const candidate = buildCandidate(numbers);
    const key = puzzleKey(numbers, candidate.value);
    const diverseEnough = numberCount < 4 || candidate.operators.size >= 2;
    if (
      candidate.value < FC_MIN_TARGET
      || candidate.value > FC_MAX_TARGET
      || numbers.includes(candidate.value)
      || !diverseEnough
      || usedKeys.has(key)
    ) continue;

    return {
      numbers: shuffled(numbers),
      target: candidate.value,
      solution: candidate.expression,
      key,
    };
  }

  // 극단적으로 난수가 계속 조건을 못 맞춘 경우에도 게임 시작은 보장한다.
  const numbers = Array.from({ length: numberCount }, (_, index) => index + 2);
  const target = numbers.reduce((sum, value) => sum + value, 0);
  return {
    numbers,
    target,
    solution: numbers.join(' + '),
    key: puzzleKey(numbers, target),
  };
}
