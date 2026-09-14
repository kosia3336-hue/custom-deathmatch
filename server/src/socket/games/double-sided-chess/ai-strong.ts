/* ──────────────────────────────────────────────────────────────
   Strong AI v4 / Super v5

   v3 탐색 골격 + 아칸·윈터·왜조리 멀티 기보 평가:
   - 오프닝 북: 선 우보 44-34, 후 동사선 04-13, 3수 동사선 40-31
   - 왕 되잡기·노출 칸 감점 (동현 8수, a431 비숍 일격)
   - 상대 왕진입 거리 2~3칸 (왜조리 후수 행진)
   - 향차 관통, 보 룩 돌진, 비숍 대각, 왕 옆 드롭
   슈퍼 v5.1: 스트롱과 같은 LMR/PVS/qsearch 8 + IID + 넓은 aspir + SEE
   가지치기 + Lazy SMP(워커 2) + 4기 레이지 DTM. 통계 북은 스트롱·슈퍼 공통
   (정석 3수 우선, 이탈·4~12수). COM 어려움은 이 파일의 스트롱 경로.

   기획서: docs/double-sided-chess-strong-ai.md
────────────────────────────────────────────────────────────── */
import { DSC_BOARD_SIZE } from '@shared/types/double-sided-chess.js';
import type { Cell, PieceType, Owner, Position } from '@shared/types/double-sided-chess.js';
import { nextIsPromoted } from '@shared/logic/double-sided-chess.js';
import {
  isKingInOpponentTerritory,
  countNonKingPieces,
  getValidMoves,
  getValidPrisonerPlacements,
} from './board.js';
import {
  generateAllMoves,
  BASE_VALUE,
  PROMOTED_VALUE,
  pieceValue,
  type AIWorkerData,
} from './ai.js';
import type { AIMove } from './types.js';
import { probeStatsOpeningBook } from './opening-book.js';
import { probeEndgameTable } from './endgame.js';

let _timedOut = false;
let _deadline = Infinity;
let _nodes = 0;
let _turnHint = 1;
let _superMode = false;
let _smpHelper = false;

const MATE = 1_000_000;
const QSEARCH_PLY = 8;
const MAX_ID_DEPTH = 24;
const MAX_ID_DEPTH_SUPER = 32;
const TIME_MASK = 2047;
const ASPIR_INIT = 800;
const ASPIR_MAX = 8_000;

export interface StrongSearchStats {
  move: AIMove;
  completedDepth: number;
  score: number;
  nodes: number;
}

function oppOf(owner: Owner): Owner {
  return owner === 'first' ? 'second' : 'first';
}

function mateScore(isAIWin: boolean, ply: number): number {
  const v = MATE - ply * 1000;
  return isAIWin ? v : -v;
}

function tickClock(): void {
  _nodes++;
  if ((_nodes & TIME_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

/* ─────────────── Zobrist / TT ─────────────── */

function rand64(): bigint {
  const hi = BigInt((Math.random() * 0x100000000) >>> 0);
  const lo = BigInt((Math.random() * 0x100000000) >>> 0);
  return (hi << 32n) | lo;
}

const PIECE_KEY: PieceType[] = ['king', 'infantry', 'gold', 'silver', 'copper'];

function cellIndex(cell: NonNullable<Cell>): number {
  const baseIdx = PIECE_KEY.indexOf(cell.piece);
  const ownerOffset = cell.owner === 'first' ? 0 : 10;
  const promotedOffset = cell.isPromoted ? 5 : 0;
  return ownerOffset + promotedOffset + baseIdx;
}

const ZOBRIST_CELL: bigint[][][] = (() => {
  const arr: bigint[][][] = [];
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    arr[r] = [];
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const slots: bigint[] = [];
      for (let i = 0; i < 20; i++) slots.push(rand64());
      arr[r][c] = slots;
    }
  }
  return arr;
})();

const ZOBRIST_SIDE: bigint = rand64();

const PRISONER_PIECES: PieceType[] = ['infantry', 'gold', 'silver', 'copper'];
const ZOBRIST_PRISONER: Record<Owner, Record<PieceType, bigint[]>> = (() => {
  const out: Record<Owner, Record<PieceType, bigint[]>> = {
    first: { king: [], infantry: [], gold: [], silver: [], copper: [] },
    second: { king: [], infantry: [], gold: [], silver: [], copper: [] },
  };
  for (const owner of ['first', 'second'] as Owner[]) {
    for (const p of PRISONER_PIECES) {
      const slots: bigint[] = [];
      for (let i = 0; i < 8; i++) slots.push(rand64());
      out[owner][p] = slots;
    }
  }
  return out;
})();

function countPiece(prisoners: PieceType[], piece: PieceType): number {
  let n = 0;
  for (const p of prisoners) if (p === piece) n++;
  return n;
}

function hashKey(
  board: Cell[][],
  current: Owner,
  prisoners: { first: PieceType[]; second: PieceType[] },
): bigint {
  let h = 0n;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      h ^= ZOBRIST_CELL[r][c][cellIndex(cell)];
    }
  }
  if (current === 'second') h ^= ZOBRIST_SIDE;
  for (const owner of ['first', 'second'] as Owner[]) {
    for (const p of PRISONER_PIECES) {
      const cnt = countPiece(prisoners[owner], p);
      const slots = ZOBRIST_PRISONER[owner][p];
      const idx = Math.min(cnt, slots.length - 1);
      if (idx > 0) h ^= slots[idx];
    }
  }
  return h;
}

type TTFlag = 'exact' | 'lower' | 'upper';

interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  best?: AIMove;
}

const TT = new Map<bigint, TTEntry>();
const TT_MAX_SIZE = 800_000;

function ttPut(key: bigint, entry: TTEntry): void {
  const existing = TT.get(key);
  if (existing && existing.flag === 'exact' && existing.depth > entry.depth) return;
  if (TT.size >= TT_MAX_SIZE) TT.clear();
  TT.set(key, entry);
}

/* ─────────────── Killer / History ─────────────── */

const MAX_KILLER_DEPTH = 40;
const killers: (AIMove | undefined)[][] = [];
for (let i = 0; i < MAX_KILLER_DEPTH; i++) killers[i] = [undefined, undefined];

function moveEquals(a: AIMove, b: AIMove): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'move' && b.type === 'move') {
    return a.from.row === b.from.row && a.from.col === b.from.col
      && a.to.row === b.to.row && a.to.col === b.to.col;
  }
  if (a.type === 'place-prisoner' && b.type === 'place-prisoner') {
    return a.pieceType === b.pieceType
      && a.position.row === b.position.row
      && a.position.col === b.position.col;
  }
  return false;
}

function isReverse(move: AIMove, prev: AIMove | null): boolean {
  if (!prev || move.type !== 'move' || prev.type !== 'move') return false;
  return move.from.row === prev.to.row && move.from.col === prev.to.col
    && move.to.row === prev.from.row && move.to.col === prev.from.col;
}

