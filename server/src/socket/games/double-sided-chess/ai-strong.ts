/* ──────────────────────────────────────────────────────────────
   Strong AI v2 (천하 솔로 모드 토글 전용; ownerToken !== null)

   기존 ai.ts의 minimax + alpha-beta + iterative deepening 골격을
   그대로 유지하면서 안전하게 검증된 강화 기법만 추가:

   A. 평가 함수 버그 수정 (왕 자살 첫 수, 왕 안전 약함, 왕 중앙)
   B. Transposition Table (Zobrist hashing)
   C. Move Ordering (TT best + 왕 캡처/진입 + MVV-LVA + 위협 + Killer + History + 중앙)
   D. 시간 90초 + max depth 20
   E. 양면장기 고유 평가 보강
       (승격 잠재력 / 슬라이더 위협 / 왕 진입 임박 / 이중 위협 / 포로 정교화 / PST / 왕 안전지대 / 템포)
   F. 즉시승/패배 root prescan
   G. Aspiration Window

   기획서: docs/double-sided-chess-strong-ai.md
────────────────────────────────────────────────────────────── */
import { DSC_BOARD_SIZE } from '@shared/types/double-sided-chess.js';
import type { Cell, PieceType, Owner, Position } from '@shared/types/double-sided-chess.js';
import {
  isKingInOpponentTerritory,
  countNonKingPieces,
  hasAnyValidAction,
} from './board.js';
import {
  generateAllMoves,
  applyMove,
  checkTerminal,
  cloneBoard,
  clonePrisoners,
  BASE_VALUE,
  PROMOTED_VALUE,
  pieceValue,
  type AIWorkerData,
} from './ai.js';
import type { AIMove } from './types.js';

let _timedOut = false;
let _deadline = Infinity;

/* 턴 카운트 (평가 함수에서 초반/중반/종반 분기) */
let _turnHint = 1;

/* ─────────────── B. Transposition Table (Zobrist) ─────────────── */

function rand64(): bigint {
  const hi = BigInt((Math.random() * 0x100000000) >>> 0);
  const lo = BigInt((Math.random() * 0x100000000) >>> 0);
  return (hi << 32n) | lo;
}

/**
 * 셀 인덱스 매핑:
 *   0~4: first 비승격 (king, infantry, gold, silver, copper)
 *   5~9: first 승격
 *   10~14: second 비승격
 *   15~19: second 승격
 *   (king은 항상 비승격이지만 인덱스는 부여; 사용 시 비승격 인덱스만 활성)
 */
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

const ZOBRIST_SIDE: bigint = rand64(); // currentOwner === 'second'면 XOR

/**
 * 포로 hash: 4종 비왕 기물 × 0~4 개수 × 2 owner = 40 슬롯
 */
