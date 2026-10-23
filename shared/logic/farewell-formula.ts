/**
 * 이별 공식의 공용 토큰화·수식 판정기.
 *
 * 서버는 제출을 문자열로 받지 않고 삭제한 unit id 목록만 받는다. 따라서 결과 수식은
 * 항상 서버가 보유한 원문에서 만들어지고, 클라이언트가 임의 문자열을 끼워 넣을 수 없다.
 */

export type FarewellTokenKind = 'digit' | 'operator' | 'equals' | 'bracket';

export interface FarewellFormulaToken {
  index: number;
  text: string;
  /** 같은 괄호 쌍은 같은 unitId를 쓴다. 그 외 문자는 각자 하나의 unit이다. */
  unitId: number;
  kind: FarewellTokenKind;
}

export interface FarewellFormulaLayout {
  source: string;
  tokens: FarewellFormulaToken[];
  unitIds: number[];
}

export interface FarewellEquationEvaluation {
  correct: boolean;
  expression: string;
  leftValue: string | null;
  rightValue: string | null;
  reason: string;
}

export interface FarewellFormulaSolution {
  removedUnitIds: number[];
  expression: string;
}

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

type MathToken =
  | { kind: 'number'; value: bigint }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' | '^' | '√' | '!' }
  | { kind: 'open'; value: '(' | '[' }
  | { kind: 'close'; value: ')' | ']' };

const MAX_SOURCE_LENGTH = 96;
const MAX_LITERAL_DIGITS = 8;
const MAX_EXPONENT = 9n;
const MAX_FACTORIAL = 20n;
const MAX_MAGNITUDE = 10n ** 24n;

function abs(value: bigint) {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x || 1n;
}