function recordKiller(depth: number, move: AIMove): void {
  if (depth < 0 || depth >= MAX_KILLER_DEPTH) return;
  const ks = killers[depth];
  if (!ks) return;
  const k0 = ks[0];
  if (k0 && moveEquals(k0, move)) return;
  ks[1] = ks[0];
  ks[0] = move;
}

function isKiller(depth: number, move: AIMove): boolean {
  if (depth < 0 || depth >= MAX_KILLER_DEPTH) return false;
  const ks = killers[depth];
  if (!ks) return false;
  for (const k of ks) {
    if (k && moveEquals(k, move)) return true;
  }
  return false;
}

const HISTORY_CAP = 100_000;
const N = DSC_BOARD_SIZE;
const historyMove = new Int32Array(N * N * N * N);
const historyDrop = new Int32Array(PRISONER_PIECES.length * N * N);

function moveHistoryIdx(move: AIMove): number {
  if (move.type === 'move') {
    const from = move.from.row * N + move.from.col;
    const to = move.to.row * N + move.to.col;
    return from * (N * N) + to;
  }
  return -1;
}

function dropHistoryIdx(move: AIMove): number {
  if (move.type !== 'place-prisoner') return -1;
  const pieceIdx = PRISONER_PIECES.indexOf(move.pieceType);
  if (pieceIdx < 0) return -1;
  const pos = move.position.row * N + move.position.col;
  return pieceIdx * (N * N) + pos;
}

function recordHistory(move: AIMove, depth: number): void {
  const bonus = depth * depth;
  if (move.type === 'move') {
    const idx = moveHistoryIdx(move);
    if (idx >= 0) {
      const v = historyMove[idx] + bonus;
      historyMove[idx] = v > HISTORY_CAP ? HISTORY_CAP : v;
    }
  } else {
    const idx = dropHistoryIdx(move);
    if (idx >= 0) {
      const v = historyDrop[idx] + bonus;
      historyDrop[idx] = v > HISTORY_CAP ? HISTORY_CAP : v;
    }
  }
}

function getHistoryScore(move: AIMove): number {
  if (move.type === 'move') {
    const idx = moveHistoryIdx(move);
    return idx >= 0 ? historyMove[idx] : 0;
  }
  const idx = dropHistoryIdx(move);
  return idx >= 0 ? historyDrop[idx] : 0;
}

function recordCutoff(depth: number, move: AIMove): void {
  recordKiller(depth, move);
  recordHistory(move, depth);
}

/* ─────────────── make / unmake ─────────────── */

interface Undo {
  move: AIMove;
  owner: Owner;
  fromCell: NonNullable<Cell> | null;
  captured: Cell;
  pushedPrisoner: boolean;
  dropIdx: number;
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
    let capturedType: PieceType | null = null;
    if (target && target.owner !== owner) {
      capturedType = target.piece;
      if (capturedType !== 'king') {
        prisoners[owner].push(capturedType);
        pushed = true;
      }
    }
    board[move.to.row][move.to.col] = {
      piece: fromCell.piece,
      owner: fromCell.owner,
      isPromoted: nextIsPromoted(fromCell.piece, fromCell.isPromoted),
    };
    board[move.from.row][move.from.col] = null;
    return {
      move,
      owner,
      fromCell,
      captured: target,
      pushedPrisoner: pushed,
      dropIdx: -1,
    };
  }

  const idx = prisoners[owner].indexOf(move.pieceType);
  if (idx !== -1) prisoners[owner].splice(idx, 1);
  board[move.position.row][move.position.col] = {
    piece: move.pieceType,
    owner,
    isPromoted: false,
  };
  return {
    move,
    owner,
    fromCell: null,
    captured: null,
    pushedPrisoner: false,
    dropIdx: idx,
  };
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

function capturedTypeOf(undo: Undo): PieceType | null {
  if (undo.move.type !== 'move' || !undo.captured) return null;
  return undo.captured.piece;
}

function checkTerminalFast(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  justMoved: Owner,
  captured: PieceType | null,
  ply: number,
  aiOwner: Owner,
): number | null {
  const opponent = oppOf(justMoved);
  const isAIWin = justMoved === aiOwner;
  if (captured === 'king') return mateScore(isAIWin, ply);
  if (isKingInOpponentTerritory(board, justMoved)) return mateScore(isAIWin, ply);
  if (countNonKingPieces(board, opponent) === 0 && prisoners[opponent].length === 0) {
    return mateScore(isAIWin, ply);
  }
  return null;
}

/* ─────────────── 평가 ─────────────── */

function findKing(board: Cell[][], owner: Owner): Position | null {
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell && cell.owner === owner && cell.piece === 'king') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function hasAnyValidMoveFast(board: Cell[][], row: number, col: number): boolean {
  const cell = board[row][col];
  if (!cell) return false;
  const owner = cell.owner;
  const fwd = owner === 'first' ? -1 : 1;
  const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
  const canLand = (r: number, c: number) =>
    inBounds(r, c) && (board[r][c] === null || board[r][c]!.owner !== owner);

  if (!cell.isPromoted) {
    switch (cell.piece) {
      case 'infantry':
        return canLand(row + fwd, col);
      case 'gold':
      case 'copper': {
        const dirs: [number, number][] = [[fwd, -1], [fwd, 0], [fwd, 1], [0, -1], [0, 1], [-fwd, 0]];
        return dirs.some(([dr, dc]) => canLand(row + dr, col + dc));
      }
      case 'silver': {
        const dirs: [number, number][] = [[fwd, -1], [fwd, 0], [fwd, 1], [-fwd, -1], [-fwd, 1]];
        return dirs.some(([dr, dc]) => canLand(row + dr, col + dc));
      }
      default: return false;
    }
  }
  switch (cell.piece) {
    case 'infantry': {
      const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc]!.owner !== owner)) return true;
      }
      return false;
    }
    case 'gold': {
      const dirs: [number, number][] = [[fwd * 2, -1], [fwd * 2, 1], [fwd, -2], [fwd, 2]];
      return dirs.some(([dr, dc]) => canLand(row + dr, col + dc));
    }
    case 'silver': {
      const dirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc]!.owner !== owner)) return true;
      }
      return false;
    }
    case 'copper': {
      const nr = row + fwd;
      const nc = col;
      return inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc]!.owner !== owner);
    }
    default: return false;
  }
}