const PRISONER_PIECES: PieceType[] = ['infantry', 'gold', 'silver', 'copper'];
const ZOBRIST_PRISONER: Record<Owner, Record<PieceType, bigint[]>> = (() => {
  const out: Record<Owner, Record<PieceType, bigint[]>> = {
    first: { king: [], infantry: [], gold: [], silver: [], copper: [] },
    second: { king: [], infantry: [], gold: [], silver: [], copper: [] },
  };
  for (const owner of ['first', 'second'] as Owner[]) {
    for (const p of PRISONER_PIECES) {
      const slots: bigint[] = [];
      for (let i = 0; i < 8; i++) slots.push(rand64()); // 최대 8개까지 안전
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

/* ─────────────── C-1. Killer Moves ─────────────── */

const MAX_KILLER_DEPTH = 32;
const killers: (AIMove | undefined)[][] = [];

function clearKillers(): void {
  for (let i = 0; i < MAX_KILLER_DEPTH; i++) killers[i] = [undefined, undefined];
}

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

/* ─────────────── C-2. History Heuristic ─────────────── */

const HISTORY_CAP = 100_000;
const N = DSC_BOARD_SIZE;
// move 인덱스: from(rc) -> to(rc) = 25 * 25 = 625
// place-prisoner 인덱스: piece(0~3) * 25 = 100
// 합쳐서 단일 배열로 관리
const historyMove = new Int32Array(N * N * N * N);
const historyDrop = new Int32Array(PRISONER_PIECES.length * N * N);

function clearHistory(): void {
  historyMove.fill(0);
  historyDrop.fill(0);
}

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

/* ─────────────── F. 위협 검출 (상대 1수 즉시승) ─────────────── */

/**
 * 상대가 다음 1수에 즉시 이길 수 있는 위협 위치들을 수집.
 * 즉시승 조건 = 내 왕 캡처 / 자기 왕 진영 진입 / 내 기물 전멸 / 내 합법 수 0
 * 반환: { kingAttackCells: 내 왕을 캡처할 수 있는 시작 위치 집합,
 *          entryThreatCells: 자기 왕이 다음 수에 우리 진영 진입 가능한 위치 집합 }
 */
function detectOpponentImmediateThreats(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  myOwner: Owner,
): { kingAttackerCells: Set<number>; entryByCell: Set<number> } {
  const oppOwner: Owner = myOwner === 'first' ? 'second' : 'first';
  const oppMoves = generateAllMoves(board, prisoners, oppOwner);
  const kingAttackerCells = new Set<number>();
  const entryByCell = new Set<number>();

  for (const m of oppMoves) {
    const r = applyMove(board, prisoners, m, oppOwner);
    const term = checkTerminal(r.board, r.prisoners, oppOwner, r.captured, 0, oppOwner);
    if (!term || term.score < 500_000) continue;

    if (m.type === 'move') {
      kingAttackerCells.add(m.from.row * N + m.from.col);
      // 이동 목표 칸도 위협으로 표시 (그 칸을 차단/캡처하면 막힐 수 있음)
      const toIdx = m.to.row * N + m.to.col;
      // 진영 진입 위협 — 자기 왕이 진입 row로 가는 수
      const cell = board[m.from.row]?.[m.from.col];
      if (cell?.piece === 'king') {
        entryByCell.add(toIdx);
      }
    }
  }

  return { kingAttackerCells, entryByCell };
}

/* ─────────────── E. 평가 함수 (Strong) ─────────────── */

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

/**
 * 기물이 합법 이동 후보를 최소 1개 갖는지 경량 체크.
 * getValidMoves 전체 배열 생성 없이 첫 번째 유효 이동만 확인.
 * 평가 함수 leaf 노드에서 승격 잠재력 체크 전용.
 */
function hasAnyValidMoveFast(board: Cell[][], row: number, col: number): boolean {
  const cell = board[row][col];
  if (!cell) return false;
  const owner = cell.owner;
  const fwd = owner === 'first' ? -1 : 1;
  const N = DSC_BOARD_SIZE;

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
  } else {
    switch (cell.piece) {
      case 'infantry': { // 룩
        const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = row + dr; const nc = col + dc;
          if (inBounds(nr, nc)) {
            if (!board[nr][nc] || board[nr][nc]!.owner !== owner) return true;
          }
        }
        return false;
      }
      case 'gold': { // 나이트
        const dirs: [number, number][] = [[fwd * 2, -1], [fwd * 2, 1], [fwd, -2], [fwd, 2]];
        return dirs.some(([dr, dc]) => canLand(row + dr, col + dc));
      }
      case 'silver': { // 비숍
        const dirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
          const nr = row + dr; const nc = col + dc;
          if (inBounds(nr, nc)) {
            if (!board[nr][nc] || board[nr][nc]!.owner !== owner) return true;
          }
        }
        return false;
      }
      case 'copper': { // 향차
        const nr = row + fwd; const nc = col;
        if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc]!.owner !== owner)) return true;
        return false;
      }
      default: return false;
    }
  }
}

/**
 * (fr, fc)의 기물이 (tr, tc)를 공격 가능한지 경량 체크.
 * getValidMoves 배열 생성 없이 직접 계산.
 */
