import {
  findMinimumFarewellSolutions,
  tokenizeFarewellFormula,
} from '@shared/logic/farewell-formula.js';
import type { FarewellFormulaDifficulty } from '@shared/types/farewell-formula.js';
import type { FarewellFormulaPuzzle } from './types.js';

/**
 * 난이도별 문제 후보. 모듈을 읽을 때 완전탐색으로 실제 최소 삭제 횟수를 검증한다.
 * 출제 데이터가 수정되어 더 짧은 우회 정답이 생기면 서버가 조용히 잘못 출제하지 않는다.
 */
const PUZZLE_SPECS = [
  { source: '12+8+7=20', goodbyeCount: 2, difficulty: 'normal' },
  { source: '9×7=63+4', goodbyeCount: 2, difficulty: 'normal' },
  { source: '48÷6-5=8', goodbyeCount: 2, difficulty: 'normal' },
  { source: '438÷6=8×2', goodbyeCount: 3, difficulty: 'normal' },
  { source: '152+6+2=7×3', goodbyeCount: 3, difficulty: 'normal' },
  { source: '90÷5=132+6-2', goodbyeCount: 3, difficulty: 'normal' },
  { source: '5×5+7=100÷45', goodbyeCount: 3, difficulty: 'normal' },
  { source: '64÷82+1=9×5', goodbyeCount: 3, difficulty: 'normal' },
  { source: '6×6-5-2=31-5', goodbyeCount: 4, difficulty: 'normal' },
  { source: '9×7×6=63+4', goodbyeCount: 4, difficulty: 'normal' },
  { source: '4×(9-2)+1×2=28', goodbyeCount: 4, difficulty: 'normal' },
  { source: '11×4×2=50-6-7', goodbyeCount: 4, difficulty: 'normal' },
  { source: '(7+59)×3=2736×3', goodbyeCount: 5, difficulty: 'normal' },
  { source: '48÷6+5=86×2', goodbyeCount: 5, difficulty: 'normal' },

  { source: '2^5=32×3', goodbyeCount: 2, difficulty: 'hard' },
  { source: '√9=3+4', goodbyeCount: 2, difficulty: 'hard' },
  { source: '3!=6+4', goodbyeCount: 2, difficulty: 'hard' },
  { source: '8×98+1=2^6', goodbyeCount: 3, difficulty: 'hard' },
  { source: '3^3+5=382+4', goodbyeCount: 3, difficulty: 'hard' },
  { source: '√9=3+45', goodbyeCount: 3, difficulty: 'hard' },
  { source: '3!=6+45', goodbyeCount: 3, difficulty: 'hard' },
  { source: '3^753+5×6=32', goodbyeCount: 4, difficulty: 'hard' },
  { source: '√25=5+678', goodbyeCount: 4, difficulty: 'hard' },
  { source: '3!=6+789', goodbyeCount: 4, difficulty: 'hard' },
  { source: '2^5×44×9=32', goodbyeCount: 5, difficulty: 'hard' },
  { source: '(3+5)^2×2=644-2', goodbyeCount: 5, difficulty: 'hard' },
  { source: '√64=8+1234', goodbyeCount: 5, difficulty: 'hard' },
  { source: '4!=24+6789', goodbyeCount: 5, difficulty: 'hard' },
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
    difficulty: spec.difficulty,
    origin: 'bank',
    solutions: solved.solutions,
  };
});

export function getFarewellFormulaPuzzleBank(difficulty?: FarewellFormulaDifficulty) {
  return PUZZLE_BANK.filter((puzzle) => difficulty == null || puzzle.difficulty === difficulty).map(
    (puzzle) => ({
      ...puzzle,
      tokens: puzzle.tokens.map((token) => ({ ...token })),
      solutions: puzzle.solutions.map((solution) => ({
        removedUnitIds: [...solution.removedUnitIds],
        expression: solution.expression,
      })),
    }),
  );
}
