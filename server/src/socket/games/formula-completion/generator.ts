import { FC_MAX_TARGET, FC_MIN_TARGET } from './constants.js';
import type { FormulaPuzzle } from './types.js';

type RandomSource = () => number;
type PuzzlePattern = FormulaPuzzle['pattern'];
type Operator = '+' | '−' | '×' | '÷';

interface Fraction {
  numerator: number;
  denominator: number;
}

interface ExpressionNode {
  value: Fraction;
  expression: string;
  operators: Set<Operator>;
  rootOperator: Operator | null;
}

const PUZZLE_PATTERNS: PuzzlePattern[] = ['balanced', 'left-chain', 'right-chain'];
const OPERATOR_ROTATION: Operator[] = ['×', '−', '÷', '+'];

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function fraction(numerator: number, denominator = 1): Fraction {
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

function add(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Fraction, right: Fraction): Fraction | null {
  if (right.numerator === 0) return null;
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function isOne(value: Fraction): boolean {
  return value.numerator === value.denominator;
}

function randomInt(min: number, max: number, random: RandomSource): number {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffled<T>(values: T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function combine(left: ExpressionNode, right: ExpressionNode): ExpressionNode[] {
  const candidates: ExpressionNode[] = [];
  const create = (value: Fraction | null, operator: Operator, first = left, second = right) => {
    if (
      !value
      || value.numerator === 0
      || (operator === '×' && (isOne(first.value) || isOne(second.value)))
      || (operator === '÷' && isOne(second.value))
    ) return;
    candidates.push({
      value,
      expression: `(${first.expression} ${operator} ${second.expression})`,
      operators: new Set([...first.operators, ...second.operators, operator]),
      rootOperator: operator,
    });
  };

  create(add(left.value, right.value), '+');
  create(multiply(left.value, right.value), '×');
  create(subtract(left.value, right.value), '−');
  create(subtract(right.value, left.value), '−', right, left);
  create(divide(left.value, right.value), '÷');
  create(divide(right.value, left.value), '÷', right, left);
  return candidates;
}

function chooseCombination(
  left: ExpressionNode,
  right: ExpressionNode,
  preferredOperator: Operator,
  random: RandomSource,
): ExpressionNode {
  const candidates = combine(left, right);
  const preferred = candidates.filter((candidate) => candidate.rootOperator === preferredOperator);
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(random() * pool.length)]!;
}

function buildCandidate(
  numbers: number[],
  pattern: PuzzlePattern,
  operatorOffset: number,
  random: RandomSource,
): ExpressionNode {
  const nodes: ExpressionNode[] = shuffled(numbers, random).map((value) => ({
    value: fraction(value),
    expression: String(value),
    operators: new Set<Operator>(),
    rootOperator: null,
  }));
  let mergeIndex = 0;
  const merge = (left: ExpressionNode, right: ExpressionNode) => {
    const preferred = OPERATOR_ROTATION[(operatorOffset + mergeIndex) % OPERATOR_ROTATION.length]!;
    mergeIndex++;
    return chooseCombination(left, right, preferred, random);
  };

  if (pattern === 'left-chain') {
    return nodes.slice(1).reduce((result, node) => merge(result, node), nodes[0]!);
  }

  if (pattern === 'right-chain') {
    return nodes.slice(0, -1).reduceRight((result, node) => merge(node, result), nodes.at(-1)!);
  }

  const buildBalanced = (values: ExpressionNode[]): ExpressionNode => {
    if (values.length === 1) return values[0]!;
    const middle = Math.ceil(values.length / 2);
    return merge(buildBalanced(values.slice(0, middle)), buildBalanced(values.slice(middle)));
  };
  return buildBalanced(nodes);
}

function puzzleKey(numbers: number[], target: number): string {
  return `${[...numbers].sort((a, b) => a - b).join(',')}=>${target}`;
}

/**
 * 라운드마다 균형형·왼쪽 연쇄형·오른쪽 연쇄형을 순환한다. 분수·음수 중간값도 허용해
 * 단순 덧셈/곱셈뿐 아니라 나눗셈과 괄호를 활용하는 문제가 고르게 나오게 한다.
 */
export function generatePuzzle(
  numberCount: number,
  usedKeys: Set<string> = new Set(),
  random: RandomSource = Math.random,
): FormulaPuzzle {
  const pattern = PUZZLE_PATTERNS[usedKeys.size % PUZZLE_PATTERNS.length]!;
  for (let attempt = 0; attempt < 800; attempt++) {
    const numbers = Array.from({ length: numberCount }, () => randomInt(1, 9, random));
    const candidate = buildCandidate(numbers, pattern, attempt, random);
    if (candidate.value.denominator !== 1) continue;

    const target = candidate.value.numerator;
    const key = puzzleKey(numbers, target);
    const minimumOperatorKinds = numberCount >= 5 ? 3 : 2;
    if (
      target < FC_MIN_TARGET ||
      target > FC_MAX_TARGET ||
      numbers.includes(target) ||
      candidate.operators.size < minimumOperatorKinds ||
      usedKeys.has(key)
    )
      continue;

    return {
      numbers: shuffled(numbers, random),
      target,
      solution: candidate.expression,
      key,
      pattern,
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
    pattern,
  };
}