function canAttackFast(board: Cell[][], fr: number, fc: number, tr: number, tc: number): boolean {
  const cell = board[fr][fc];
  if (!cell) return false;
  const owner = cell.owner;
  const fwd = owner === 'first' ? -1 : 1;
  const N = DSC_BOARD_SIZE;
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
        const dirs: [number, number][] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        return dirs.some(([dr, dc]) => fr + dr === tr && fc + dc === tc);
      }
      default: return false;
    }
  } else {
    switch (cell.piece) {
      case 'infantry': { // 룩: 같은 행 또는 같은 열, 사이에 기물 없음
        if (fr !== tr && fc !== tc) return false;
        if (fr === tr) {
          const minC = Math.min(fc, tc); const maxC = Math.max(fc, tc);
          for (let c = minC + 1; c < maxC; c++) if (board[fr][c]) return false;
          return true;
        }
        const minR = Math.min(fr, tr); const maxR = Math.max(fr, tr);
        for (let r = minR + 1; r < maxR; r++) if (board[r][fc]) return false;
        return true;
      }
      case 'gold': { // 나이트
        const dirs: [number, number][] = [[fwd * 2, -1], [fwd * 2, 1], [fwd, -2], [fwd, 2]];
        return dirs.some(([dr, dc]) => inBounds(fr + dr, fc + dc) && fr + dr === tr && fc + dc === tc);
      }
      case 'silver': { // 비숍: 대각선, 사이에 기물 없음
        const dr = tr - fr; const dc = tc - fc;
        if (Math.abs(dr) !== Math.abs(dc)) return false;
        const sr = dr > 0 ? 1 : -1; const sc = dc > 0 ? 1 : -1;
        let r = fr + sr; let c = fc + sc;
        while (r !== tr || c !== tc) {
          if (board[r][c]) return false;
          r += sr; c += sc;
        }
        return true;
      }
      case 'copper': { // 향차: 전방 직선
        if (fc !== tc) return false;
        const dir = fwd > 0 ? 1 : -1;
        if ((tr - fr) * dir <= 0) return false;
        const minR = Math.min(fr, tr); const maxR = Math.max(fr, tr);
        for (let r = minR + 1; r < maxR; r++) if (board[r][fc]) return false;
        return true;
      }
      default: return false;
    }
  }
}

/**
 * 왕 위협 카운트: opp의 어떤 기물이 owner 왕을 다음 수에 캡처 가능한가?
 */
function countKingAttackers(board: Cell[][], owner: Owner): number {
  const king = findKing(board, owner);
  if (!king) return 0;
  const opp: Owner = owner === 'first' ? 'second' : 'first';
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

/** PST: 비승격 보병/금/은/구리 — 적 진영 가까울수록 +. 5x5 단순 표 */
const PST_INFANTRY_FIRST: number[][] = [
  [ 0,  0,  0,  0,  0], // r=0 적 진영 (이미 도달)
  [10, 14, 18, 14, 10],
  [ 5,  8, 12,  8,  5],
  [ 0,  2,  4,  2,  0],
  [ 0,  0,  0,  0,  0], // r=4 자기 진영 시작
];
function pstInfantryFirst(r: number, c: number): number { return PST_INFANTRY_FIRST[r][c]; }
function pstInfantrySecond(r: number, c: number): number { return PST_INFANTRY_FIRST[DSC_BOARD_SIZE - 1 - r][c]; }

/** 왕 진입 row */
function kingEntryRow(owner: Owner): number {
  return owner === 'first' ? 0 : DSC_BOARD_SIZE - 1;
}

/** 자기 왕이 진입 임박? (한 칸만 가면 진입 row) */
function isKingNearEntry(board: Cell[][], owner: Owner): { imminent: boolean; targetClear: boolean } {
  const king = findKing(board, owner);
  if (!king) return { imminent: false, targetClear: false };
  const target = kingEntryRow(owner);
  const adjRow = owner === 'first' ? target + 1 : target - 1;
  if (king.row !== adjRow) return { imminent: false, targetClear: false };
  // 진입 가능 칸: target 행의 (kingC-1, kingC, kingC+1) 중 빈칸 또는 캡처 가능
  for (let dc = -1; dc <= 1; dc++) {
    const nc = king.col + dc;
    if (nc < 0 || nc >= DSC_BOARD_SIZE) continue;
    const t = board[target][nc];
    if (!t) return { imminent: true, targetClear: true };
  }
  // 빈칸은 없지만 적 기물 캡처는 가능할 수 있음 (왕 전진 차단 검토)
  return { imminent: true, targetClear: false };
}

/**
 * 승격 슬라이더가 상대 왕에게 직접 위협을 가하는지 라인 기반 평가.
 * 리턴: 자기 슬라이더의 적 왕 라인 위협 보너스 합 (양수: 자기에게 좋음).
 * canAttackFast를 활용해 getValidMoves 배열 생성을 제거.
 */
function sliderLineThreats(board: Cell[][], aiOwner: Owner): number {
  const opp: Owner = aiOwner === 'first' ? 'second' : 'first';
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

      if (canAttackFast(board, r, c, enemyKing.row, enemyKing.col)) {
        const sign = cell.owner === aiOwner ? 1 : -1;
        score += sign * 250;
      }
    }
  }
  void opp;
  return score;
}