function canAttackFast(board: Cell[][], fr: number, fc: number, tr: number, tc: number): boolean {
  if (fr === tr && fc === tc) return false;
  const cell = board[fr][fc];
  if (!cell) return false;
  const owner = cell.owner;
  const fwd = owner === 'first' ? -1 : 1;
  const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

  if (!cell.isPromoted) {
    switch (cell.piece) {
      case 'infantry':
        return fr + fwd === tr && fc === tc;
      case 'gold':
      case 'copper': {
        const dirs: [number, number][] = [[fwd, -1], [fwd, 0], [fwd, 1], [0, -1], [0, 1], [-fwd, 0]];
        return dirs.some(([dr, dc]) => fr + dr === tr && fc + dc === tc);
      }
      case 'silver': {
        const dirs: [number, number][] = [[fwd, -1], [fwd, 0], [fwd, 1], [-fwd, -1], [-fwd, 1]];
        return dirs.some(([dr, dc]) => fr + dr === tr && fc + dc === tc);
      }
      case 'king': {
        const dirs: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        return dirs.some(([dr, dc]) => fr + dr === tr && fc + dc === tc);
      }
      default: return false;
    }
  }
  switch (cell.piece) {
    case 'infantry': {
      if (fr !== tr && fc !== tc) return false;
      if (fr === tr) {
        const minC = Math.min(fc, tc);
        const maxC = Math.max(fc, tc);
        for (let c = minC + 1; c < maxC; c++) if (board[fr][c]) return false;
        return true;
      }
      const minR = Math.min(fr, tr);
      const maxR = Math.max(fr, tr);
      for (let r = minR + 1; r < maxR; r++) if (board[r][fc]) return false;
      return true;
    }
    case 'gold': {
      const dirs: [number, number][] = [[fwd * 2, -1], [fwd * 2, 1], [fwd, -2], [fwd, 2]];
      return dirs.some(([dr, dc]) => inBounds(fr + dr, fc + dc) && fr + dr === tr && fc + dc === tc);
    }
    case 'silver': {
      const dr = tr - fr;
      const dc = tc - fc;
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      const sr = dr > 0 ? 1 : -1;
      const sc = dc > 0 ? 1 : -1;
      let r = fr + sr;
      let c = fc + sc;
      while (r !== tr || c !== tc) {
        if (r < 0 || r >= N || c < 0 || c >= N) return false;
        if (board[r][c]) return false;
        r += sr;
        c += sc;
      }
      return true;
    }
    case 'copper': {
      if (fc !== tc) return false;
      const dir = fwd > 0 ? 1 : -1;
      if ((tr - fr) * dir <= 0) return false;
      const minR = Math.min(fr, tr);
      const maxR = Math.max(fr, tr);
      for (let r = minR + 1; r < maxR; r++) if (board[r][fc]) return false;
      return true;
    }
    default: return false;
  }
}

function countKingAttackers(board: Cell[][], owner: Owner): number {
  const king = findKing(board, owner);
  if (!king) return 0;
  const opp = oppOf(owner);
  let n = 0;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.owner !== opp) continue;
      if (canAttackFast(board, r, c, king.row, king.col)) n++;
    }
  }
  return n;
}

const PST_INFANTRY_FIRST: number[][] = [
  [0, 0, 0, 0, 0],
  [10, 14, 18, 14, 10],
  [5, 8, 12, 8, 5],
  [0, 2, 4, 2, 0],
  [0, 0, 0, 0, 0],
];
function pstInfantryFirst(r: number, c: number): number { return PST_INFANTRY_FIRST[r][c]; }
function pstInfantrySecond(r: number, c: number): number {
  return PST_INFANTRY_FIRST[DSC_BOARD_SIZE - 1 - r][c];
}

function kingEntryRow(owner: Owner): number {
  return owner === 'first' ? 0 : DSC_BOARD_SIZE - 1;
}

function isKingNearEntry(board: Cell[][], owner: Owner): { imminent: boolean; targetClear: boolean } {
  const king = findKing(board, owner);
  if (!king) return { imminent: false, targetClear: false };
  const target = kingEntryRow(owner);
  const adjRow = owner === 'first' ? target + 1 : target - 1;
  if (king.row !== adjRow) return { imminent: false, targetClear: false };
  for (let dc = -1; dc <= 1; dc++) {
    const nc = king.col + dc;
    if (nc < 0 || nc >= DSC_BOARD_SIZE) continue;
    if (!board[target][nc]) return { imminent: true, targetClear: true };
  }
  return { imminent: true, targetClear: false };
}

function isSquareAttacked(
  board: Cell[][],
  tr: number,
  tc: number,
  byOwner: Owner,
  skipR = -1,
  skipC = -1,
): boolean {
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      if (r === skipR && c === skipC) continue;
      if (r === tr && c === tc) continue;
      const cell = board[r][c];
      if (!cell || cell.owner !== byOwner) continue;
      if (canAttackFast(board, r, c, tr, tc)) return true;
    }
  }
  return false;
}

function cheapestAttacker(
  board: Cell[][],
  tr: number,
  tc: number,
  owner: Owner,
): { r: number; c: number; v: number } | null {
  let best: { r: number; c: number; v: number } | null = null;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.owner !== owner) continue;
      if (!canAttackFast(board, r, c, tr, tc)) continue;
      const v = pieceValue(cell.piece, cell.isPromoted);
      if (!best || v < best.v) best = { r, c, v };
    }
  }
  return best;
}

/** 캡처의 정적 교환. 음수면 재잡히며 손해를 본다. */
export function seeCaptureScore(
  board: Cell[][],
  from: Position,
  to: Position,
  owner: Owner,
): number {
  const att = board[from.row][from.col];
  const victim = board[to.row][to.col];
  if (!att || att.owner !== owner) return 0;
  if (!victim || victim.owner === owner) return 0;
  if (victim.piece === 'king') return MATE;

  const b = cloneBoardLocal(board);
  const gains: number[] = [pieceValue(victim.piece, victim.isPromoted)];
  b[to.row][to.col] = {
    piece: att.piece,
    owner: att.owner,
    isPromoted: nextIsPromoted(att.piece, att.isPromoted),
  };
  b[from.row][from.col] = null;

  let stm = oppOf(owner);
  for (let i = 0; i < 16; i++) {
    const onSq = b[to.row][to.col];
    if (!onSq) break;
    const rec = cheapestAttacker(b, to.row, to.col, stm);
    if (!rec) break;
    const recCell = b[rec.r][rec.c]!;
    gains.push(pieceValue(onSq.piece, onSq.isPromoted));
    if (onSq.piece === 'king') break;
    b[to.row][to.col] = {
      piece: recCell.piece,
      owner: recCell.owner,
      isPromoted: nextIsPromoted(recCell.piece, recCell.isPromoted),
    };
    b[rec.r][rec.c] = null;
    stm = oppOf(stm);
  }

  let s = 0;
  for (let i = gains.length - 1; i >= 0; i--) s = gains[i] - s;
  return s;
}

function timeoutScore(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  aiOwner: Owner,
): number {
  return evaluateStrong(board, prisoners, aiOwner);
}

