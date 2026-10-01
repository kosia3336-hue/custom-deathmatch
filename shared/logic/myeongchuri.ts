import {
  MYEONGCHURI_DEFAULT_THINK_SECONDS,
  MYEONGCHURI_LETTERS,
  MYEONGCHURI_MAX_THINK_SECONDS,
  MYEONGCHURI_MIN_THINK_SECONDS,
  MYEONGCHURI_NUMBER_COUNT,
  MYEONGCHURI_SYMBOL_COUNT,
  MYEONGCHURI_SYMBOLS,
  type MyeongchuriGameOptions,
  type MyeongchuriHiddenReason,
  type MyeongchuriLetter,
  type MyeongchuriSymbol,
  type MyeongchuriTile,
} from '../types/myeongchuri';

/**
 * 계산 순서(높은 것부터). 같은 줄의 기호끼리는 앞에 나온 것부터 계산한다.
 * Max·Min > ^ > / > × > +·-
 */
const PRECEDENCE: readonly (readonly MyeongchuriSymbol[])[] = [
  ['Max', 'Min'],
  ['^'],
  ['/'],
  ['×'],
  ['+', '-'],
];

export type MyeongchuriEvaluation =
  | { value: string; hidden: null }
  | { value: null; hidden: MyeongchuriHiddenReason };

/** 타일을 답 문자열로 — 숫자는 '1'~'9', 기호는 그대로 */
export function myeongchuriTileToken(tile: MyeongchuriTile): string {
  return tile.kind === 'number' ? String(tile.value) : tile.value;
}

export function isMyeongchuriLetter(value: unknown): value is MyeongchuriLetter {
  return typeof value === 'string' && (MYEONGCHURI_LETTERS as readonly string[]).includes(value);
}

/** 답으로 낼 수 있는 값인지 — '1'~'9' 또는 기호 7개 중 하나 */
export function isMyeongchuriToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (/^[1-9]$/.test(value) || (MYEONGCHURI_SYMBOLS as readonly string[]).includes(value))
  );
}

function longestRun(tiles: readonly MyeongchuriTile[], kind: MyeongchuriTile['kind']) {
  let best = 0;
  let current = 0;
  for (const tile of tiles) {
    current = tile.kind === kind ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** 몫. 음수가 섞이면 내림(수식 규칙상 나눗셈 차례에는 양수만 오지만 안전하게) */
function floorDiv(a: bigint, b: bigint) {
  if (b === 0n) return 0n;
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

function apply(symbol: MyeongchuriSymbol, a: bigint, b: bigint): bigint {
  switch (symbol) {
    case 'Max':
      return a > b ? a : b;
    case 'Min':
      return a < b ? a : b;
    case '^':
      return b < 0n ? 0n : a ** b;
    case '/':
      return floorDiv(a, b);
    case '×':
      return a * b;
    case '+':
      return a + b;
    case '-':
      return a - b;
  }
}

/**
 * 4칸 수식을 계산한다.
 * - 숫자 2개가 붙으면 앞이 십의 자리, 뒤가 일의 자리. 3개 이상 붙으면 비공개.
 * - 기호 2개가 붙으면 사이에 1. 3개 이상 붙으면 비공개.
 * - 맨 앞·맨 뒤의 기호에는 바깥에 1.
 * - 결과는 정수 문자열(음수 그대로). 큰 수(9^87 등)도 정확히 내려고 BigInt 로 계산한다.
 */
export function evaluateMyeongchuri(tiles: readonly MyeongchuriTile[]): MyeongchuriEvaluation {
  if (longestRun(tiles, 'number') >= 3) return { value: null, hidden: 'numbers' };
  if (longestRun(tiles, 'symbol') >= 3) return { value: null, hidden: 'symbols' };

  const numbers: bigint[] = [];
  const symbols: MyeongchuriSymbol[] = [];
  let digits = '';
  for (const tile of tiles) {
    if (tile.kind === 'number') {
      digits += String(tile.value);
      continue;
    }
    // 기호 앞에 숫자가 없으면(맨 앞, 또는 기호끼리 붙음) 1을 넣는다
    numbers.push(digits ? BigInt(digits) : 1n);
    digits = '';
    symbols.push(tile.value);
  }
  // 맨 뒤가 기호면 1을 붙인다
  numbers.push(digits ? BigInt(digits) : 1n);

  for (const level of PRECEDENCE) {
    let index = 0;
    while (index < symbols.length) {
      if (!level.includes(symbols[index])) {
        index += 1;
        continue;
      }
      const result = apply(symbols[index], numbers[index], numbers[index + 1]);
      numbers.splice(index, 2, result);
      symbols.splice(index, 1);
    }
  }
  return { value: numbers[0].toString(), hidden: null };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 새 판 — 서로 다른 숫자 5개(1~9)와 서로 다른 기호 4개를 A~I 에 섞어 놓는다. */
export function dealMyeongchuriTiles(
  random: () => number = Math.random,
): Record<MyeongchuriLetter, MyeongchuriTile> {
  const numbers: MyeongchuriTile[] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)
    .slice(0, MYEONGCHURI_NUMBER_COUNT)
    .map((value) => ({ kind: 'number', value }));
  const symbols: MyeongchuriTile[] = shuffle(MYEONGCHURI_SYMBOLS, random)
    .slice(0, MYEONGCHURI_SYMBOL_COUNT)
    .map((value) => ({ kind: 'symbol', value }));
  const tiles = shuffle([...numbers, ...symbols], random);
  return Object.fromEntries(MYEONGCHURI_LETTERS.map((letter, i) => [letter, tiles[i]])) as Record<
    MyeongchuriLetter,
    MyeongchuriTile
  >;
}

/** 시간이 다 됐을 때 — 이번 수식에 아직 없는 알파벳에서 무작위로 고른다. */
export function randomMyeongchuriLetters(
  taken: readonly MyeongchuriLetter[],
  count: number,
  random: () => number = Math.random,
): MyeongchuriLetter[] {
  return shuffle(
    MYEONGCHURI_LETTERS.filter((letter) => !taken.includes(letter)),
    random,
  ).slice(0, count);
}

/** 명추리 답 — 9칸 모두 맞아야 성공 */
export function checkMyeongchuriAnswer(
  tiles: Record<MyeongchuriLetter, MyeongchuriTile>,
  answer: Record<string, unknown>,
): boolean {
  return MYEONGCHURI_LETTERS.every((letter) => answer[letter] === myeongchuriTileToken(tiles[letter]));
}

/** 방 설정(gameOptions) → 생각 시간. 기본 켜짐·2분. */
export function resolveMyeongchuriOptions(
  gameOptions?: Record<string, unknown> | null,
): MyeongchuriGameOptions {
  const raw = gameOptions?.thinkSeconds;
  const thinkSeconds =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(MYEONGCHURI_MAX_THINK_SECONDS, Math.max(MYEONGCHURI_MIN_THINK_SECONDS, Math.round(raw)))
      : MYEONGCHURI_DEFAULT_THINK_SECONDS;
  return { thinkEnabled: gameOptions?.thinkEnabled !== false, thinkSeconds };
}