export function evaluateStrong(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  aiOwner: Owner,
): number {
  const oppOwner: Owner = aiOwner === 'first' ? 'second' : 'first';
  let score = 0;

  // ① 기물 가치 + ② PST + 승격 잠재력
  let myMaterial = 0;
  let oppMaterial = 0;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      const val = pieceValue(cell.piece, cell.isPromoted);
      const sign = cell.owner === aiOwner ? 1 : -1;
      score += sign * val;
      if (cell.owner === aiOwner) myMaterial += val;
      else oppMaterial += val;

      // 왕은 PST/중앙 보너스 받지 않음 (전진 유인 방지) — 별도로 안전성만 평가
      if (cell.piece === 'king') continue;

      // 중앙 통제 — 왕 제외, (1,1)~(3,3)
      if (r >= 1 && r <= 3 && c >= 1 && c <= 3) {
        score += sign * 12;
      }

      // PST: 보병만 단순 적용 (다른 기물은 중앙 통제로 충분)
      if (cell.piece === 'infantry') {
        const pst = cell.owner === 'first' ? pstInfantryFirst(r, c) : pstInfantrySecond(r, c);
        score += sign * pst;
      }

      // 승격 잠재력: 비승격이고 합법 이동이 있으면 다음 수에 승격
      if (!cell.isPromoted) {
        const promotedV = PROMOTED_VALUE[cell.piece];
        const baseV = BASE_VALUE[cell.piece];
        const diff = promotedV - baseV;
        if (diff > 0 && hasAnyValidMoveFast(board, r, c)) {
          score += sign * Math.round(diff * 0.3);
        }
      }
    }
  }

  // ③ 슬라이더 라인 위협 (룩/비숍/향차)
  score += sliderLineThreats(board, aiOwner);

  // ④ 왕 안전 (이중 위협 폭발 페널티)
  const myAttackers = countKingAttackers(board, aiOwner);
  const oppAttackers = countKingAttackers(board, oppOwner);

  const attackerPenalty = (n: number): number => {
    if (n <= 0) return 0;
    if (n === 1) return 200;
    if (n === 2) return 800;
    return 2000;
  };

  score -= attackerPenalty(myAttackers);
  score += attackerPenalty(oppAttackers);

  // ⑤ 왕 진입 임박 (immediate-win one move away)
  const myEntry = isKingNearEntry(board, aiOwner);
  const oppEntry = isKingNearEntry(board, oppOwner);
  if (myEntry.imminent && myEntry.targetClear) score += 60_000;
  if (oppEntry.imminent && oppEntry.targetClear) score -= 80_000;

  // ⑥ 왕 전진은 후반에만 미세하게 — A-1 적용
  // 초반 (turn ≤ 8)에는 0, 중반엔 5/칸, 종반엔 15/칸
  const advanceCoef =
    _turnHint <= 8 ? 0 :
    _turnHint <= 16 ? 5 : 15;
  if (advanceCoef > 0) {
    for (let r = 0; r < DSC_BOARD_SIZE; r++) {
      for (let c = 0; c < DSC_BOARD_SIZE; c++) {
        const cell = board[r][c];
        if (!cell || cell.piece !== 'king') continue;
        const dist = cell.owner === 'first'
          ? (DSC_BOARD_SIZE - 1 - r)
          : r;
        const sign = cell.owner === aiOwner ? 1 : -1;
        score += sign * dist * advanceCoef;
      }
    }
  }

  // ⑦ 왕이 중앙 (2,2)에 있으면 추가 페널티 (가장 위험한 위치)
  for (const owner of [aiOwner, oppOwner] as Owner[]) {
    const k = findKing(board, owner);
    if (k && k.row === 2 && k.col === 2) {
      const sign = owner === aiOwner ? -1 : 1;
      score += sign * 30;
    }
  }

  // ⑧ 포로 가치 정교화 (비승격 base × 0.5 + 승격 후 base × 0.4)
  for (const owner of [aiOwner, oppOwner] as Owner[]) {
    const sign = owner === aiOwner ? 1 : -1;
    const backRowEmpty = (() => {
      const row = owner === 'first' ? DSC_BOARD_SIZE - 1 : 0;
      let n = 0;
      for (let c = 0; c < DSC_BOARD_SIZE; c++) if (!board[row][c]) n++;
      return n;
    })();
    const placeMult = backRowEmpty === 0 ? 0.3 : backRowEmpty >= 3 ? 1.1 : 1.0;
    for (const pt of prisoners[owner]) {
      if (pt === 'king') continue;
      const baseV = BASE_VALUE[pt];
      const promotedV = PROMOTED_VALUE[pt];
      const v = baseV * 0.5 + promotedV * 0.4;
      score += sign * Math.round(v * placeMult);
    }
  }

  // ⑨ 왕 안전지대 (왕 주변 8칸)
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
    score += sign * (defenders * 18 - Math.min(intrusion * 8, 50));
  }

  // ⑩ 템포 (마이너 효과)
  // (현재 턴 정보가 평가 함수엔 없으므로 0; minimax에서 isMax 사용)

  void myMaterial;
  void oppMaterial;
  return score;
}