function kingHomeRow(owner: Owner): number {
  return owner === 'first' ? DSC_BOARD_SIZE - 1 : 0;
}

function kingDistToEntry(board: Cell[][], owner: Owner): number {
  const k = findKing(board, owner);
  if (!k) return 9;
  return owner === 'first' ? k.row : (DSC_BOARD_SIZE - 1 - k.row);
}

function piecesBetween(
  board: Cell[][],
  fr: number,
  fc: number,
  tr: number,
  tc: number,
): number | null {
  const dr = Math.sign(tr - fr);
  const dc = Math.sign(tc - fc);
  if (dr === 0 && dc === 0) return null;
  const aligned = fr === tr || fc === tc || Math.abs(tr - fr) === Math.abs(tc - fc);
  if (!aligned) return null;
  let n = 0;
  let r = fr + dr;
  let c = fc + dc;
  while (r !== tr || c !== tc) {
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    if (board[r][c]) n++;
    r += dr;
    c += dc;
  }
  return n;
}

function sliderLineThreats(board: Cell[][], aiOwner: Owner): number {
  let score = 0;
  const firstKing = findKing(board, 'first');
  const secondKing = findKing(board, 'second');

  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || !cell.isPromoted) continue;
      if (cell.piece === 'gold' || cell.piece === 'king') continue;
      const enemyKing = cell.owner === 'first' ? secondKing : firstKing;
      if (!enemyKing) continue;
      const sign = cell.owner === aiOwner ? 1 : -1;
      if (canAttackFast(board, r, c, enemyKing.row, enemyKing.col)) {
        const bishopBonus = cell.piece === 'silver' ? 500 : 0;
        score += sign * (1100 + bishopBonus);
        continue;
      }
      if (cell.piece === 'copper') {
        const fwd = cell.owner === 'first' ? -1 : 1;
        if (c !== enemyKing.col) continue;
        if ((enemyKing.row - r) * fwd <= 0) continue;
        const between = piecesBetween(board, r, c, enemyKing.row, enemyKing.col);
        if (between === 1) score += sign * 420;
        continue;
      }
      const between = piecesBetween(board, r, c, enemyKing.row, enemyKing.col);
      if (between !== 1) continue;
      if (cell.piece === 'infantry' && (r === enemyKing.row || c === enemyKing.col)) {
        score += sign * 380;
      } else if (cell.piece === 'silver' && Math.abs(r - enemyKing.row) === Math.abs(c - enemyKing.col)) {
        score += sign * 450;
      }
    }
  }
  return score;
}

function lanceFileScore(board: Cell[][], r: number, c: number, owner: Owner): number {
  const fwd = owner === 'first' ? -1 : 1;
  let clear = 0;
  let rr = r + fwd;
  while (rr >= 0 && rr < N) {
    const hit = board[rr][c];
    if (!hit) {
      clear++;
      rr += fwd;
      continue;
    }
    if (hit.owner !== owner) {
      const back = kingEntryRow(owner);
      let s = 180 + clear * 90;
      if (hit.piece === 'king') s += 320;
      if (rr === back) s += 240;
      return s;
    }
    break;
  }
  return clear * 70;
}

const STATS_BOOK_MAX_TURN = 12;

function probeJosekiBook(board: Cell[][], owner: Owner, turnNumber: number): AIMove | null {
  if (turnNumber === 1 && owner === 'first') {
    const cell = board[4][4];
    if (cell?.piece === 'infantry' && cell.owner === 'first' && !cell.isPromoted) {
      return { type: 'move', from: { row: 4, col: 4 }, to: { row: 3, col: 4 } };
    }
  }
  if (turnNumber === 2 && owner === 'second') {
    const cell = board[0][4];
    if (cell?.piece === 'copper' && cell.owner === 'second' && !cell.isPromoted) {
      return { type: 'move', from: { row: 0, col: 4 }, to: { row: 1, col: 3 } };
    }
  }
  if (turnNumber === 3 && owner === 'first') {
    const inf = board[3][4];
    const copper = board[4][0];
    const dest = board[3][1];
    if (
      inf?.piece === 'infantry' && inf.owner === 'first'
      && copper?.piece === 'copper' && copper.owner === 'first' && !copper.isPromoted
      && (!dest || dest.owner === 'second')
    ) {
      return { type: 'move', from: { row: 4, col: 0 }, to: { row: 3, col: 1 } };
    }
  }
  return null;
}

export function probeOpeningBook(
  board: Cell[][],
  owner: Owner,
  turnNumber: number,
  prisoners: { first: PieceType[]; second: PieceType[] } = { first: [], second: [] },
): AIMove | null {
  if (turnNumber <= 3) {
    const joseki = probeJosekiBook(board, owner, turnNumber);
    if (joseki) return joseki;
  }
  if (turnNumber <= STATS_BOOK_MAX_TURN) {
    return probeStatsOpeningBook(board, prisoners, owner);
  }
  return null;
}

function moveIsLegal(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
  move: AIMove,
): boolean {
  for (const m of generateAllMoves(board, prisoners, owner)) {
    if (moveEquals(m, move)) return true;
  }
  return false;
}

