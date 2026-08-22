type Token =
  | { kind: 'number'; value: bigint }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' }
  | { kind: 'leftParen' }
  | { kind: 'rightParen' };

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

export interface ExpressionJudgement {
  correct: boolean;
  evaluatedValue: string | null;
  reason: string;
  normalizedExpression: string;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
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
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

function formatFraction(value: Fraction): string {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator}/${value.denominator}`;
}

export function normalizeExpression(input: string): string {
  return input
    .trim()
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ');
}

/** 판정에 실패한 입력을 결과·기록에 남길 때 수식에서 허용하는 문자만 보존한다. */
function sanitizeFailedExpression(input: string): string {
  return input
    .replace(/[^0-9+\-*\/() ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string): Token[] {
  const compact = input.replace(/\s+/g, '');
  if (!compact) throw new Error('수식을 입력해 주세요.');

  const tokens: Token[] = [];
  let index = 0;
  while (index < compact.length) {
    const char = compact[index]!;
    if (/\d/.test(char)) {
      let end = index + 1;
      while (end < compact.length && /\d/.test(compact[end]!)) end++;
      const literal = compact.slice(index, end);
      if (literal.length > 6) throw new Error('숫자가 너무 큽니다.');
      tokens.push({ kind: 'number', value: BigInt(literal) });
      index = end;
      continue;
    }
    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ kind: 'operator', value: char });
      index++;
      continue;
    }
    if (char === '(') {
      tokens.push({ kind: 'leftParen' });
      index++;
      continue;
    }
    if (char === ')') {
      tokens.push({ kind: 'rightParen' });
      index++;
      continue;
    }
    throw new Error('숫자, 사칙연산, 괄호만 사용할 수 있습니다.');
  }
  return tokens;
}

function sameNumberMultiset(tokens: Token[], presented: number[]): boolean {
  const used = tokens
    .filter((token): token is Extract<Token, { kind: 'number' }> => token.kind === 'number')
    .map((token) => token.value.toString())
    .sort();
  const expected = presented.map(String).sort();
  return used.length === expected.length && used.every((value, index) => value === expected[index]);
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Fraction {
    const value = this.parseExpression();
    if (this.index !== this.tokens.length) throw new Error('수식의 괄호나 연산자 위치를 확인해 주세요.');
    return value;
  }

  private parseExpression(): Fraction {
    let left = this.parseTerm();
    while (true) {
      const token = this.tokens[this.index];
      if (token?.kind !== 'operator' || (token.value !== '+' && token.value !== '-')) break;
      this.index++;
      const right = this.parseTerm();
      left = token.value === '+'
        ? fraction(
            left.numerator * right.denominator + right.numerator * left.denominator,
            left.denominator * right.denominator,
          )
        : fraction(
            left.numerator * right.denominator - right.numerator * left.denominator,
            left.denominator * right.denominator,
          );
    }
    return left;
  }

  private parseTerm(): Fraction {
    let left = this.parseFactor();
    while (true) {
      const token = this.tokens[this.index];
      if (token?.kind !== 'operator' || (token.value !== '*' && token.value !== '/')) break;
      this.index++;
      const right = this.parseFactor();
      left = token.value === '*'
        ? fraction(left.numerator * right.numerator, left.denominator * right.denominator)
        : fraction(left.numerator * right.denominator, left.denominator * right.numerator);
    }
    return left;
  }

  private parseFactor(): Fraction {
    const token = this.tokens[this.index];
    if (!token) throw new Error('수식이 완성되지 않았습니다.');

    if (token.kind === 'number') {
      this.index++;
      return fraction(token.value);
    }

    if (token.kind === 'leftParen') {
      this.index++;
      const value = this.parseExpression();
      if (this.tokens[this.index]?.kind !== 'rightParen') throw new Error('닫는 괄호가 필요합니다.');
      this.index++;
      return value;
    }

    throw new Error('숫자 또는 여는 괄호가 필요합니다.');
  }
}

/** eval 없이 파싱하고 BigInt 유리수로 정확히 판정한다. */
export function judgeExpression(
  input: string,
  presentedNumbers: number[],
  target: number,
): ExpressionJudgement {
  const normalizedExpression = normalizeExpression(input);
  try {
    const tokens = tokenize(normalizedExpression);
    if (!sameNumberMultiset(tokens, presentedNumbers)) {
      throw new Error('제시된 숫자를 각각 한 번씩 모두 사용해야 합니다.');
    }
    const value = new Parser(tokens).parse();
    const evaluatedValue = formatFraction(value);
    const correct = value.numerator === BigInt(target) * value.denominator;
    return {
      correct,
      evaluatedValue,
      reason: correct ? '타깃넘버를 완성했습니다!' : `계산 결과가 ${evaluatedValue}입니다.`,
      normalizedExpression,
    };
  } catch (error) {
    return {
      correct: false,
      evaluatedValue: null,
      reason: error instanceof Error ? error.message : '올바른 수식이 아닙니다.',
      normalizedExpression: sanitizeFailedExpression(normalizedExpression),
    };
  }
}
