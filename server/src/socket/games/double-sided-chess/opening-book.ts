import type { Cell, Owner, PieceType, Position } from '@shared/types/double-sided-chess.js';
import type { AIMove } from './types.js';
import { STATS_OPENING_BOOK } from './opening-book-data.js';

/** 정석 3수(우보·동사선)는 ai-strong probeJosekiBook이 먼저 본다. 이 맵은 이탈·4~12수용. */

const PIECE_CH: Record<PieceType, string> = {
  king: 'k',
  infantry: 'i',
  gold: 'g',
  silver: 's',
  copper: 'c',
};

export function positionBookKey(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
): string {
  let s = owner === 'first' ? 'f' : 's';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = board[r][c];
      if (!cell) {
        s += '.';
        continue;
      }
      s += (cell.owner === 'first' ? 'F' : 'S') + PIECE_CH[cell.piece] + (cell.isPromoted ? 'p' : '');
    }
  }
  const hand = (side: Owner) => [...prisoners[side]].sort().join('');
  return `${s}|${hand('first')}/${hand('second')}`;
}

export function encodeBookMove(move: AIMove): string {
  if (move.type === 'move') {
    return `m${move.from.row}${move.from.col}${move.to.row}${move.to.col}`;
  }
  return `p${move.pieceType}${move.position.row}${move.position.col}`;
}

export function decodeBookMove(code: string): AIMove | null {
  const move = /^m(\d)(\d)(\d)(\d)$/.exec(code);
  if (move) {
    return {
      type: 'move',
      from: { row: Number(move[1]), col: Number(move[2]) },
      to: { row: Number(move[3]), col: Number(move[4]) },
    };
  }
  const drop = /^p(infantry|gold|silver|copper)(\d)(\d)$/.exec(code);
  if (drop) {
    return {
      type: 'place-prisoner',
      pieceType: drop[1] as PieceType,
      position: { row: Number(drop[2]), col: Number(drop[3]) },
    };
  }
  return null;
}

export function probeStatsOpeningBook(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
): AIMove | null {
  const key = positionBookKey(board, prisoners, owner);
  const code = STATS_OPENING_BOOK[key];
  if (!code) return null;
  return decodeBookMove(code);
}

export function parseKifuToken(token: string): { owner: Owner; move: AIMove } | null {
  const m = /^(first|second):(m\d{4}|p(?:infantry|gold|silver|copper)\d{2})$/.exec(token);
  if (!m) return null;
  const move = decodeBookMove(m[2]);
  if (!move) return null;
  return { owner: m[1] as Owner, move };
}