export function evaluateStrong(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  aiOwner: Owner,
): number {
  const oppOwner = oppOf(aiOwner);
  let score = 0;

  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      const val = pieceValue(cell.piece, cell.isPromoted);
      const sign = cell.owner === aiOwner ? 1 : -1;
      score += sign * val;

      if (cell.piece === 'king') continue;

      if (r >= 1 && r <= 3 && c >= 1 && c <= 3) {
        score += sign * 12;
      }

      if (cell.piece === 'infantry') {
        if (cell.isPromoted) {
          const toward = cell.owner === 'first' ? (DSC_BOARD_SIZE - 1 - r) : r;
          score += sign * (40 + toward * 22);
          if (r === kingEntryRow(cell.owner)) score += sign * 260;
        } else {
          const pst = cell.owner === 'first' ? pstInfantryFirst(r, c) : pstInfantrySecond(r, c);
          score += sign * pst;
          if (cell.owner === 'first' && r === 3) score += sign * 55;
          if (cell.owner === 'second' && r === 1) score += sign * 55;
        }
      }

      if (cell.piece === 'copper') {
        if (cell.isPromoted) {
          score += sign * (240 + lanceFileScore(board, r, c, cell.owner));
          if (r === kingEntryRow(cell.owner)) score += sign * 420;
        } else {
          if (cell.owner === 'first' && r === 3 && c === 1) score += sign * 80;
          if (cell.owner === 'second' && r === 1 && c === 3) score += sign * 80;
        }
      }

      if (cell.piece === 'silver' && cell.isPromoted) {
        score += sign * 200;
      }

      if (!cell.isPromoted) {
        const diff = PROMOTED_VALUE[cell.piece] - BASE_VALUE[cell.piece];
        if (diff > 0 && hasAnyValidMoveFast(board, r, c)) {
          score += sign * Math.round(diff * 0.4);
        }
      }
    }
  }

  score += sliderLineThreats(board, aiOwner);

  const myAttackers = countKingAttackers(board, aiOwner);
  const oppAttackers = countKingAttackers(board, oppOwner);
  const attackerPenalty = (n: number): number => {
    if (n <= 0) return 0;
    if (n === 1) return 2200;
    if (n === 2) return 7000;
    return 14000;
  };
  score -= attackerPenalty(myAttackers);
  score += attackerPenalty(oppAttackers);

  const myEntry = isKingNearEntry(board, aiOwner);
  const oppEntry = isKingNearEntry(board, oppOwner);
  if (myEntry.imminent && myEntry.targetClear) score += 60_000;
  else if (myEntry.imminent) score += 18_000;
  if (oppEntry.imminent && oppEntry.targetClear) score -= 90_000;
  else if (oppEntry.imminent) score -= 32_000;

  const myDist = kingDistToEntry(board, aiOwner);
  const oppDist = kingDistToEntry(board, oppOwner);
  if (oppDist === 2) score -= 14_000;
  else if (oppDist === 3) score -= 4_200;
  if (myDist === 2 && _turnHint >= 10) score += 5_500;
  if (oppDist < myDist) score -= (myDist - oppDist) * 2_400;

  for (const owner of [aiOwner, oppOwner] as Owner[]) {
    const k = findKing(board, owner);
    if (!k) continue;
    const sign = owner === aiOwner ? 1 : -1;
    const home = kingHomeRow(owner);
    const recaptureRow = owner === 'first' ? 3 : 1;
    if (k.row !== home && k.row !== kingEntryRow(owner)) {
      const dist = owner === 'first' ? k.row : (DSC_BOARD_SIZE - 1 - k.row);
      if (dist >= 3 && _turnHint <= 16) score += sign * -1100;
      if (k.row === recaptureRow) {
        const att = owner === aiOwner ? myAttackers : oppAttackers;
        score += sign * -(800 + att * 900);
      }
    }
  }

  const advanceCoef =
    _turnHint <= 8 ? 0 :
    _turnHint <= 16 ? 8 : 22;
  if (advanceCoef > 0) {
    for (let r = 0; r < DSC_BOARD_SIZE; r++) {
      for (let c = 0; c < DSC_BOARD_SIZE; c++) {
        const cell = board[r][c];
        if (!cell || cell.piece !== 'king') continue;
        const dist = cell.owner === 'first' ? (DSC_BOARD_SIZE - 1 - r) : r;
        const sign = cell.owner === aiOwner ? 1 : -1;
        score += sign * dist * advanceCoef;
      }
    }
  }

  for (const owner of [aiOwner, oppOwner] as Owner[]) {
    const k = findKing(board, owner);
    if (k && k.row === 2 && k.col === 2) {
      const sign = owner === aiOwner ? -1 : 1;
      score += sign * 80;
    }
  }

  const myMat = countNonKingPieces(board, aiOwner);
  const oppMat = countNonKingPieces(board, oppOwner);
  score += (myMat - oppMat) * 90;
  if (oppMat <= 1 && prisoners[oppOwner].length <= 1) score += 2_800;
  if (myMat <= 1 && prisoners[aiOwner].length <= 1) score -= 3_400;

  for (const owner of [aiOwner, oppOwner] as Owner[]) {
    const sign = owner === aiOwner ? 1 : -1;
    const row = owner === 'first' ? DSC_BOARD_SIZE - 1 : 0;
    let backRowEmpty = 0;
    for (let c = 0; c < DSC_BOARD_SIZE; c++) if (!board[row][c]) backRowEmpty++;
    const placeMult = backRowEmpty === 0 ? 0.3 : backRowEmpty >= 3 ? 1.15 : 1.0;
    const oppK = findKing(board, oppOf(owner));
    for (const pt of prisoners[owner]) {
      if (pt === 'king') continue;
      const v = BASE_VALUE[pt] * 0.5 + PROMOTED_VALUE[pt] * 0.45;
      score += sign * Math.round(v * placeMult);
      if (oppK && (pt === 'copper' || pt === 'gold' || pt === 'silver')) {
        score += sign * 40;
      }
    }
  }

  for (const owner of [aiOwner, oppOwner] as Owner[]) {
    const k = findKing(board, owner);
    if (!k) continue;
    let defenders = 0;
    let intrusion = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = k.row + dr;
        const nc = k.col + dc;
        if (nr < 0 || nr >= DSC_BOARD_SIZE || nc < 0 || nc >= DSC_BOARD_SIZE) continue;
        const cell = board[nr][nc];
        if (!cell) intrusion++;
        else if (cell.owner === owner) defenders++;
      }
    }
    const sign = owner === aiOwner ? 1 : -1;
    score += sign * (defenders * 22 - Math.min(intrusion * 10, 60));
  }

  return score;
}

/* ─────────────── 수 생성 / 오더링 ─────────────── */

interface RankedMove {
  move: AIMove;
  rank: number;
}

function generateTacticalMoves(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
): AIMove[] {
  const out: AIMove[] = [];
  const entry = kingEntryRow(owner);
  const oppKing = findKing(board, oppOf(owner));
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.owner !== owner) continue;
      for (const to of getValidMoves(board, r, c)) {
        const target = board[to.row][to.col];
        if (target && target.owner !== owner) {
          out.push({ type: 'move', from: { row: r, col: c }, to });
        } else if (cell.piece === 'king' && to.row === entry) {
          out.push({ type: 'move', from: { row: r, col: c }, to });
        }
      }
    }
  }
  if (oppKing && prisoners[owner].length > 0) {
    const placements = getValidPrisonerPlacements(board, owner);
    const types = [...new Set(prisoners[owner])];
    for (const pos of placements) {
      const nearKing = Math.abs(pos.col - oppKing.col) <= 1
        || pos.col === oppKing.col;
      if (!nearKing) continue;
      for (const pt of types) {
        out.push({ type: 'place-prisoner', pieceType: pt, position: pos });
      }
    }
  }
  return out;
}

function detectOpponentImmediateThreats(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  myOwner: Owner,
): { kingAttackerCells: Set<number>; entryByCell: Set<number> } {
  const oppOwner = oppOf(myOwner);
  const oppMoves = generateAllMoves(board, prisoners, oppOwner);
  const kingAttackerCells = new Set<number>();
  const entryByCell = new Set<number>();

  for (const m of oppMoves) {
    const undo = makeMove(board, prisoners, m, oppOwner);
    const term = checkTerminalFast(board, prisoners, oppOwner, capturedTypeOf(undo), 0, oppOwner);
    unmakeMove(board, prisoners, undo);
    if (term === null || term < 500_000) continue;
    if (m.type === 'move') {
      kingAttackerCells.add(m.from.row * N + m.from.col);
      if (board[m.from.row]?.[m.from.col]?.piece === 'king') {
        entryByCell.add(m.to.row * N + m.to.col);
      }
    }
  }
  return { kingAttackerCells, entryByCell };
}