/* ─────────────── C-3. Move Ordering ─────────────── */

interface RankedMove {
  move: AIMove;
  rank: number;
}

function rankMove(
  board: Cell[][],
  move: AIMove,
  ttBest: AIMove | undefined,
  killerDepth: number,
  threats: { kingAttackerCells: Set<number>; entryByCell: Set<number> } | null,
  aiOwner: Owner,
): number {
  let r = 0;

  if (ttBest && moveEquals(ttBest, move)) r += 10_000_000;

  // 왕 캡처 / 왕 진입 직접 보너스
  if (move.type === 'move') {
    const target = board[move.to.row][move.to.col];
    if (target && target.piece === 'king' && target.owner !== aiOwner) {
      r += 9_000_000;
    }
    const piece = board[move.from.row]?.[move.from.col];
    if (piece && piece.piece === 'king' && move.to.row === kingEntryRow(aiOwner)) {
      r += 8_000_000;
    }

    // MVV-LVA 캡처
    if (target && target.owner !== aiOwner) {
      const victim = pieceValue(target.piece, target.isPromoted);
      const attacker = piece ? pieceValue(piece.piece, piece.isPromoted) : 1;
      r += 1_000_000 + victim * 100 - Math.floor(attacker / 10);
    }

    // 위협 차단: 상대 왕 공격 기물이 있는 칸을 캡처/이동
    if (threats) {
      const fromIdx = move.from.row * N + move.from.col;
      const toIdx = move.to.row * N + move.to.col;
      if (threats.kingAttackerCells.has(toIdx)) r += 700_000;
      if (threats.entryByCell.has(toIdx)) r += 600_000;
      // 자기 왕을 옮겨서 위협 회피
      if (piece?.piece === 'king' && threats.entryByCell.size === 0) {
        // 자기 왕이 공격받는 위치에서 빠지면 좋음
        if (threats.kingAttackerCells.size > 0) r += 50_000;
      }
      void fromIdx;
    }
  } else {
    // 포로 배치: 강한 기물(보병→룩, 은→비숍) 우선
    const baseV = BASE_VALUE[move.pieceType];
    const promV = PROMOTED_VALUE[move.pieceType];
    r += 200_000 + Math.round((baseV + promV) / 4);
  }

  if (isKiller(killerDepth, move)) r += 100_000;
  r += Math.min(getHistoryScore(move) >> 5, 8000);

  // 중앙 가까운 수 (5×5 보드에서 (2,2) 가까울수록)
  const tr = move.type === 'move' ? move.to.row : move.position.row;
  const tc = move.type === 'move' ? move.to.col : move.position.col;
  const mid = Math.floor(DSC_BOARD_SIZE / 2);
  r += Math.max(0, 4 - (Math.abs(tr - mid) + Math.abs(tc - mid)));

  return r;
}

