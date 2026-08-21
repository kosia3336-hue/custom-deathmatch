import type { CellType, Direction, Position } from '@shared/types/four-gravity.js';
import type { AIMove } from '../../socket/games/four-gravity/types.js';
import { cloneBoard, applyGravity, findMovedPosition, calcNeutralCandidates } from '../../socket/games/four-gravity/board.js';
import { checkWin, findExactFour } from '../../socket/games/four-gravity/win.js';
import { getCandidateCells, getValidDirections } from '../../socket/games/four-gravity/ai.js';
import { BOARD_SIZE } from '../../socket/games/four-gravity/constants.js';

export interface GravPair {
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
}

export interface AppliedMove {
  board: CellType[][];
  move: AIMove;
  win: boolean;
  suicide: boolean;
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
}

function lastFor(color: 'black' | 'white', g: GravPair): Direction | null {
  return color === 'black' ? g.lastGravityBlack : g.lastGravityWhite;
}

function emptyCells(board: CellType[][]): Position[] {
  const out: Position[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 'empty') out.push({ row: r, col: c });
    }
  }
  return out;
}

export function applyFullMove(
  board: CellType[][],
  color: 'black' | 'white',
  place: Position,
  gravity: Direction,
  neutral: Position | null,
  grav: GravPair,
): AppliedMove | null {
  if (board[place.row]?.[place.col] !== 'empty') return null;
  const myLast = lastFor(color, grav);
  if (myLast !== null && gravity === myLast) return null;

  const b1 = cloneBoard(board);
  b1[place.row][place.col] = color;
  const b2 = applyGravity(b1, gravity);
  const lastGravityBlack = color === 'black' ? gravity : grav.lastGravityBlack;
  const lastGravityWhite = color === 'white' ? gravity : grav.lastGravityWhite;

  const wr = checkWin(b2, color);
  if (wr?.winner === 'current') {
    return {
      board: b2,
      move: { place, gravity, neutral: null },
      win: true,
      suicide: false,
      lastGravityBlack,
      lastGravityWhite,
    };
  }

  const mp = gravity === 'none' ? place : findMovedPosition(place, gravity, b1, b2);
  const ncands = gravity === 'none' ? [] : calcNeutralCandidates(place, mp, b2);
  if (gravity !== 'none' && ncands.length === 0) {
    return {
      board: b2,
      move: { place, gravity, neutral: null },
      win: false,
      suicide: true,
      lastGravityBlack,
      lastGravityWhite,
    };
  }

  if (ncands.length === 0) {
    return {
      board: b2,
      move: { place, gravity, neutral: null },
      win: false,
      suicide: false,
      lastGravityBlack,
      lastGravityWhite,
    };
  }

  const npos = neutral && ncands.some((c) => c.row === neutral.row && c.col === neutral.col)
    ? neutral
    : ncands[0]!;
  const b3 = cloneBoard(b2);
  b3[npos.row][npos.col] = 'neutral';
  const nw = checkWin(b3, color);
  const neutralFour = findExactFour(b3, 'neutral') !== null;
  return {
    board: b3,
    move: { place, gravity, neutral: npos },
    win: nw?.winner === 'current' || neutralFour,
    suicide: nw?.winner === 'opponent',
    lastGravityBlack,
    lastGravityWhite,
  };
}

function candidatePlaces(board: CellType[][]): Position[] {
  const near = getCandidateCells(board).filter((c) => board[c.row][c.col] === 'empty');
  if (near.length > 0) return near;
  return emptyCells(board);
}

/** 이번 턴에 끝나는 수. 공개 판에서 즉시승. */
export function findImmediateWins(
  board: CellType[][],
  color: 'black' | 'white',
  grav: GravPair,
): AIMove[] {
  const wins: AIMove[] = [];
  const dirs = getValidDirections(lastFor(color, grav));
  for (const place of emptyCells(board)) {
    for (const gravity of dirs) {
      const b1 = cloneBoard(board);
      b1[place.row][place.col] = color;
      const b2 = applyGravity(b1, gravity);
      const wr = checkWin(b2, color);
      if (wr?.winner === 'current') {
        wins.push({ place, gravity, neutral: null });
        continue;
      }
      if (gravity === 'none') continue;
      const mp = findMovedPosition(place, gravity, b1, b2);
      const ncs = calcNeutralCandidates(place, mp, b2);
      for (const nc of ncs) {
        const b3 = cloneBoard(b2);
        b3[nc.row][nc.col] = 'neutral';
        const nw = checkWin(b3, color);
        if (nw?.winner === 'current' || findExactFour(b3, 'neutral') !== null) {
          wins.push({ place, gravity, neutral: nc });
        }
      }
    }
  }
  return wins;
}

function colorHasImmediateWin(
  board: CellType[][],
  color: 'black' | 'white',
  grav: GravPair,
): boolean {
  return findImmediateWins(board, color, grav).length > 0;
}

/**
 * 이번 수를 두면 상대가 바로 끝낼 수 있는지.
 * 둘 곳이 있어 상대 즉시승을 막는 수만 남긴다.
 */
export function findSafeMoves(
  board: CellType[][],
  color: 'black' | 'white',
  grav: GravPair,
): AIMove[] {
  const opp: 'black' | 'white' = color === 'black' ? 'white' : 'black';
  const dirs = getValidDirections(lastFor(color, grav));
  const safe: AIMove[] = [];
  const places = candidatePlaces(board);
  const scanPlaces = places.length >= 8 ? places : emptyCells(board);

  for (const place of scanPlaces) {
    for (const gravity of dirs) {
      const applied = applyFullMove(board, color, place, gravity, null, grav);
      if (!applied || applied.suicide) continue;
      if (applied.win) {
        safe.push(applied.move);
        continue;
      }
      const oppGrav: GravPair = {
        lastGravityBlack: applied.lastGravityBlack,
        lastGravityWhite: applied.lastGravityWhite,
      };
      if (!colorHasImmediateWin(applied.board, opp, oppGrav)) {
        safe.push(applied.move);
      }
    }
  }
  return safe;
}

export function findNonSuicideMoves(
  board: CellType[][],
  color: 'black' | 'white',
  grav: GravPair,
): AIMove[] {
  const dirs = getValidDirections(lastFor(color, grav));
  const out: AIMove[] = [];
  for (const place of candidatePlaces(board)) {
    for (const gravity of dirs) {
      const applied = applyFullMove(board, color, place, gravity, null, grav);
      if (!applied || applied.suicide) continue;
      out.push(applied.move);
    }
  }
  return out;
}

export function pickUniform<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]!;
}