function rankMove(
  board: Cell[][],
  move: AIMove,
  ttBest: AIMove | undefined,
  killerDepth: number,
  threats: { kingAttackerCells: Set<number>; entryByCell: Set<number> } | null,
  owner: Owner,
  prevMove: AIMove | null,
): number {
  let r = 0;
  if (ttBest && moveEquals(ttBest, move)) r += 10_000_000;
  if (isReverse(move, prevMove)) r -= 4_000_000;

  if (move.type === 'move') {
    const target = board[move.to.row][move.to.col];
    const piece = board[move.from.row]?.[move.from.col];
    if (target && target.piece === 'king' && target.owner !== owner) r += 9_000_000;
    if (piece?.piece === 'king' && move.to.row === kingEntryRow(owner)) r += 8_000_000;

    if (piece?.piece === 'king' && target?.piece !== 'king' && move.to.row !== kingEntryRow(owner)) {
      const opp = oppOf(owner);
      if (isSquareAttacked(board, move.to.row, move.to.col, opp, move.from.row, move.from.col)) {
        r -= 5_500_000;
      }
      if (target && target.owner !== owner) r -= 1_400_000;
      if (_turnHint <= 12) r -= 2_200_000;
    }

    if (target && target.owner !== owner) {
      const victim = pieceValue(target.piece, target.isPromoted);
      const attacker = piece ? pieceValue(piece.piece, piece.isPromoted) : 1;
      r += 1_000_000 + victim * 100 - Math.floor(attacker / 10);
    }

    if (_turnHint <= 2 && piece?.piece === 'king' && !(target && target.owner !== owner)) {
      r -= 2_000_000;
    }

    if (piece?.piece === 'copper' && piece.isPromoted) {
      const back = kingEntryRow(owner);
      if (move.to.row === back) r += 220_000;
      if (move.to.col === move.from.col && Math.abs(move.to.row - move.from.row) >= 2) r += 160_000;
    }
    if (piece?.piece === 'infantry' && !piece.isPromoted) {
      if (owner === 'first' && move.from.row === 4 && move.from.col === 4 && move.to.row === 3 && move.to.col === 4) {
        r += 3_000_000;
      }
      if (owner === 'second' && move.from.row === 0 && move.from.col === 0 && move.to.row === 1 && move.to.col === 0) {
        r += 400_000;
      }
    }
    if (piece?.piece === 'copper' && !piece.isPromoted) {
      if (owner === 'first' && move.from.row === 4 && move.from.col === 0 && move.to.row === 3 && move.to.col === 1) {
        r += _turnHint <= 3 ? 2_400_000 : 180_000;
      }
      if (owner === 'second' && move.from.row === 0 && move.from.col === 4 && move.to.row === 1 && move.to.col === 3) {
        r += _turnHint <= 2 ? 3_000_000 : 180_000;
      }
    }
    if (piece?.piece === 'silver' && !piece.isPromoted) {
      if (owner === 'first' && move.from.row === 4 && move.from.col === 1 && move.to.row === 3 && move.to.col === 2) {
        r += _turnHint === 1 ? 1_600_000 : 0;
      }
    }

    if (threats) {
      const toIdx = move.to.row * N + move.to.col;
      if (threats.kingAttackerCells.has(toIdx)) r += 700_000;
      if (threats.entryByCell.has(toIdx)) r += 600_000;
      if (piece?.piece === 'king' && threats.kingAttackerCells.size > 0) r += 50_000;
    }
  } else {
    const baseV = BASE_VALUE[move.pieceType];
    const promV = PROMOTED_VALUE[move.pieceType];
    r += 8_000 + Math.round((baseV + promV) / 4);
    const oppKing = findKing(board, oppOf(owner));
    if (oppKing) {
      const pc = move.position.col;
      if (pc === oppKing.col) r += 480_000;
      else if (Math.abs(pc - oppKing.col) === 1) r += 320_000;
    }
    if (move.pieceType === 'copper' || move.pieceType === 'gold') r += 50_000;
    if (move.pieceType === 'silver') r += 35_000;
  }

  if (isKiller(killerDepth, move)) r += 100_000;
  r += Math.min(getHistoryScore(move) >> 5, 8000);

  const tr = move.type === 'move' ? move.to.row : move.position.row;
  const tc = move.type === 'move' ? move.to.col : move.position.col;
  const mid = Math.floor(DSC_BOARD_SIZE / 2);
  r += Math.max(0, 4 - (Math.abs(tr - mid) + Math.abs(tc - mid)));
  return r;
}

function orderedFromList(
  board: Cell[][],
  moves: AIMove[],
  ttBest: AIMove | undefined,
  killerDepth: number,
  threats: { kingAttackerCells: Set<number>; entryByCell: Set<number> } | null,
  owner: Owner,
  prevMove: AIMove | null,
): RankedMove[] {
  const out: RankedMove[] = [];
  for (const m of moves) {
    let rank = rankMove(board, m, ttBest, killerDepth, threats, owner, prevMove);
    if (_smpHelper && rank < 5_000_000) {
      let x = 0;
      if (m.type === 'move') {
        x = m.from.row + 7 * m.from.col + 49 * m.to.row + 343 * m.to.col;
      } else {
        x = 2000 + m.position.row + 11 * m.position.col + m.pieceType.length;
      }
      x = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
      rank += ((x >>> 0) % 300_001) - 150_000;
    }
    out.push({ move: m, rank });
  }
  out.sort((a, b) => b.rank - a.rank);
  return out;
}

function orderedMoves(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
  ttBest: AIMove | undefined,
  killerDepth: number,
  threats: { kingAttackerCells: Set<number>; entryByCell: Set<number> } | null,
  prevMove: AIMove | null,
): RankedMove[] {
  return orderedFromList(
    board,
    generateAllMoves(board, prisoners, owner),
    ttBest,
    killerDepth,
    threats,
    owner,
    prevMove,
  );
}

/* ─────────────── Quiescence ─────────────── */

