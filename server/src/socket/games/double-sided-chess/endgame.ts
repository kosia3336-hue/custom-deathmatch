import { DSC_BOARD_SIZE } from '@shared/types/double-sided-chess.js';
import type { Cell, Owner, PieceType } from '@shared/types/double-sided-chess.js';
import { nextIsPromoted } from '@shared/logic/double-sided-chess.js';
import { isKingInOpponentTerritory, countNonKingPieces, hasAnyValidAction } from './board.js';
import { generateAllMoves } from './ai.js';
import type { AIMove } from './types.js';

const ENDGAME_PIECE_LIMIT = 4;
const NODE_CAP = 400_000;
const MAX_PLY = 32;

interface Undo {
  move: AIMove;
  owner: Owner;
  fromCell: NonNullable<Cell> | null;
  captured: Cell;
  pushedPrisoner: boolean;
  dropIdx: number;
}

interface SolveHit {
  wdl: -1 | 0 | 1;
  dtm: number;
  move: AIMove | null;
}

const cache = new Map<string, SolveHit>();
let nodes = 0;
let aborted = false;

function opp(owner: Owner): Owner {
  return owner === 'first' ? 'second' : 'first';
}

export function endgameMaterialCount(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
): number {
  let n = prisoners.first.length + prisoners.second.length;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      if (board[r][c]) n++;
    }
  }
  return n;
}

function encode(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  stm: Owner,
): string {
  let s = stm === 'first' ? 'f' : 's';
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) {
        s += '.';
        continue;
      }
      const p =
        cell.piece === 'king' ? 'k'
        : cell.piece === 'infantry' ? 'i'
        : cell.piece === 'gold' ? 'g'
        : cell.piece === 'silver' ? 's'
        : 'c';
      s += (cell.owner === 'first' ? 'F' : 'S') + p + (cell.isPromoted ? 'p' : '');
    }
  }
  const hand = (side: Owner) => [...prisoners[side]].sort().join('');
  return `${s}|${hand('first')}/${hand('second')}`;
}

function makeMove(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  move: AIMove,
  owner: Owner,
): Undo {
  if (move.type === 'move') {
    const fromCell = board[move.from.row][move.from.col]!;
    const target = board[move.to.row][move.to.col];
    let pushed = false;
    if (target && target.owner !== owner && target.piece !== 'king') {
      prisoners[owner].push(target.piece);
      pushed = true;
    }
    board[move.to.row][move.to.col] = {
      piece: fromCell.piece,
      owner: fromCell.owner,
      isPromoted: nextIsPromoted(fromCell.piece, fromCell.isPromoted),
    };
    board[move.from.row][move.from.col] = null;
    return { move, owner, fromCell, captured: target, pushedPrisoner: pushed, dropIdx: -1 };
  }
  const idx = prisoners[owner].indexOf(move.pieceType);
  if (idx !== -1) prisoners[owner].splice(idx, 1);
  board[move.position.row][move.position.col] = {
    piece: move.pieceType,
    owner,
    isPromoted: false,
  };
  return { move, owner, fromCell: null, captured: null, pushedPrisoner: false, dropIdx: idx };
}

function unmakeMove(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  undo: Undo,
): void {
  const { move, owner } = undo;
  if (move.type === 'move') {
    board[move.from.row][move.from.col] = undo.fromCell;
    board[move.to.row][move.to.col] = undo.captured;
    if (undo.pushedPrisoner) prisoners[owner].pop();
    return;
  }
  board[move.position.row][move.position.col] = null;
  if (undo.dropIdx >= 0) prisoners[owner].splice(undo.dropIdx, 0, move.pieceType);
}

function capturedType(undo: Undo): PieceType | null {
  if (undo.move.type !== 'move' || !undo.captured) return null;
  return undo.captured.piece;
}

function capturePriority(board: Cell[][], move: AIMove): number {
  if (move.type !== 'move') return 0;
  const target = board[move.to.row][move.to.col];
  if (!target) return 0;
  return target.piece === 'king' ? 2 : 1;
}

function orderedMoves(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  stm: Owner,
): AIMove[] {
  const moves = generateAllMoves(board, prisoners, stm);
  moves.sort((a, b) => capturePriority(board, b) - capturePriority(board, a));
  return moves;
}

function isWinAfterMove(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  mover: Owner,
  captured: PieceType | null,
): boolean {
  if (captured === 'king') return true;
  if (isKingInOpponentTerritory(board, mover)) return true;
  const opponent = opp(mover);
  if (countNonKingPieces(board, opponent) === 0 && prisoners[opponent].length === 0) return true;
  if (!hasAnyValidAction(board, prisoners[opponent], opponent)) return true;
  return false;
}

function solve(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  stm: Owner,
  stack: Set<string>,
  ply: number,
): SolveHit {
  nodes++;
  if (nodes > NODE_CAP || ply > MAX_PLY) {
    aborted = true;
    return { wdl: 0, dtm: 0, move: null };
  }

  const key = encode(board, prisoners, stm);
  const hit = cache.get(key);
  if (hit) return hit;
  if (stack.has(key)) return { wdl: 0, dtm: 0, move: null };

  const moves = orderedMoves(board, prisoners, stm);
  if (moves.length === 0) {
    const loss: SolveHit = { wdl: -1, dtm: 0, move: null };
    cache.set(key, loss);
    return loss;
  }

  stack.add(key);
  let best: SolveHit = { wdl: -1, dtm: 0, move: moves[0] };

  for (const move of moves) {
    if (nodes > NODE_CAP) {
      aborted = true;
      break;
    }
    const undo = makeMove(board, prisoners, move, stm);
    const cap = capturedType(undo);
    let child: SolveHit;
    if (isWinAfterMove(board, prisoners, stm, cap)) {
      child = { wdl: -1, dtm: 0, move: null };
    } else {
      child = solve(board, prisoners, opp(stm), stack, ply + 1);
    }
    unmakeMove(board, prisoners, undo);

    const wdl = (-child.wdl) as -1 | 0 | 1;
    const dtm = child.dtm + 1;
    if (
      wdl > best.wdl
      || (wdl === 1 && best.wdl === 1 && dtm < best.dtm)
      || (wdl === -1 && best.wdl === -1 && dtm > best.dtm)
      || (wdl === 0 && best.wdl === 0 && dtm > best.dtm)
    ) {
      best = { wdl, dtm, move };
      if (wdl === 1 && dtm === 1) break;
    }
  }

  stack.delete(key);
  if (!aborted) cache.set(key, best);
  return best;
}

export function probeEndgameTable(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  stm: Owner,
): AIMove | null {
  if (endgameMaterialCount(board, prisoners) > ENDGAME_PIECE_LIMIT) return null;
  nodes = 0;
  aborted = false;
  const boardCopy = board.map((row) => row.map((c) => (c ? { ...c } : null)));
  const hands = { first: [...prisoners.first], second: [...prisoners.second] };
  const hit = solve(boardCopy, hands, stm, new Set(), 0);
  if (aborted && hit.wdl !== 1) return null;
  if (!hit.move) return null;
  if (hit.wdl < 0) return null;
  return hit.move;
}
