import { setImmediate } from 'node:timers/promises';
import {
  buildFarewellExpression,
  evaluateFarewellEquation,
  searchFarewellSolutions,
  tokenizeFarewellFormula,
} from '@shared/logic/farewell-formula.js';
import type { FarewellFormulaDifficulty } from '@shared/types/farewell-formula.js';
import type { FarewellFormulaPuzzle } from './types.js';

export type FarewellRandomSource = () => number;
export type FarewellGoodbyeCount = 2 | 3 | 4 | 5;

const MAX_SOURCE_UNITS = 21;
const MAX_CANDIDATES = 96;
const MAX_CHECKS = 24_000;
const MAX_GENERATION_MS = 300;
const CHECKS_PER_SLICE = 128;

function integer(random: FarewellRandomSource, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(random: FarewellRandomSource, values: readonly T[]) {
  return values[integer(random, 0, values.length - 1)]!;
}

interface Expression {
  text: string;
  value: number;
}

/** 식과 값을 함께 만들어 반올림이나 eval 없이 올바른 등식을 만든다. */
function correctEquation(difficulty: FarewellFormulaDifficulty, random: FarewellRandomSource) {
  const a = integer(random, 2, 9);
  const b = integer(random, 2, 9);
  const c = integer(random, 2, 6);
  let left: Expression;
  if (difficulty === 'hard') {
    const special = integer(random, 0, 2);
    if (special === 0) {
      const base = integer(random, 2, 6);
      const exponent = integer(random, 2, 3);
      left = { text: `${base}^${exponent}`, value: base ** exponent };
    } else if (special === 1) {
      left = { text: `√${a * a}`, value: a };
    } else {
      const base = integer(random, 3, 5);
      left = { text: `${base}!`, value: base === 3 ? 6 : base === 4 ? 24 : 120 };
    }
    // 특수 기호의 단순 암기에 치우치지 않도록 일반 연산과도 조합한다.
    const mode = integer(random, 0, 4);
    if (mode === 0) left = { text: `${left.text}+${b}`, value: left.value + b };
    if (mode === 1) left = { text: `${left.text}×${c}`, value: left.value * c };
    if (mode === 2) left = { text: `(${left.text}-${b})×${c}`, value: (left.value - b) * c };
    if (mode === 3) left = { text: `${b}+${left.text}×${c}`, value: b + left.value * c };
  } else {
    left = pick(random, [
      { text: `${a}+${b}`, value: a + b },
      { text: `${a}×${b}`, value: a * b },
      { text: `${a}×${b}-${c}`, value: a * b - c },
      { text: `${a}+${b}×${c}`, value: a + b * c },
      { text: `(${a}+${b})×${c}`, value: (a + b) * c },
      { text: `${a}×(${b}+${c})`, value: a * (b + c) },
      { text: `${a * b}÷${b}+${c}`, value: a + c },
      { text: `[${a}+${b}]÷${a + b}`, value: 1 },
    ]);
  }
  if (left.value < 1 || left.value > 999) return null;

  const right = random() < 0.35 && left.value > b ? `${left.value - b}+${b}` : String(left.value);
  return random() < 0.25 ? `${right}=${left.text}` : `${left.text}=${right}`;
}

interface Character {
  text: string;
  added: boolean;
}

function inserted(text: string): Character[] {
  return [...text].map((char) => ({ text: char, added: true }));
}

/** 삽입한 문자의 위치를 추적해 원래의 올바른 등식으로 돌아갈 수 있게 한다. */
function addNoise(base: string, count: number, random: FarewellRandomSource) {
  const characters = [...base].map((text) => ({ text, added: false }));
  let remaining = count;
  while (remaining > 0) {
    const mode = integer(random, 0, remaining >= 2 ? 2 : 1);
    if (mode === 0) {
      const positions = characters.flatMap((char, index) => (/\d/.test(char.text) ? [index] : []));
      const position = pick(random, positions) + integer(random, 0, 1);
      characters.splice(position, 0, ...inserted(String(integer(random, 1, 9))));
      remaining--;
    } else if (mode === 1) {
      // 괄호 한 쌍을 추가하면 연산의 우선순위가 달라지는 문제도 만들 수 있다.
      const equals = characters.findIndex((char) => char.text === '=');
      const start = random() < 0.5 ? 0 : equals + 1;
      const end = start === 0 ? equals : characters.length;
      const side = characters
        .slice(start, end)
        .map((char) => char.text)
        .join('');
      const ranges: Array<[number, number]> = [];
      for (let from = 0; from < side.length; from++) {
        for (let to = from + 3; to <= side.length; to++) {
          const part = side.slice(from, to);
          if (!/[+\-×÷]/.test(part)) continue;
          // 괄호 짝과 부분식의 문법도 동일한 판정기로 확인한다.
          if (evaluateFarewellEquation(`${part}=${part}`).correct) ranges.push([from, to]);
        }
      }
      if (ranges.length === 0) {
        characters.splice(end, 0, ...inserted(String(integer(random, 1, 9))));
      } else {
        const [from, to] = pick(random, ranges);
        const [open, close] = random() < 0.5 ? ['(', ')'] : ['[', ']'];
        characters.splice(start + to, 0, ...inserted(close!));
        characters.splice(start + from, 0, ...inserted(open!));
      }
      remaining--;
    } else {
      const equals = characters.findIndex((char) => char.text === '=');
      const position = random() < 0.5 ? equals : characters.length;
      const op = pick(random, ['+', '-', '×', '÷']);
      characters.splice(position, 0, ...inserted(`${op}${integer(random, 2, 9)}`));
      remaining -= 2;
    }
  }
  return characters;
}

function candidatePuzzle(
  goodbyeCount: FarewellGoodbyeCount,
  difficulty: FarewellFormulaDifficulty,
  random: FarewellRandomSource,
): FarewellFormulaPuzzle | null {
  const base = correctEquation(difficulty, random);
  if (!base) return null;
  const characters = addNoise(base, goodbyeCount, random);
  const source = characters.map((char) => char.text).join('');
  const evaluation = evaluateFarewellEquation(source);
  // 문제 원본도 계산 가능한, 값이 잘못된 등식으로 한정한다.
  if (evaluation.correct || evaluation.leftValue == null || evaluation.rightValue == null)
    return null;
  let layout;
  try {
    layout = tokenizeFarewellFormula(source);
  } catch {
    return null;
  }
  if (layout.unitIds.length > MAX_SOURCE_UNITS) return null;
  const removedUnitIds = [
    ...new Set(
      layout.tokens.filter((token) => characters[token.index]!.added).map((token) => token.unitId),
    ),
  ];
  if (removedUnitIds.length !== goodbyeCount) return null;
  const expression = buildFarewellExpression(layout.tokens, removedUnitIds);
  if (expression !== base || !evaluateFarewellEquation(expression).correct) return null;
  return {
    key: source,
    source,
    tokens: layout.tokens,
    goodbyeCount,
    difficulty,
    origin: 'generated',
    solutions: [{ removedUnitIds, expression }],
  };
}

/** 검증 완료된 문제만 반환한다. 시간/검사량 한도를 넘긴 후보는 채택하지 않는다. */
export async function generateProceduralFarewellPuzzle(
  goodbyeCount: FarewellGoodbyeCount,
  difficulty: FarewellFormulaDifficulty,
  excludedKeys: ReadonlySet<string> = new Set(),
  random: FarewellRandomSource = Math.random,
): Promise<FarewellFormulaPuzzle | null> {
  const deadline = performance.now() + MAX_GENERATION_MS;
  let checks = 0;
  for (let attempt = 0; attempt < MAX_CANDIDATES; attempt++) {
    if (performance.now() >= deadline || checks >= MAX_CHECKS) return null;
    const puzzle = candidatePuzzle(goodbyeCount, difficulty, random);
    if (!puzzle || excludedKeys.has(puzzle.key)) continue;
    // 삽입한 것만 지우면 k회 정답이다. 0~k-1회 정답이 없음을 끝까지 확인해야 최소 k회다.
    const search = searchFarewellSolutions(puzzle.source, goodbyeCount - 1, 1);
    let step = search.next();
    while (!step.done) {
      checks++;
      if (checks >= MAX_CHECKS || performance.now() >= deadline) return null;
      if (checks % CHECKS_PER_SLICE === 0) await setImmediate();
      step = search.next();
    }
    if (step.value.minimum == null) return puzzle;
  }
  return null;
}