function quiesce(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  alpha: number,
  beta: number,
  isMax: boolean,
  aiOwner: Owner,
  qdepth: number,
  ply: number,
): number {
  tickClock();
  if (_timedOut) return timeoutScore(board, prisoners, aiOwner);

  const curOwner: Owner = isMax ? aiOwner : oppOf(aiOwner);
  const inCheck = countKingAttackers(board, curOwner) > 0;

  if (qdepth <= 0) return evaluateStrong(board, prisoners, aiOwner);

  const stand = evaluateStrong(board, prisoners, aiOwner);
  if (!inCheck) {
    if (isMax) {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
    } else {
      if (stand <= alpha) return stand;
      if (stand < beta) beta = stand;
    }
  }

  const raw = inCheck
    ? generateAllMoves(board, prisoners, curOwner)
    : generateTacticalMoves(board, prisoners, curOwner);
  const ranked = orderedFromList(board, raw, undefined, 0, null, curOwner, null);

  if (ranked.length === 0) {
    if (inCheck) return mateScore(curOwner !== aiOwner, ply);
    return stand;
  }

  let best = inCheck ? (isMax ? -Infinity : Infinity) : stand;

  for (const { move } of ranked) {
    if (_timedOut) break;
    if (_superMode && !inCheck && move.type === 'move') {
      const target = board[move.to.row][move.to.col];
      if (target && target.owner !== curOwner && target.piece !== 'king') {
        if (seeCaptureScore(board, move.from, move.to, curOwner) < 0) continue;
      }
    }
    const undo = makeMove(board, prisoners, move, curOwner);
    const captured = capturedTypeOf(undo);
    const term = checkTerminalFast(board, prisoners, curOwner, captured, ply + 1, aiOwner);
    let s: number;
    if (term !== null) s = term;
    else s = quiesce(board, prisoners, alpha, beta, !isMax, aiOwner, qdepth - 1, ply + 1);
    unmakeMove(board, prisoners, undo);
    if (_timedOut) break;

    if (isMax) {
      if (s > best) best = s;
      if (best > alpha) alpha = best;
    } else {
      if (s < best) best = s;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }

  return best;
}

/* ─────────────── Minimax ─────────────── */

function minimaxV2(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  aiOwner: Owner,
  ply: number,
  prevMove: AIMove | null,
): number {
  tickClock();
  if (_timedOut) return timeoutScore(board, prisoners, aiOwner);

  const curOwner: Owner = isMax ? aiOwner : oppOf(aiOwner);
  const inCheck = countKingAttackers(board, curOwner) > 0;
  let searchDepth = depth;
  if (inCheck && ply < 28) searchDepth += 1;

  if (searchDepth <= 0) {
    return quiesce(board, prisoners, alpha, beta, isMax, aiOwner, QSEARCH_PLY, ply);
  }

  const key = hashKey(board, curOwner, prisoners);
  const ttHit = TT.get(key);
  let ttBest: AIMove | undefined;
  if (ttHit && ttHit.depth >= searchDepth) {
    if (ttHit.flag === 'exact') return ttHit.score;
    if (ttHit.flag === 'lower' && ttHit.score >= beta) return ttHit.score;
    if (ttHit.flag === 'upper' && ttHit.score <= alpha) return ttHit.score;
  }
  if (ttHit) ttBest = ttHit.best;

  if (_superMode && !ttBest && searchDepth >= 5 && ply >= 1 && !_timedOut) {
    minimaxV2(board, prisoners, searchDepth - 2, alpha, beta, isMax, aiOwner, ply, prevMove);
    if (_timedOut) return timeoutScore(board, prisoners, aiOwner);
    const iidHit = TT.get(key);
    if (iidHit?.best) ttBest = iidHit.best;
  }

  const moves = orderedMoves(board, prisoners, curOwner, ttBest, searchDepth, null, prevMove);
  if (moves.length === 0) {
    return mateScore(curOwner !== aiOwner, ply);
  }

  let best = isMax ? -Infinity : Infinity;
  let bestMove: AIMove | undefined;
  const origAlpha = alpha;
  const origBeta = beta;
  let searched = 0;

  for (const { move } of moves) {
    if (_timedOut) break;

    const undo = makeMove(board, prisoners, move, curOwner);
    const captured = capturedTypeOf(undo);
    const term = checkTerminalFast(board, prisoners, curOwner, captured, ply + 1, aiOwner);

    let s: number;
    if (term !== null) {
      s = term;
    } else {
      const isCapture = captured !== null;
      const isKingEntry = move.type === 'move'
        && board[move.to.row][move.to.col]?.piece === 'king';
      const givesCheck = countKingAttackers(board, oppOf(curOwner)) > 0;
      const quiet = !isCapture && !isKingEntry && !givesCheck && move.type === 'move' && !inCheck;
      searched++;
      let reduction = 0;
      if (quiet && searchDepth >= 3 && searched >= 4) {
        reduction = 1;
        if (searchDepth >= 6 && searched >= 8) reduction = 2;
      }
      const nextDepth = searchDepth - 1 - reduction;
      const isPV = searched === 1 || searchDepth < 3;

      if (isPV || reduction === 0) {
        s = minimaxV2(board, prisoners, nextDepth, alpha, beta, !isMax, aiOwner, ply + 1, move);
      } else if (isMax) {
        s = minimaxV2(board, prisoners, nextDepth, alpha, alpha + 1, false, aiOwner, ply + 1, move);
        if (!_timedOut && s > alpha) {
          s = minimaxV2(
            board, prisoners, searchDepth - 1, alpha, beta, false, aiOwner, ply + 1, move,
          );
        }
      } else {
        s = minimaxV2(board, prisoners, nextDepth, beta - 1, beta, true, aiOwner, ply + 1, move);
        if (!_timedOut && s < beta) {
          s = minimaxV2(
            board, prisoners, searchDepth - 1, alpha, beta, true, aiOwner, ply + 1, move,
          );
        }
      }
    }

    unmakeMove(board, prisoners, undo);
    if (_timedOut) break;

    if (isMax) {
      if (s > best) { best = s; bestMove = move; }
      if (best > alpha) alpha = best;
    } else {
      if (s < best) { best = s; bestMove = move; }
      if (best < beta) beta = best;
    }
    if (beta <= alpha) {
      if (bestMove) recordCutoff(searchDepth, bestMove);
      break;
    }
  }

  if (!_timedOut && bestMove) {
    let flag: TTFlag;
    if (best <= origAlpha) flag = 'upper';
    else if (best >= origBeta) flag = 'lower';
    else flag = 'exact';
    ttPut(key, { depth: searchDepth, score: best, flag, best: bestMove });
  }

  return best;
}

/* ─────────────── Root + ID ─────────────── */

interface RootResult {
  move: AIMove | null;
  score: number;
  failedLow: boolean;
  failedHigh: boolean;
}

function findBestMoveAtDepthV2(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  aiOwner: Owner,
  depth: number,
  prevMove: AIMove | null,
  alphaIn: number,
  betaIn: number,
): RootResult {
  const moves = generateAllMoves(board, prisoners, aiOwner);
  for (const move of moves) {
    const undo = makeMove(board, prisoners, move, aiOwner);
    const term = checkTerminalFast(board, prisoners, aiOwner, capturedTypeOf(undo), 1, aiOwner);
    unmakeMove(board, prisoners, undo);
    if (term !== null && term > 500_000) {
      return { move, score: term, failedLow: false, failedHigh: false };
    }
  }

  const threats = detectOpponentImmediateThreats(board, prisoners, aiOwner);
  const rootKey = hashKey(board, aiOwner, prisoners);
  const rootTT = TT.get(rootKey);
  const ranked = orderedMoves(board, prisoners, aiOwner, rootTT?.best, depth, threats, prevMove);

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  let alpha = alphaIn;
  const beta = betaIn;

  for (const { move } of ranked) {
    if (_timedOut) break;
    const undo = makeMove(board, prisoners, move, aiOwner);
    const term = checkTerminalFast(board, prisoners, aiOwner, capturedTypeOf(undo), 1, aiOwner);
    let s: number;
    if (term !== null) s = term;
    else s = minimaxV2(board, prisoners, depth - 1, alpha, beta, false, aiOwner, 1, move);
    unmakeMove(board, prisoners, undo);
    if (_timedOut) break;
    if (s > bestScore) { bestScore = s; bestMove = move; }
    if (bestScore > alpha) alpha = bestScore;
    if (bestScore >= beta) break;
  }

  const failedLow = bestScore <= alphaIn;
  const failedHigh = bestScore >= betaIn;
  if (bestMove && !_timedOut) {
    let flag: TTFlag = 'exact';
    if (failedLow) flag = 'upper';
    else if (failedHigh) flag = 'lower';
    ttPut(rootKey, { depth, score: bestScore, flag, best: bestMove });
  }

  return { move: bestMove, score: bestScore, failedLow, failedHigh };
}

function cloneBoardLocal(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((c) => (c ? { ...c } : null)));
}

