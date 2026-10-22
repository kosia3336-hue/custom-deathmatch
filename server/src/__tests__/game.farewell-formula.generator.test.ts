import { setImmediate } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import {
  buildFarewellExpression,
  evaluateFarewellEquation,
  findMinimumFarewellSolutions,
} from '@shared/logic/farewell-formula.js';
import { FAREWELL_FORMULA_DIFFICULTIES } from '@shared/types/farewell-formula.js';
import { FarewellFormulaPuzzlePool } from '../socket/games/farewell-formula/generator.js';
import { generateProceduralFarewellPuzzle } from '../socket/games/farewell-formula/procedural.js';

function seededRandom(initial: number) {
  let seed = initial;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('이별 공식 자동 출제', () => {
  it('두 난이도·모든 삭제 횟수에서 중복 없는 정답과 실제 최소 횟수를 보장한다', async () => {
    const random = seededRandom(134217);
    const keys = new Set<string>();
    const specials = new Set<string>();
    for (const difficulty of FAREWELL_FORMULA_DIFFICULTIES) {
      for (const count of [2, 3, 4, 5] as const) {
        for (let sample = 0; sample < 4; sample++) {
          const puzzle = await generateProceduralFarewellPuzzle(count, difficulty, keys, random);
          expect(puzzle, `${difficulty} ${count}회`).not.toBeNull();
          if (!puzzle) continue;
          expect(keys.has(puzzle.key)).toBe(false);
          keys.add(puzzle.key);
          expect(puzzle.origin).toBe('generated');
          const original = evaluateFarewellEquation(puzzle.source);
          expect(original.correct, puzzle.source).toBe(false);
          expect(original.leftValue, puzzle.source).not.toBeNull();
          expect(original.rightValue, puzzle.source).not.toBeNull();
          expect(findMinimumFarewellSolutions(puzzle.source, count, 1).minimum, puzzle.source).toBe(
            count,
          );
          const answer = puzzle.solutions[0]!;
          expect(answer.removedUnitIds).toHaveLength(count);
          expect(buildFarewellExpression(puzzle.tokens, answer.removedUnitIds)).toBe(
            answer.expression,
          );
          expect(evaluateFarewellEquation(answer.expression).correct, answer.expression).toBe(true);
          if (difficulty === 'normal') {
            expect(puzzle.source).not.toMatch(/(?:\^|√|!)/);
          } else {
            expect(answer.expression).toMatch(/(?:\^|√|!)/);
            for (const symbol of ['^', '√', '!']) {
              if (answer.expression.includes(symbol)) specials.add(symbol);
            }
          }
        }
      }
    }
    expect([...specials].sort()).toEqual(['!', '^', '√'].sort());
  });

  it('최소성 검증 도중 다른 이벤트가 실행될 수 있다', async () => {
    let yielded = false;
    const otherWork = setImmediate().then(() => {
      yielded = true;
    });
    const puzzle = await generateProceduralFarewellPuzzle(5, 'hard', new Set(), seededRandom(99));
    expect(puzzle).not.toBeNull();
    expect(yielded).toBe(true);
    await otherWork;
  });

  it('미리 생성한 문제로 7라운드를 진행하고, 소비 후 새 문제를 보충한다', async () => {
    const pool = new FarewellFormulaPuzzlePool(seededRandom(41239));
    // 동시에 준비 요청이 들어와도 같은 보충 작업을 공유한다.
    const ready = pool.warm();
    expect(pool.warm()).toBe(ready);
    await ready;
    const used = new Set<string>();
    for (const difficulty of FAREWELL_FORMULA_DIFFICULTIES) {
      for (let round = 1; round <= 7; round++) {
        const puzzle = pool.take(round, used, difficulty);
        expect(puzzle.origin).toBe('generated');
        expect(used.has(puzzle.key)).toBe(false);
        used.add(puzzle.key);
      }
    }
    await pool.warm();
    const next = pool.take(1, used, 'normal');
    expect(next.origin).toBe('generated');
    expect(used.has(next.key)).toBe(false);
    await pool.warm();
  });

  it('캐시 준비 전에는 반복 없는 검증 문제로 진행한다', async () => {
    const pool = new FarewellFormulaPuzzlePool(seededRandom(1919));
    const used = new Set<string>();
    for (let round = 1; round <= 7; round++) {
      const puzzle = pool.take(round, used, 'normal');
      expect(puzzle.origin).toBe('bank');
      expect(used.has(puzzle.key)).toBe(false);
      used.add(puzzle.key);
    }
    await pool.warm();
  });

  it('같은 난수만 반환해도 생성 재시도는 유한하며 검증 문제로 대체한다', async () => {
    const pool = new FarewellFormulaPuzzlePool(() => 0);
    await pool.warm();
    const first = pool.take(7, new Set(), 'normal');
    const second = pool.take(7, new Set([first.key]), 'normal');
    expect(second.origin).toBe('bank');
    expect(second.key).not.toBe(first.key);
    await pool.warm();
  });
});