function orderedMoves(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
  ttBest: AIMove | undefined,
  killerDepth: number,
  threats: { kingAttackerCells: Set<number>; entryByCell: Set<number> } | null = null,
): RankedMove[] {
  const moves = generateAllMoves(board, prisoners, owner);
  const out: RankedMove[] = [];
  for (const m of moves) {
    out.push({ move: m, rank: rankMove(board, m, ttBest, killerDepth, threats, owner) });
  }
  out.sort((a, b) => b.rank - a.rank);
  return out;
}

/* ─────────────── Minimax (alpha-beta + TT) ─────────────── */

function minimaxV2(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  aiOwner: Owner,
): number {
  if (_timedOut) return 0;
  if (Date.now() >= _deadline) { _timedOut = true; return 0; }

  if (depth === 0) return evaluateStrong(board, prisoners, aiOwner);

  const curOwner: Owner = isMax ? aiOwner : (aiOwner === 'first' ? 'second' : 'first');

  // TT lookup
  const key = hashKey(board, curOwner, prisoners);
  const ttHit = TT.get(key);
  let ttBest: AIMove | undefined;
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.flag === 'exact') return ttHit.score;
    if (ttHit.flag === 'lower' && ttHit.score >= beta) return ttHit.score;
    if (ttHit.flag === 'upper' && ttHit.score <= alpha) return ttHit.score;
  }
  if (ttHit) ttBest = ttHit.best;

  const moves = orderedMoves(board, prisoners, curOwner, ttBest, depth);
  if (moves.length === 0) {
    // 이동 불가 = 즉시 패배 (현재 owner 입장)
    const val = 1_000_000 + depth * 1000;
    return isMax ? -val : val;
  }

  let best = isMax ? -Infinity : Infinity;
  let bestMove: AIMove | undefined;
  const origAlpha = alpha;
  const origBeta = beta;

  for (const { move } of moves) {
    if (_timedOut) break;

    const result = applyMove(board, prisoners, move, curOwner);
    const terminal = checkTerminal(result.board, result.prisoners, curOwner, result.captured, depth, aiOwner);

    let s: number;
    if (terminal) {
      s = terminal.score;
    } else {
      s = minimaxV2(result.board, result.prisoners, depth - 1, alpha, beta, !isMax, aiOwner);
      if (_timedOut) break;
    }

    if (isMax) {
      if (s > best) { best = s; bestMove = move; }
      if (best > alpha) alpha = best;
    } else {
      if (s < best) { best = s; bestMove = move; }
      if (best < beta) beta = best;
    }
    if (beta <= alpha) {
      if (bestMove) recordCutoff(depth, bestMove);
      break;
    }
  }

  if (!_timedOut && bestMove) {
    let flag: TTFlag;
    if (best <= origAlpha) flag = 'upper';
    else if (best >= origBeta) flag = 'lower';
    else flag = 'exact';
    ttPut(key, { depth, score: best, flag, best: bestMove });
  }

  return best;
}

