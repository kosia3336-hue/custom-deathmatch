import type { KnightTourBoard, KnightTourCell } from '@shared/types/knights-tour.js';

interface Template {
  id: string;
  size: number;
  path: number[];
}

const TEMPLATES: Template[] = [
  {
    id: 'full-5',
    size: 5,
    path: [
      0, 7, 4, 13, 24, 17, 20, 11, 2, 5, 16, 23, 14, 3, 6, 15, 22, 19, 8, 1, 10, 21, 12, 9, 18,
    ],
  },
  {
    id: 'notch-5',
    size: 5,
    path: [0, 7, 18, 21, 10, 1, 8, 11, 2, 5, 16, 23, 12, 19, 22, 13, 24, 17, 6, 3, 14],
  },
  {
    id: 'corners-5',
    size: 5,
    path: [1, 8, 19, 22, 15, 6, 3, 14, 17, 20, 11, 2, 5, 12, 9, 18, 21, 10, 7, 4, 13, 16, 23],
  },
  {
    id: 'full-6',
    size: 6,
    path: [
      0, 8, 4, 17, 28, 32, 24, 13, 2, 6, 19, 30, 26, 34, 21, 10, 23, 15, 11, 3, 7, 18, 31, 27, 35,
      22, 14, 1, 9, 5, 16, 29, 33, 20, 12, 25,
    ],
  },
  {
    id: 'corners-6',
    size: 6,
    path: [
      1, 12, 25, 33, 29, 16, 3, 11, 22, 9, 17, 4, 8, 19, 6, 2, 10, 14, 27, 23, 34, 21, 13, 24, 32,
      28, 15, 26, 18, 7, 20, 31,
    ],
  },
  {
    id: 'edge-mids-6',
    size: 6,
    path: [
      0, 13, 24, 20, 7, 18, 31, 27, 35, 22, 11, 15, 28, 17, 4, 8, 12, 1, 9, 5, 16, 29, 21, 25, 14,
      6, 19, 30, 26, 34, 23, 10,
    ],
  },
  {
    id: 'cross-6',
    size: 6,
    path: [
      2, 6, 19, 8, 12, 25, 33, 29, 16, 27, 23, 10, 14, 3, 11, 22, 9, 17, 21, 13, 24, 32, 28, 20, 7,
      15, 26, 18,
    ],
  },
  {
    id: 'corner-cut-7',
    size: 7,
    path: [
      2, 15, 28, 43, 38, 47, 34, 19, 6, 11, 20, 5, 10, 23, 14, 9, 4, 13, 18, 3, 12, 27, 40, 25, 16,
      21, 36, 45, 30, 35, 22, 17, 32, 41, 26, 31, 44, 29, 42, 37, 46, 33, 24, 39, 48,
    ],
  },
  {
    id: 'double-cut-7',
    size: 7,
    path: [
      2, 15, 28, 43, 38, 33, 46, 37, 42, 29, 14, 9, 4, 13, 26, 11, 6, 19, 24, 39, 34, 25, 20, 5, 10,
      23, 18, 3, 12, 27, 32, 17, 22, 35, 44, 31, 16, 21, 30, 45, 36,
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

export function validateKnightTour(board: KnightTourBoard, path: KnightTourCell[]) {
  const cells = new Set(board.activeCells.map(knightTourCellKey));
  if (path.length !== cells.size || new Set(path.map(knightTourCellKey)).size !== cells.size)
    return false;
  if (path.some((cell) => !cells.has(knightTourCellKey(cell)))) return false;
  return path.every((cell, index) => index === 0 || isKnightMove(path[index - 1], cell));
}

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
        activeCells: solution
          .map((cell) => ({ ...cell }))
          .sort((a, b) => a.row - b.row || a.col - b.col),
        shapeId: `${template.id}-${transform}-${roundIndex}`,
      };
      if (!validateKnightTour(board, solution))
        throw new Error(`유효하지 않은 나이트 보드: ${template.id}`);
      return { board, solution };
    });
}