function fraction(numerator: bigint, denominator = 1n): Fraction {
  if (denominator === 0n) throw new Error('0으로 나눌 수 없습니다.');
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  const value = {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
  if (abs(value.numerator) > MAX_MAGNITUDE || value.denominator > MAX_MAGNITUDE) {
    throw new Error('계산 결과가 너무 큽니다.');
  }
  return value;
}

function add(left: Fraction, right: Fraction) {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Fraction, right: Fraction) {
  return fraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Fraction, right: Fraction) {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Fraction, right: Fraction) {
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function powBigInt(base: bigint, exponent: bigint) {
  let result = 1n;
  let factor = base;
  let remaining = exponent;
  while (remaining > 0n) {
    if (remaining % 2n === 1n) result *= factor;
    remaining /= 2n;
    if (remaining > 0n) factor *= factor;
    if (abs(result) > MAX_MAGNITUDE || abs(factor) > MAX_MAGNITUDE) {
      throw new Error('계산 결과가 너무 큽니다.');
    }
  }
  return result;
}

function power(base: Fraction, exponent: Fraction) {
  if (exponent.denominator !== 1n || abs(exponent.numerator) > MAX_EXPONENT) {
    throw new Error('지수는 -9부터 9 사이의 정수여야 합니다.');
  }
  if (exponent.numerator === 0n) return fraction(1n);
  const negative = exponent.numerator < 0n;
  if (negative && base.numerator === 0n) throw new Error('0의 음수 지수는 계산할 수 없습니다.');
  const magnitude = abs(exponent.numerator);
  const numerator = powBigInt(base.numerator, magnitude);
  const denominator = powBigInt(base.denominator, magnitude);
  return negative ? fraction(denominator, numerator) : fraction(numerator, denominator);
}

function integerSquareRoot(value: bigint) {
  if (value < 0n) throw new Error('음수의 루트는 계산할 수 없습니다.');
  if (value < 2n) return value;
  let current = value;
  let next = (current + 1n) / 2n;
  while (next < current) {
    current = next;
    next = (current + value / current) / 2n;
  }
  return current;
}

function squareRoot(value: Fraction) {
  if (value.numerator < 0n) throw new Error('음수의 루트는 계산할 수 없습니다.');
  const numerator = integerSquareRoot(value.numerator);
  const denominator = integerSquareRoot(value.denominator);
  if (
    numerator * numerator !== value.numerator ||
    denominator * denominator !== value.denominator
  ) {
    throw new Error('루트 안은 완전제곱수여야 합니다.');
  }
  return fraction(numerator, denominator);
}

function factorial(value: Fraction) {
  if (value.denominator !== 1n || value.numerator < 0n || value.numerator > MAX_FACTORIAL) {
    throw new Error('팩토리얼은 0부터 20 사이의 정수만 계산할 수 있습니다.');
  }
  let result = 1n;
  for (let factor = 2n; factor <= value.numerator; factor++) result *= factor;
  return fraction(result);
}

function formatFraction(value: Fraction) {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator}/${value.denominator}`;
}

function normalizeEquation(input: string) {
  return input
    .replace(/\s+/g, '')
    .replace(/[xX]/g, '×')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/[−–—]/g, '-');
}

function mathTokens(input: string): MathToken[] {
  const tokens: MathToken[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index]!;
    if (/\d/.test(char)) {
      let end = index + 1;
      while (end < input.length && /\d/.test(input[end]!)) end++;
      const literal = input.slice(index, end);
      if (literal.length > MAX_LITERAL_DIGITS) throw new Error('숫자가 너무 큽니다.');
      tokens.push({ kind: 'number', value: BigInt(literal) });
      index = end;
      continue;
    }
    if (char === '+' || char === '-' || char === '^' || char === '√' || char === '!') {
      tokens.push({ kind: 'operator', value: char });
      index++;
      continue;
    }
    if (char === '×') {
      tokens.push({ kind: 'operator', value: '*' });
      index++;
      continue;
    }
    if (char === '÷') {
      tokens.push({ kind: 'operator', value: '/' });
      index++;
      continue;
    }
    if (char === '(' || char === '[') {
      tokens.push({ kind: 'open', value: char });
      index++;
      continue;
    }
    if (char === ')' || char === ']') {
      tokens.push({ kind: 'close', value: char });
      index++;
      continue;
    }
    throw new Error('숫자와 허용된 수학 기호만 남길 수 있습니다.');
  }
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: MathToken[]) {}

  parse() {
    const value = this.parseExpression();
    if (this.index !== this.tokens.length) throw new Error('숫자와 기호의 위치를 확인해 주세요.');
    return value;
  }

  private parseExpression(): Fraction {
    let left = this.parseTerm();
    while (true) {
      const token = this.tokens[this.index];
      if (token?.kind !== 'operator' || (token.value !== '+' && token.value !== '-')) break;
      this.index++;
      const right = this.parseTerm();
      left = token.value === '+' ? add(left, right) : subtract(left, right);
    }
    return left;
  }

  private parseTerm(): Fraction {
    let left = this.parseUnary();
    while (true) {
      const token = this.tokens[this.index];
      if (token?.kind !== 'operator' || (token.value !== '*' && token.value !== '/')) break;
      this.index++;
      const right = this.parseUnary();
      left = token.value === '*' ? multiply(left, right) : divide(left, right);
    }
    return left;
  }

  private parseUnary(): Fraction {
    const token = this.tokens[this.index];
    if (token?.kind === 'operator' && (token.value === '+' || token.value === '-')) {
      this.index++;
      const value = this.parseUnary();
      return token.value === '+' ? value : fraction(-value.numerator, value.denominator);
    }
    if (token?.kind === 'operator' && token.value === '√') {
      this.index++;
      return squareRoot(this.parseUnary());
    }
    return this.parsePower();
  }

  private parsePower(): Fraction {
    const base = this.parsePostfix();
    const token = this.tokens[this.index];
    if (token?.kind !== 'operator' || token.value !== '^') return base;
    this.index++;
    return power(base, this.parseUnary());
  }

  private parsePostfix(): Fraction {
    let value = this.parsePrimary();
    while (this.tokens[this.index]?.kind === 'operator' && this.tokens[this.index]?.value === '!') {
      this.index++;
      value = factorial(value);
    }
    return value;
  }

  private parsePrimary(): Fraction {
    const token = this.tokens[this.index];
    if (!token) throw new Error('수식이 완성되지 않았습니다.');
    if (token.kind === 'number') {
      this.index++;
      return fraction(token.value);
    }
    if (token.kind === 'open') {
      this.index++;
      const value = this.parseExpression();
      const closing = this.tokens[this.index];
      const expected = token.value === '(' ? ')' : ']';
      if (closing?.kind !== 'close' || closing.value !== expected) {
        throw new Error('괄호의 짝을 확인해 주세요.');
      }
      this.index++;
      return value;
    }
    throw new Error('숫자 또는 여는 괄호가 필요합니다.');
  }
}

function evaluateSide(side: string) {
  if (!side) throw new Error('등호 양쪽에 수식이 필요합니다.');
  return new Parser(mathTokens(side)).parse();
}

export function evaluateFarewellEquation(input: string): FarewellEquationEvaluation {
  const expression = normalizeEquation(input).slice(0, MAX_SOURCE_LENGTH);
  try {
    const parts = expression.split('=');
    if (parts.length !== 2) throw new Error('등호는 정확히 하나 남아야 합니다.');
    const left = evaluateSide(parts[0]!);
    const right = evaluateSide(parts[1]!);
    const leftValue = formatFraction(left);
    const rightValue = formatFraction(right);
    const correct = left.numerator * right.denominator === right.numerator * left.denominator;
    return {
      correct,
      expression,
      leftValue,
      rightValue,
      reason: correct ? '올바른 등식입니다.' : `${leftValue} ≠ ${rightValue}입니다.`,
    };
  } catch (error) {
    return {
      correct: false,
      expression,
      leftValue: null,
      rightValue: null,
      reason: error instanceof Error ? error.message : '올바른 수식이 아닙니다.',
    };
  }
}

function tokenKind(text: string): FarewellTokenKind {
  if (/\d/.test(text)) return 'digit';
  if (text === '=') return 'equals';
  if ('()[]'.includes(text)) return 'bracket';
  return 'operator';
}

/** 숫자는 한 자리씩, 일반 기호는 하나씩, 괄호는 짝 전체를 삭제 unit 하나로 만든다. */
export function tokenizeFarewellFormula(input: string): FarewellFormulaLayout {
  const source = normalizeEquation(input);
  if (!source || source.length > MAX_SOURCE_LENGTH)
    throw new Error('문제 수식의 길이가 올바르지 않습니다.');
  if (!/^[0-9+\-×÷^√!=()[\]]+$/.test(source))
    throw new Error('문제 수식에 허용되지 않은 문자가 있습니다.');

  const stack: Array<{ text: '(' | '['; index: number }> = [];
  const pairs = new Map<number, number>();
  for (let index = 0; index < source.length; index++) {
    const text = source[index]!;
    if (text === '(' || text === '[') {
      stack.push({ text, index });
      continue;
    }
    if (text !== ')' && text !== ']') continue;
    const opening = stack.pop();
    const expected = text === ')' ? '(' : '[';
    if (!opening || opening.text !== expected)
      throw new Error('문제 수식의 괄호 짝이 맞지 않습니다.');
    pairs.set(opening.index, index);
    pairs.set(index, opening.index);
  }
  if (stack.length > 0) throw new Error('문제 수식의 괄호 짝이 맞지 않습니다.');

  const unitByPosition = new Map<number, number>();
  const tokens: FarewellFormulaToken[] = [];
  let nextUnitId = 0;
  for (let index = 0; index < source.length; index++) {
    let unitId = unitByPosition.get(index);
    if (unitId == null) {
      unitId = nextUnitId++;
      unitByPosition.set(index, unitId);
      const pair = pairs.get(index);
      if (pair != null) unitByPosition.set(pair, unitId);
    }
    const text = source[index]!;
    tokens.push({ index, text, unitId, kind: tokenKind(text) });
  }
  return { source, tokens, unitIds: Array.from({ length: nextUnitId }, (_, index) => index) };
}

export function buildFarewellExpression(
  tokens: readonly FarewellFormulaToken[],
  removedUnitIds: ReadonlySet<number> | readonly number[],
) {
  const removed = removedUnitIds instanceof Set ? removedUnitIds : new Set(removedUnitIds);
  return tokens
    .filter((token) => !removed.has(token.unitId))
    .map((token) => token.text)
    .join('');
}

function* combinations(values: readonly number[], size: number): Generator<number[]> {
  const picked: number[] = [];
  function* walk(start: number): Generator<number[]> {
    if (picked.length === size) {
      yield [...picked];
      return;
    }
    const remaining = size - picked.length;
    for (let index = start; index <= values.length - remaining; index++) {
      picked.push(values[index]!);
      yield* walk(index + 1);
      picked.pop();
    }
  }
  yield* walk(0);
}

interface FarewellSearchResult {
  minimum: number | null;
  solutions: FarewellFormulaSolution[];
}

/** 한 조합씩 검증한다. 서버는 중간에 실행권을 돌려주거나 검증을 중단할 수 있다. */
export function* searchFarewellSolutions(
  input: string,
  maxDeletions = 6,
  limit = 16,
): Generator<void, FarewellSearchResult> {
  const layout = tokenizeFarewellFormula(input);
  for (let count = 0; count <= Math.min(maxDeletions, layout.unitIds.length); count++) {
    const solutions: FarewellFormulaSolution[] = [];
    for (const removedUnitIds of combinations(layout.unitIds, count)) {
      const expression = buildFarewellExpression(layout.tokens, removedUnitIds);
      if (evaluateFarewellEquation(expression).correct) {
        solutions.push({ removedUnitIds, expression });
      }
      if (solutions.length >= limit) return { minimum: count, solutions };
      yield;
    }
    if (solutions.length > 0) return { minimum: count, solutions };
  }
  return { minimum: null, solutions: [] };
}

/** 문제은행 검증과 테스트용 완전탐색. 먼저 성립하는 최소 삭제 횟수만 반환한다. */
export function findMinimumFarewellSolutions(
  input: string,
  maxDeletions = 6,
  limit = 16,
): FarewellSearchResult {
  const search = searchFarewellSolutions(input, maxDeletions, limit);
  let step = search.next();
  while (!step.done) step = search.next();
  return step.value;
}
