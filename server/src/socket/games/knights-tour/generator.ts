import type { KnightTourBoard, KnightTourCell } from '@shared/types/knights-tour.js';

interface Template {
  id: string;
  size: number;
  /** 이동할 수 없는 구멍 칸의 1차원 인덱스. */
  holes: number[];
  /** COM이 따라갈 유효 경로. 모든 열린 칸을 방문할 필요는 없다. */
  path: number[];
}

/**
 * 모든 보드에 내부 구멍을 두고, 일부 보드는 나이트 이동 그래프가 여러 덩어리로
 * 나뉘도록 구성했다. 더 이상 모든 열린 칸을 잇는 완주 해답을 전제하지 않는다.
 */
const TEMPLATES: Template[] = [
  {
    id: 'center-eye-5',
    size: 5,
    holes: [6, 8, 16, 18],
    path: [4, 7, 0, 11, 20, 17, 24, 13, 2, 5, 12, 9],
  },
  {
    id: 'cross-hole-5',
    size: 5,
    holes: [7, 11, 13, 17],
    path: [6, 15, 22, 19, 8, 1, 10, 21, 18, 9, 2, 5, 16, 23, 14, 3, 12],
  },
  {
    id: 'diagonal-pits-6',
    size: 6,
    holes: [7, 14, 21, 28],
    path: [
      18, 31, 27, 35, 22, 11, 3, 16, 5, 9, 17, 4, 8, 0, 13, 24, 32, 19, 30, 26, 34, 23, 10, 2, 15,
    ],
  },
  {
    id: 'core-block-6',
    size: 6,
    holes: [14, 15, 20, 21],
    path: [28, 17, 4, 8, 0, 13, 24, 32, 19, 6, 2, 10, 23, 34, 26, 30],
  },
  {
    id: 'twin-wells-6',
    size: 6,
    holes: [8, 9, 26, 27],
    path: [
      0, 13, 24, 32, 28, 17, 4, 15, 11, 3, 7, 18, 31, 20, 12, 1, 14, 6, 2, 10, 23, 34, 21, 25, 33,
      29, 16, 5,
    ],
  },
  {
    id: 'broken-ring-6',
    size: 6,
    holes: [8, 13, 14, 21],
    path: [
      25, 12, 1, 9, 5, 16, 29, 33, 22, 35, 27, 31, 18, 7, 3, 11, 15, 4, 17, 28, 20, 24, 32, 19, 6,
      2, 10, 23, 34, 26, 30,
    ],
  },
  {
    id: 'center-moat-7',
    size: 7,
    holes: [9, 11, 15, 19, 29, 33, 37, 39],
    path: [
      46, 41, 26, 13, 4, 17, 2, 7, 22, 35, 44, 31, 40, 27, 12, 3, 8, 21, 36, 45, 30, 43, 28, 23, 14,
      1, 16, 25, 38, 47, 34,
    ],
  },
  {
    id: 'vertical-fissure-7',
    size: 7,
    holes: [10, 17, 24, 31, 38],
    path: [
      37, 42, 29, 44, 35, 22, 7, 2, 15, 0, 9, 14, 1, 16, 3, 12, 27, 40, 45, 36, 21, 8, 23, 28, 43,
      30, 25, 34, 47, 32, 41, 46, 33, 48, 39, 26, 11, 6, 19, 4, 13, 18, 5, 20,
    ],
  },
  {
    id: 'corner-island-7',
    size: 7,
    holes: [9, 15, 23, 25, 31],
    path: [
      40, 27, 12, 3, 8, 21, 36, 45, 30, 43, 28, 37, 42, 29, 14, 1, 16, 7, 22, 35, 44, 39, 48, 33,
      38, 47, 34, 19, 10, 5, 18, 13, 4, 17, 2, 11, 24,
    ],
  },
];

export interface KnightTourRoundDefinition {
  board: KnightTourBoard;
  solution: KnightTourCell[];
}

export const KNIGHT_TOUR_TEMPLATE_COUNT = TEMPLATES.length;

export function knightTourCellKey(cell: KnightTourCell) {
  return `${cell.row}:${cell.col}`;
}

export function isKnightMove(from: KnightTourCell, to: KnightTourCell) {
  const rowDistance = Math.abs(from.row - to.row);
  const colDistance = Math.abs(from.col - to.col);
  return (rowDistance === 1 && colDistance === 2) || (rowDistance === 2 && colDistance === 1);
}

/** 열린 칸 안에서 중복 없이 이어지는 유효 경로인지 확인한다. 완주는 요구하지 않는다. */
export function validateKnightTourPath(board: KnightTourBoard, path: KnightTourCell[]) {
  const cells = new Set(board.activeCells.map(knightTourCellKey));
  if (path.length === 0 || new Set(path.map(knightTourCellKey)).size !== path.length) return false;
  if (path.some((cell) => !cells.has(knightTourCellKey(cell)))) return false;
  return path.every((cell, index) => index === 0 || isKnightMove(path[index - 1], cell));
}

/** 기존 호출부 호환용 별칭. */
export const validateKnightTour = validateKnightTourPath;

function transformCell(cell: KnightTourCell, size: number, transform: number): KnightTourCell {
  let row = cell.row;
  let col = transform >= 4 ? size - 1 - cell.col : cell.col;
  for (let turn = 0; turn < transform % 4; turn += 1) [row, col] = [col, size - 1 - row];
  return { row, col };
}

function shuffled<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function dealKnightTourRounds(count: number, random: () => number = Math.random) {
  return shuffled(TEMPLATES, random)
    .slice(0, count)
    .map((template, roundIndex) => {
      const transform = Math.floor(random() * 8);
      const holes = new Set(template.holes);
      const activeCells = Array.from({ length: template.size ** 2 }, (_, index) => index)
        .filter((index) => !holes.has(index))
        .map((index) =>
          transformCell(
            { row: Math.floor(index / template.size), col: index % template.size },
            template.size,
            transform,
          ),
        )
        .sort((a, b) => a.row - b.row || a.col - b.col);
      let solution = template.path.map((index) =>
        transformCell(
          { row: Math.floor(index / template.size), col: index % template.size },
          template.size,
          transform,
        ),
      );
      if (random() < 0.5) solution = solution.reverse();
      const board: KnightTourBoard = {
        size: template.size,
        activeCells,
        shapeId: `${template.id}-${transform}-${roundIndex}`,
      };
      if (!validateKnightTourPath(board, solution))
        throw new Error(`유효하지 않은 나이트 보드 경로: ${template.id}`);
      return { board, solution };
    });
}