/* ─────────────── F. Root + Aspiration Window ─────────────── */

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
  alphaIn: number,
  betaIn: number,
): RootResult {
  // F-1. 즉시승 prescan
  const moves = generateAllMoves(board, prisoners, aiOwner);
  for (const move of moves) {
    const result = applyMove(board, prisoners, move, aiOwner);
    const terminal = checkTerminal(result.board, result.prisoners, aiOwner, result.captured, depth, aiOwner);
    if (terminal && terminal.score > 500_000) {
      return { move, score: terminal.score, failedLow: false, failedHigh: false };
    }
  }

  // F-2. 위협 마스크
  const threats = detectOpponentImmediateThreats(board, prisoners, aiOwner);

  const rootKey = hashKey(board, aiOwner, prisoners);
  const rootTT = TT.get(rootKey);
  const ranked = orderedMoves(board, prisoners, aiOwner, rootTT?.best, depth, threats);

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  let alpha = alphaIn;
  const beta = betaIn;

  for (const { move } of ranked) {
    if (_timedOut) break;

    const result = applyMove(board, prisoners, move, aiOwner);
    const terminal = checkTerminal(result.board, result.prisoners, aiOwner, result.captured, depth, aiOwner);

    let s: number;
    if (terminal) {
      s = terminal.score;
    } else {
      s = minimaxV2(result.board, result.prisoners, depth - 1, alpha, beta, false, aiOwner);
      if (_timedOut) break;
    }

    if (s > bestScore) { bestScore = s; bestMove = move; }
    if (bestScore > alpha) alpha = bestScore;
    if (alpha >= beta) break;
  }

  return {
    move: bestMove,
    score: bestScore,
    failedLow: bestScore <= alphaIn,
    failedHigh: bestScore >= betaIn,
  };
}

const ASPIR_INIT = 200;
const ASPIR_MAX = 8_000;

export function findBestMoveIterativeStrong(data: AIWorkerData, timeLimitMs: number): AIMove {
  _deadline = Date.now() + timeLimitMs;
  _timedOut = false;
  TT.clear();
  clearKillers();
  clearHistory();

  const { board, prisoners, currentOwner: aiOwner } = data;

  // 턴 힌트: 보드 위 비왕 기물 개수로 거꾸로 추정 (초기 8개 → turn 1)
  const totalPieces = countNonKingPieces(board, 'first') + countNonKingPieces(board, 'second');
  _turnHint = Math.max(1, 1 + (8 - totalPieces) * 2);

  const fallbackMoves = generateAllMoves(board, prisoners, aiOwner);
  let bestMove: AIMove = fallbackMoves[0] ?? { type: 'move', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } };

  // 양쪽 모두에게 합법 수가 없는 corner case 방지
  if (fallbackMoves.length === 0) return bestMove;

  let lastScore = 0;

  for (let depth = 1; depth <= 20; depth++) {
    if (Date.now() >= _deadline) break;

    let aWindow = ASPIR_INIT;
    let alpha: number;
    let beta: number;
    if (depth <= 2) {
      alpha = -Infinity;
      beta = Infinity;
    } else {
      alpha = lastScore - aWindow;
      beta = lastScore + aWindow;
    }

    let result: RootResult | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      if (Date.now() >= _deadline) break;
      _timedOut = false;

      result = findBestMoveAtDepthV2(board, prisoners, aiOwner, depth, alpha, beta);
      if (_timedOut) break;
      if (!result.failedLow && !result.failedHigh) break;

      aWindow *= 4;
      if (aWindow > ASPIR_MAX || attempt >= 2) {
        alpha = -Infinity;
        beta = Infinity;
      } else if (result.failedLow) {
        alpha = lastScore - aWindow;
      } else {
        beta = lastScore + aWindow;
      }
    }

    if (_timedOut) break;
    if (result && result.move !== null && !result.failedLow && !result.failedHigh) {
      bestMove = result.move;
      lastScore = result.score;
    }

    // 결정적 즉시승은 더 이상 깊이 증가 의미 없음
    if (lastScore > 500_000) break;
  }

  return bestMove;
}

// 안전성을 위해 unused imports에 대한 ts 경고 회피
void hasAnyValidAction;
void isKingInOpponentTerritory;
