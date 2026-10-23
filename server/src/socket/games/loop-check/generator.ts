import {
  LOOP_CHECK_COLORS,
  LOOP_CHECK_SIZE,
  type LoopCheckBoard,
} from '@shared/types/loop-check.js';
import { areLoopCheckNeighbors } from '@shared/logic/loop-check.js';

function shuffle<T>(values: readonly T[], random: () => number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

export function generateLoopCheckBoard(random: () => number = Math.random): {
  board: LoopCheckBoard;
  solution: number[];
} {
  const palette = shuffle(
    LOOP_CHECK_COLORS.map((_, index) => index),
    random,
  ).slice(0, 6);
  const cells = shuffle(
    palette.flatMap((color) => Array<number>(6).fill(color)),
    random,
  );
  const solution: number[] = [];
  // 깊이 10의 단순 경로만 찾는다. 첫 해를 찾으면 종료하므로 반복 난수에도 유한하다.
  const walk = (cell: number): boolean => {
    solution.push(cell);
    if (solution.length === 10) return true;
    const neighbors = Array.from({ length: 36 }, (_, index) => index).filter(
      (index) => areLoopCheckNeighbors(cell, index) && !solution.includes(index),
    );
    for (const next of shuffle(neighbors, random)) if (walk(next)) return true;
    solution.pop();
    return false;
  };
  walk(Math.floor(random() * LOOP_CHECK_SIZE ** 2));
  // 뒤의 다섯 칸에 앞의 다섯 색을 심어 정방향·역방향 유효 해를 보장한다.
  for (let index = 0; index < solution.length; index++)
    cells[solution[index]!] = palette[index % 5]!;
  if (!cells.includes(palette[5]!))
    cells[cells.findIndex((_, index) => !solution.includes(index))] = palette[5]!;
  return { board: { cells }, solution: [...solution] };
}
