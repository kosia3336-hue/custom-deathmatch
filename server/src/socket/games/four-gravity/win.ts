import { BOARD_SIZE, DIRS_4 } from './constants.js';
import type { CellType, Position, WinResult } from './types.js';

export function findExactFour(board: CellType[][], type: CellType): Position[] | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== type) continue;

      for (const [dr, dc] of DIRS_4) {
        const pr = r - dr;
        const pc = c - dc;
        if (
          pr >= 0 && pr < BOARD_SIZE &&
          pc >= 0 && pc < BOARD_SIZE &&
          board[pr][pc] === type
        ) continue;

        const line: Position[] = [];
        let nr = r;
        let nc = c;
        while (
          nr >= 0 && nr < BOARD_SIZE &&
          nc >= 0 && nc < BOARD_SIZE &&
          board[nr][nc] === type
        ) {
          line.push({ row: nr, col: nc });
          nr += dr;
          nc += dc;
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export function checkWin(board: CellType[][], currentColor: 'black' | 'white'): WinResult | null {
  const oppColor: CellType = currentColor === 'black' ? 'white' : 'black';

  const myFour = findExactFour(board, currentColor);
  if (myFour) return { winner: 'current', type: currentColor, line: myFour };

  const neutralFour = findExactFour(board, 'neutral');
  if (neutralFour) return { winner: 'current', type: 'neutral', line: neutralFour };

  const oppFour = findExactFour(board, oppColor);
  if (oppFour) return { winner: 'opponent', type: oppColor as 'black' | 'white', line: oppFour };

  return null;
}

export function hasEmptyCells(board: CellType[][]): boolean {
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === 'empty') return true;
  return false;
}
