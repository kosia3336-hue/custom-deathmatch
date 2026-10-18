import {
  findMinimumFarewellSolutions,
  tokenizeFarewellFormula,
} from '@shared/logic/farewell-formula.js';
import type { FarewellFormulaPuzzle } from './types.js';

type RandomSource = () => number;

/**
 * 난이도별 문제 후보. 모듈을 읽을 때 완전탐색으로 실제 최소 삭제 횟수를 검증한다.
 * 출제 데이터가 수정되어 더 짧은 우회 정답이 생기면 서버가 조용히 잘못 출제하지 않는다.
 */
const PUZZLE_SPECS = [
  { source: '2×(3+4)=10', goodbyeCount: 1 },
  { source: '(2+3)^2=11', goodbyeCount: 1 },
  { source: '6×(4-1)=23', goodbyeCount: 1 },
  { source: '[9-3]×2=3', goodbyeCount: 1 },

  { source: '12+8+7=20', goodbyeCount: 2 },
  { source: '9×7=63+4', goodbyeCount: 2 },
  { source: '48÷6-5=8', goodbyeCount: 2 },
  { source: '2^5=32×3', goodbyeCount: 2 },

  { source: '438÷6=8×2', goodbyeCount: 3 },
  { source: '8×98+1=2^6', goodbyeCount: 3 },
  { source: '152+6+2=7×3', goodbyeCount: 3 },
  { source: '90÷5=132+6-2', goodbyeCount: 3 },
  { source: '5×5+7=100÷45', goodbyeCount: 3 },
  { source: '64÷82+1=9×5', goodbyeCount: 3 },
  { source: '3^3+5=382+4', goodbyeCount: 3 },

  { source: '6×6-5-2=31-5', goodbyeCount: 4 },
  { source: '3^753+5×6=32', goodbyeCount: 4 },
  { source: '9×7×6=63+4', goodbyeCount: 4 },
  { source: '4×(9-2)+1×2=28', goodbyeCount: 4 },
  { source: '11×4×2=50-6-7', goodbyeCount: 4 },

  { source: '2^5×44×9=32', goodbyeCount: 5 },
  { source: '(3+5)^2×2=644-2', goodbyeCount: 5 },
  { source: '(7+59)×3=2736×3', goodbyeCount: 5 },
  { source: '48÷6+5=86×2', goodbyeCount: 5 },
] as const;

const PUZZLE_BANK: FarewellFormulaPuzzle[] = PUZZLE_SPECS.map((spec) => {
  const layout = tokenizeFarewellFormula(spec.source);
  const solved = findMinimumFarewellSolutions(spec.source, spec.goodbyeCount, 16);
  if (solved.minimum !== spec.goodbyeCount || solved.solutions.length === 0) {
    throw new Error(
      `[이별 공식] 문제 검증 실패: ${spec.source} (예상 ${spec.goodbyeCount}, 실제 ${solved.minimum})`,
    );
  }
  return {
    key: spec.source,
    source: layout.source,
    tokens: layout.tokens,
    goodbyeCount: spec.goodbyeCount,
    solutions: solved.solutions,
  };
});

const ROUND_DIFFICULTY = [1, 2, 2, 3, 3, 4, 5] as const;

function shuffled<T>(values: readonly T[], random: RandomSource) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

export function generateFarewellFormulaPuzzle(
  round: number,
  usedKeys: ReadonlySet<string> = new Set(),
  random: RandomSource = Math.random,
): FarewellFormulaPuzzle {
  const goodbyeCount =
    ROUND_DIFFICULTY[Math.max(0, Math.min(ROUND_DIFFICULTY.length - 1, round - 1))]!;
  const pool = shuffled(
    PUZZLE_BANK.filter((puzzle) => puzzle.goodbyeCount === goodbyeCount),
    random,
  );
  const selected = pool.find((puzzle) => !usedKeys.has(puzzle.key)) ?? pool[0];
  if (!selected) throw new Error(`[이별 공식] ${goodbyeCount}회 문제 후보가 없습니다.`);
  return {
    ...selected,
    tokens: selected.tokens.map((token) => ({ ...token })),
    solutions: selected.solutions.map((solution) => ({
      removedUnitIds: [...solution.removedUnitIds],
      expression: solution.expression,
    })),
  };
}

export function getFarewellFormulaPuzzleBank() {
  return PUZZLE_BANK.map((puzzle) => ({
    ...puzzle,
    tokens: puzzle.tokens.map((token) => ({ ...token })),
    solutions: puzzle.solutions.map((solution) => ({
      removedUnitIds: [...solution.removedUnitIds],
      expression: solution.expression,
    })),
  }));
}