export function tryOpeningBook(data: AIWorkerData): AIMove | null {
  if (data.skipOpeningBook) return null;
  if (typeof data.turnNumber !== 'number' || data.turnNumber > STATS_BOOK_MAX_TURN) return null;
  const prisoners = {
    first: [...data.prisoners.first],
    second: [...data.prisoners.second],
  };
  const book = probeOpeningBook(data.board, data.currentOwner, data.turnNumber, prisoners);
  if (!book) return null;
  if (!moveIsLegal(data.board, prisoners, data.currentOwner, book)) return null;
  return book;
}

function searchIterative(data: AIWorkerData, timeLimitMs: number): StrongSearchStats {
  _deadline = Date.now() + timeLimitMs;
  _timedOut = false;
  _nodes = 0;
  const started = Date.now();

  const board = cloneBoardLocal(data.board);
  const prisoners = {
    first: [...data.prisoners.first],
    second: [...data.prisoners.second],
  };
  const aiOwner = data.currentOwner;
  const prevMove = data.lastMove ?? null;

  _turnHint = data.turnNumber ?? Math.max(1, 1 + (8 - (
    countNonKingPieces(board, 'first') + countNonKingPieces(board, 'second')
  )) * 2);

  if (
    !data.skipOpeningBook
    && typeof data.turnNumber === 'number'
    && data.turnNumber <= STATS_BOOK_MAX_TURN
  ) {
    const book = probeOpeningBook(board, aiOwner, data.turnNumber, prisoners);
    if (book && moveIsLegal(board, prisoners, aiOwner, book)) {
      console.info(`[DSC ${_superMode ? 'super' : 'strong'}] book turn=${data.turnNumber}`);
      return { move: book, completedDepth: 0, score: 0, nodes: 0 };
    }
  }

  if (_superMode) {
    const tb = probeEndgameTable(board, prisoners, aiOwner);
    if (tb && moveIsLegal(board, prisoners, aiOwner, tb)) {
      console.info(`[DSC super] endgame tb turn=${data.turnNumber ?? '?'}`);
      return { move: tb, completedDepth: 0, score: MATE, nodes: 0 };
    }
  }

  const fallbackMoves = generateAllMoves(board, prisoners, aiOwner);
  let bestMove: AIMove = fallbackMoves[0]
    ?? { type: 'move', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } };
  if (fallbackMoves.length === 0) {
    return { move: bestMove, completedDepth: 0, score: 0, nodes: _nodes };
  }

  let lastScore = 0;
  let completedDepth = 0;
  const maxDepth = _superMode ? MAX_ID_DEPTH_SUPER : MAX_ID_DEPTH;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() >= _deadline) break;

    let result: RootResult | null = null;

    if (_superMode && depth >= 3) {
      let window = ASPIR_INIT;
      let alpha = lastScore - window;
      let beta = lastScore + window;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (Date.now() >= _deadline) break;
        _timedOut = false;
        result = findBestMoveAtDepthV2(board, prisoners, aiOwner, depth, prevMove, alpha, beta);
        if (_timedOut) break;
        if (!result.failedLow && !result.failedHigh) break;
        window *= 4;
        if (window > ASPIR_MAX || attempt >= 1) {
          alpha = -Infinity;
          beta = Infinity;
        } else if (result.failedLow) {
          alpha = lastScore - window;
          beta = lastScore + Math.floor(window / 2);
        } else {
          alpha = lastScore - Math.floor(window / 2);
          beta = lastScore + window;
        }
      }
    } else {
      _timedOut = false;
      result = findBestMoveAtDepthV2(
        board, prisoners, aiOwner, depth, prevMove, -Infinity, Infinity,
      );
    }

    if (_timedOut) break;
    if (result && result.move !== null && !result.failedLow && !result.failedHigh) {
      bestMove = result.move;
      lastScore = result.score;
      completedDepth = depth;
    }
    if (lastScore > 500_000) break;
  }

  const ms = Date.now() - started;
  const tag = _superMode ? (_smpHelper ? 'super-h' : 'super') : 'strong';
  console.info(`[DSC ${tag}] depth=${completedDepth} nodes=${_nodes} score=${lastScore} ms=${ms}`);

  return { move: bestMove, completedDepth, score: lastScore, nodes: _nodes };
}

export function findBestMoveIterativeStrong(data: AIWorkerData, timeLimitMs: number): AIMove {
  _superMode = false;
  _smpHelper = false;
  return searchIterative(data, timeLimitMs).move;
}

export function findBestMoveIterativeSuperStats(
  data: AIWorkerData,
  timeLimitMs: number,
): StrongSearchStats {
  _superMode = true;
  _smpHelper = data.smpHelper === true;
  try {
    return searchIterative(data, timeLimitMs);
  } finally {
    _superMode = false;
    _smpHelper = false;
  }
}

export function findBestMoveIterativeSuper(data: AIWorkerData, timeLimitMs: number): AIMove {
  return findBestMoveIterativeSuperStats(data, timeLimitMs).move;
}

export function pickSuperSmpStats(
  main: StrongSearchStats,
  helper: StrongSearchStats | null,
): StrongSearchStats {
  if (!helper) return main;
  if (helper.completedDepth > main.completedDepth) return helper;
  if (helper.completedDepth < main.completedDepth) return main;
  return helper.score > main.score ? helper : main;
}

