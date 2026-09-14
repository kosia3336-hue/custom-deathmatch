/* ──────────────────────────────────────────────────────────────
   Strong AI v2

   기존 ai.ts의 minimax + alpha-beta + iterative deepening 골격을
   그대로 유지하면서 안전하게 검증된 강화 기법만 추가:

   A. Transposition Table (Zobrist hashing)
   B. Move Ordering (TT best + 위협차단 + Killer + History + 중앙)
   C. 시간 최대 90초 + max depth 20
   D. 평가 함수 보강 (복수 위협 + 중력 정렬 잠재력)
   E. 즉시승/패배 root prescan
   F. Aspiration Window

   기획서: docs/four-gravity-strong-ai.md
────────────────────────────────────────────────────────────── */
import { BOARD_SIZE, DIRS_4 } from './constants.js';
import type { CellType, Direction, Position, AIMove } from './types.js';
import {
  cloneBoard,
  applyGravity,
  findMovedPosition,
  calcNeutralCandidates,
} from './board.js';
import { findExactFour, checkWin, hasEmptyCells } from './win.js';
import { getCandidateCells, getCandidateCellsSuper, getValidDirections, type AIWorkerData } from './ai.js';

let _timedOut = false;
let _deadline = Infinity;
let _superMode = false;
let _nodes = 0;
const TIME_MASK = 2047;

function searchCells(board: CellType[][]): Position[] {
  return _superMode ? getCandidateCellsSuper(board) : getCandidateCells(board);
}

function tickClock(): void {
  _nodes++;
  if ((_nodes & TIME_MASK) === 0 && Date.now() >= _deadline) {
    _timedOut = true;
  }
}

/* ─────────────── A. Transposition Table (Zobrist) ─────────────── */

function rand64(): bigint {
  const hi = BigInt((Math.random() * 0x100000000) >>> 0);
  const lo = BigInt((Math.random() * 0x100000000) >>> 0);
  return (hi << 32n) | lo;
}

const COLOR_INDEX: Record<CellType, number> = {
  empty: -1,
  black: 0,
  white: 1,
  neutral: 2,
};

const ZOBRIST_CELL: bigint[][][] = (() => {
  const arr: bigint[][][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    arr[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      arr[r][c] = [rand64(), rand64(), rand64()];
    }
  }
  return arr;
})();

const ZOBRIST_SIDE: bigint = rand64();

const DIR_INDEX_MAP: Record<string, number> = {
  up: 1, down: 2, left: 3, right: 4, none: 5,
};

function dirIdx(d: Direction | null): number {
  return d === null ? 0 : DIR_INDEX_MAP[d];
}

const ZOBRIST_LGB: bigint[] = Array.from({ length: 6 }, () => rand64());
const ZOBRIST_LGW: bigint[] = Array.from({ length: 6 }, () => rand64());

function hashKey(
  board: CellType[][],
  side: 'black' | 'white',
  lgB: Direction | null,
  lgW: Direction | null,
): bigint {
  let h = 0n;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = COLOR_INDEX[board[r][c]];
      if (idx >= 0) h ^= ZOBRIST_CELL[r][c][idx];
    }
  }
  if (side === 'white') h ^= ZOBRIST_SIDE;
  h ^= ZOBRIST_LGB[dirIdx(lgB)];
  h ^= ZOBRIST_LGW[dirIdx(lgW)];
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
  // depth-preferred replacement: 기존이 더 깊은 exact 결과면 보존
  const existing = TT.get(key);
  if (existing && existing.flag === 'exact' && existing.depth > entry.depth) return;
  if (TT.size >= TT_MAX_SIZE) TT.clear();
  TT.set(key, entry);
}

/* ─────────────── B-1. Killer Moves ─────────────── */

const MAX_KILLER_DEPTH = 32;
const killers: (AIMove | undefined)[][] = [];

function clearKillers(): void {
  for (let i = 0; i < MAX_KILLER_DEPTH; i++) killers[i] = [undefined, undefined];
}

function sameCellDir(a: AIMove, cell: Position, dir: Direction): boolean {
  return a.place.row === cell.row && a.place.col === cell.col && a.gravity === dir;
}

function recordKiller(depth: number, move: AIMove): void {
  if (depth < 0 || depth >= MAX_KILLER_DEPTH) return;
  const ks = killers[depth];
  if (!ks) return;
  const k0 = ks[0];
  if (k0 && sameCellDir(k0, move.place, move.gravity)) return;
  ks[1] = ks[0];
  ks[0] = move;
}

function isKillerCellDir(depth: number, cell: Position, dir: Direction): boolean {
  if (depth < 0 || depth >= MAX_KILLER_DEPTH) return false;
  const ks = killers[depth];
  if (!ks) return false;
  for (const k of ks) {
    if (k && sameCellDir(k, cell, dir)) return true;
  }
  return false;
}

/* ─────────────── B-2. History Heuristic ─────────────── */

const DIR_TO_IDX: Record<string, number> = { up: 0, down: 1, left: 2, right: 3, none: 4 };
const HISTORY_CAP = 100_000;
const historyTable = new Int32Array(BOARD_SIZE * BOARD_SIZE * 5);

function clearHistory(): void {
  historyTable.fill(0);
}

function historyIdx(cell: Position, dir: Direction): number {
  return (cell.row * BOARD_SIZE + cell.col) * 5 + DIR_TO_IDX[dir];
}

function recordHistory(cell: Position, dir: Direction, depth: number): void {
  const idx = historyIdx(cell, dir);
  const v = historyTable[idx] + depth * depth;
  historyTable[idx] = v > HISTORY_CAP ? HISTORY_CAP : v;
}

function getHistoryScore(cell: Position, dir: Direction): number {
  return historyTable[historyIdx(cell, dir)];
}

function recordCutoff(depth: number, move: AIMove): void {
  recordKiller(depth, move);
  recordHistory(move.place, move.gravity, depth);
}

/* ─────────────── E. 위협 검출 (상대 1수 즉시승) ─────────────── */

function detectThreatCells(
  board: CellType[][],
  threatColor: 'black' | 'white',
  threatLastGrav: Direction | null,
): boolean[] {
  const threats: boolean[] = new Array(BOARD_SIZE * BOARD_SIZE).fill(false);
  const cells = searchCells(board);
  const dirs = getValidDirections(threatLastGrav);

  for (const cell of cells) {
    if (board[cell.row][cell.col] !== 'empty') continue;
    for (const dir of dirs) {
      const b1 = cloneBoard(board);
      b1[cell.row][cell.col] = threatColor;
      const b2 = applyGravity(b1, dir);

      const gw = checkWin(b2, threatColor);
      if (gw && gw.winner === 'current') {
        threats[cell.row * BOARD_SIZE + cell.col] = true;
        for (const p of gw.line) threats[p.row * BOARD_SIZE + p.col] = true;
        continue;
      }

      if (dir !== 'none') {
        const mp = findMovedPosition(cell, dir, b1, b2);
        const ncands = calcNeutralCandidates(cell, mp, b2);
        for (const nc of ncands) {
          const bn = cloneBoard(b2);
          bn[nc.row][nc.col] = 'neutral';
          const nw = checkWin(bn, threatColor);
          if (nw && nw.winner === 'current') {
            threats[cell.row * BOARD_SIZE + cell.col] = true;
            for (const p of nw.line) threats[p.row * BOARD_SIZE + p.col] = true;
            break;
          }
          const nf = findExactFour(bn, 'neutral');
          if (nf !== null) {
            threats[cell.row * BOARD_SIZE + cell.col] = true;
            for (const p of nf) threats[p.row * BOARD_SIZE + p.col] = true;
            break;
          }
        }
      }
    }
  }

  return threats;
}

/* ─────────────── D. 평가 함수 (v3: 대각선 1.5×, 중립돌 대폭 강화, 포크 강화, 대각선 정렬 추가) ─────────────── */

export function evaluateStrong(board: CellType[][], aiColor: 'black' | 'white'): number {
  const oppColor: CellType = aiColor === 'black' ? 'white' : 'black';
  let score = 0;

  // 방향별 위협 카운터
  let myOpen4 = 0, myOpen3 = 0, myHalf3 = 0;
  let oppOpen4 = 0, oppOpen3 = 0, oppHalf3 = 0;
  // 대각선 전용
  let myDiagOpen3 = 0, oppDiagOpen3 = 0;

  // 행/열 카운트
  const myRowC: number[] = new Array(BOARD_SIZE).fill(0);
  const myColC: number[] = new Array(BOARD_SIZE).fill(0);
  const oppRowC: number[] = new Array(BOARD_SIZE).fill(0);
  const oppColC: number[] = new Array(BOARD_SIZE).fill(0);
  const neutralRowC: number[] = new Array(BOARD_SIZE).fill(0);
  const neutralColC: number[] = new Array(BOARD_SIZE).fill(0);

  // 대각선 카운트 (\ = d1, / = d2)
  const DIAG_SIZE = 2 * BOARD_SIZE - 1;
  const myDiag1: number[] = new Array(DIAG_SIZE).fill(0);
  const myDiag2: number[] = new Array(DIAG_SIZE).fill(0);
  const oppDiag1: number[] = new Array(DIAG_SIZE).fill(0);
  const oppDiag2: number[] = new Array(DIAG_SIZE).fill(0);
  const neutralDiag1: number[] = new Array(DIAG_SIZE).fill(0);
  const neutralDiag2: number[] = new Array(DIAG_SIZE).fill(0);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      const d1 = r - c + (BOARD_SIZE - 1); // \ 대각선
      const d2 = r + c;                     // / 대각선

      if (cell === aiColor) {
        myRowC[r]++; myColC[c]++;
        myDiag1[d1]++; myDiag2[d2]++;
      } else if (cell === oppColor) {
        oppRowC[r]++; oppColC[c]++;
        oppDiag1[d1]++; oppDiag2[d2]++;
      } else if (cell === 'neutral') {
        neutralRowC[r]++; neutralColC[c]++;
        neutralDiag1[d1]++; neutralDiag2[d2]++;
      }

      if (cell === 'empty') continue;

      for (const [dr, dc] of DIRS_4) {
        const pr = r - dr;
        const pc = c - dc;
        if (
          pr >= 0 && pr < BOARD_SIZE &&
          pc >= 0 && pc < BOARD_SIZE &&
          board[pr][pc] === cell
        ) continue;

        // 대각선 여부: DIRS_4 인덱스 2([1,1]) 와 3([1,-1])
        const isDiag = dr !== 0 && dc !== 0;
        // 대각선은 4방향 중력 모두에서 방어하기 어려우므로 1.5× 가중치
        const mult = isDiag ? 1.5 : 1.0;

        let len = 0;
        let nr = r;
        let nc = c;
        while (
          nr >= 0 && nr < BOARD_SIZE &&
          nc >= 0 && nc < BOARD_SIZE &&
          board[nr][nc] === cell
        ) {
          len++;
          nr += dr;
          nc += dc;
        }

        if (len >= 5) {
          // 5개 이상 연속 → findExactFour 불가(exactly 4만 인정), 승리 기회 차단
          if (cell === aiColor) score -= 500;
          else if (cell === oppColor) score += 200;
          continue;
        }

        const endOpen =
          nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 'empty';
        const startOpen =
          pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE && board[pr][pc] === 'empty';
        const openCount = (startOpen ? 1 : 0) + (endOpen ? 1 : 0);

        if (cell === aiColor) {
          if (len === 4) {
            score += 100_000;
            if (openCount > 0) myOpen4++;
          } else if (len === 3) {
            if (openCount === 2) {
              score += Math.round(2_000 * mult); // 대각선: 3000
              myOpen3++;
              if (isDiag) myDiagOpen3++;
            } else if (openCount === 1) {
              score += Math.round(200 * mult); // 대각선: 300
              myHalf3++;
            }
          } else if (len === 2) {
            score += Math.round(20 * mult); // 대각선: 30
          }
        } else if (cell === oppColor) {
          if (len === 4) {
            score -= 150_000;
            if (openCount > 0) oppOpen4++;
          } else if (len === 3) {
            if (openCount === 2) {
              score -= Math.round(3_000 * mult); // 대각선: 4500
              oppOpen3++;
              if (isDiag) oppDiagOpen3++;
            } else if (openCount === 1) {
              score -= Math.round(350 * mult); // 대각선: 525
              oppHalf3++;
            }
          } else if (len === 2) {
            score -= Math.round(30 * mult); // 대각선: 45
          }
        } else {
          // 중립돌 연속: 누구든 다음 수에 neutral 4목 완성 위험 → 매우 강한 패널티
          if (len === 3) score -= Math.round(30_000 * (isDiag ? 1.3 : 1.0)); // 대각선: 39000
          else if (len === 2) score -= Math.round(600 * (isDiag ? 1.5 : 1.0)); // 대각선: 900
        }
      }
    }
  }

  // ── 복수 위협(포크) 보너스 ──────────────────────────────────────────
  // AI 위협
  if (myOpen4 >= 1) score += 80_000;
  if (myOpen3 >= 2) score += 90_000;         // 열린 3 두 개 = 막을 수 없는 포크
  else if (myOpen3 === 1 && myHalf3 >= 2) score += 18_000;
  else if (myOpen3 === 1 && myHalf3 >= 1) score += 10_000;
  else if (myHalf3 >= 3) score += 4_500;
  else if (myHalf3 >= 2) score += 2_000;
  // 대각선 포크 추가 보너스
  if (myDiagOpen3 >= 2) score += 35_000;
  else if (myDiagOpen3 >= 1 && myOpen3 >= 2) score += 20_000;

  // 상대 위협
  if (oppOpen4 >= 1) score -= 100_000;
  if (oppOpen3 >= 2) score -= 140_000;       // 상대 포크 = 거의 패배
  else if (oppOpen3 === 1 && oppHalf3 >= 2) score -= 28_000;
  else if (oppOpen3 === 1 && oppHalf3 >= 1) score -= 16_000;
  else if (oppHalf3 >= 3) score -= 6_500;
  else if (oppHalf3 >= 2) score -= 2_800;
  // 상대 대각선 포크 추가 패널티
  if (oppDiagOpen3 >= 2) score -= 55_000;
  else if (oppDiagOpen3 >= 1 && oppOpen3 >= 1) score -= 30_000;

  // ── 중앙 제어 (5×5 영역, 거리별 가중치) ───────────────────────────
  const mid = Math.floor(BOARD_SIZE / 2);
  for (let r = mid - 2; r <= mid + 2; r++) {
    for (let c = mid - 2; c <= mid + 2; c++) {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
      const dist = Math.max(Math.abs(r - mid), Math.abs(c - mid));
      const w = dist === 0 ? 28 : dist === 1 ? 14 : 6;
      if (board[r][c] === aiColor) score += w;
      else if (board[r][c] === oppColor) score -= w;
    }
  }

  // ── 중력 정렬 잠재력: 행/열 (중립돌 없는 라인만) ───────────────────
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (neutralRowC[i] === 0) {
      if (myRowC[i] >= 2) score += (myRowC[i] - 1) * 35;
      if (oppRowC[i] >= 2) score -= (oppRowC[i] - 1) * 45;
    }
    if (neutralColC[i] === 0) {
      if (myColC[i] >= 2) score += (myColC[i] - 1) * 35;
      if (oppColC[i] >= 2) score -= (oppColC[i] - 1) * 45;
    }
  }

  // ── 대각선 정렬 잠재력 (신규) ────────────────────────────────────────
  // 중력으로 대각선을 직접 유지하기는 어렵지만,
  // 같은 대각선에 돌이 많을수록 경사 방향 위협이 강해짐
  for (let d = 0; d < DIAG_SIZE; d++) {
    if (neutralDiag1[d] === 0) {
      if (myDiag1[d] >= 2) score += (myDiag1[d] - 1) * 50;
      if (oppDiag1[d] >= 2) score -= (oppDiag1[d] - 1) * 65;
    }
    if (neutralDiag2[d] === 0) {
      if (myDiag2[d] >= 2) score += (myDiag2[d] - 1) * 50;
      if (oppDiag2[d] >= 2) score -= (oppDiag2[d] - 1) * 65;
    }
  }

  return score;
}

/* ─────────────── B-3. Move Ordering 함수 ─────────────── */

interface OrderedMove {
  cell: Position;
  dir: Direction;
  rank: number;
}

function rankMove(
  cell: Position,
  dir: Direction,
  ttBest: AIMove | undefined,
  killerDepth: number,
  threatMask: boolean[] | null,
): number {
  let r = 0;
  if (ttBest && sameCellDir(ttBest, cell, dir)) r += 10_000_000;
  if (threatMask && threatMask[cell.row * BOARD_SIZE + cell.col]) r += 5_000_000;
  if (isKillerCellDir(killerDepth, cell, dir)) r += 100_000;
  // History
  r += Math.min(getHistoryScore(cell, dir) >> 5, 8000);
  // 중앙 가까운 수
  const mid = Math.floor(BOARD_SIZE / 2);
  r += 16 - (Math.abs(cell.row - mid) + Math.abs(cell.col - mid));
  // 중력 방향 보너스: none은 후순위, 대각선 라인을 만드는 up/down/left/right 우선
  if (dir !== 'none') r += 3;
  // 대각선 경로(셀이 대각선상에 위치)를 우선: 양 대각선에 얼마나 집중되어 있는지
  const d1dist = Math.abs((cell.row - mid) - (cell.col - mid)); // \ 대각선에서의 거리
  const d2dist = Math.abs((cell.row - mid) + (cell.col - mid)); // / 대각선에서의 거리
  r += Math.max(0, 4 - Math.min(d1dist, d2dist)); // 주 대각선 근처 최대 +4
  return r;
}

function orderedMoves(
  board: CellType[][],
  curLastGrav: Direction | null,
  ttBest: AIMove | undefined,
  killerDepth: number,
  threatMask: boolean[] | null = null,
): OrderedMove[] {
  const cells = searchCells(board);
  const dirs = getValidDirections(curLastGrav);
  const out: OrderedMove[] = [];

  for (const cell of cells) {
    if (board[cell.row][cell.col] !== 'empty') continue;
    for (const dir of dirs) {
      out.push({ cell, dir, rank: rankMove(cell, dir, ttBest, killerDepth, threatMask) });
    }
  }
  out.sort((a, b) => b.rank - a.rank);
  return out;
}

/* ─────────────── Minimax (alpha-beta + TT) ─────────────── */

function minimaxV2(
  board: CellType[][],
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  lastGravBlack: Direction | null,
  lastGravWhite: Direction | null,
  aiColor: 'black' | 'white',
): number {
  if (_timedOut) return 0;
  if (_superMode) {
    tickClock();
    if (_timedOut) return 0;
  } else if (Date.now() >= _deadline) {
    _timedOut = true;
    return 0;
  }

  const curColor: 'black' | 'white' = isMax ? aiColor : (aiColor === 'black' ? 'white' : 'black');

  const wr = checkWin(board, curColor);
  if (wr) {
    const val = 100_000 + depth * 100;
    if (wr.winner === 'current') return isMax ? val : -val;
    return isMax ? -val : val;
  }
  if (!hasEmptyCells(board)) {
    return isMax ? -(100_000 + depth * 100) : (100_000 + depth * 100);
  }
  if (depth === 0) return evaluateStrong(board, aiColor);

  // TT lookup
  const key = hashKey(board, curColor, lastGravBlack, lastGravWhite);
  const ttHit = TT.get(key);
  let ttBest: AIMove | undefined;
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.flag === 'exact') return ttHit.score;
    if (ttHit.flag === 'lower' && ttHit.score >= beta) return ttHit.score;
    if (ttHit.flag === 'upper' && ttHit.score <= alpha) return ttHit.score;
  }
  if (ttHit) ttBest = ttHit.best;

  const curLastGrav = curColor === 'black' ? lastGravBlack : lastGravWhite;
  const moves = orderedMoves(board, curLastGrav, ttBest, depth);

  let best = isMax ? -Infinity : Infinity;
  let bestMove: AIMove | undefined;
  const origAlpha = alpha;
  const origBeta = beta;

  outer: for (const m of moves) {
    if (_timedOut) break;
    const { cell, dir } = m;

    const b1 = cloneBoard(board);
    b1[cell.row][cell.col] = curColor;
    const b2 = applyGravity(b1, dir);

    const newLgB = curColor === 'black' ? dir : lastGravBlack;
    const newLgW = curColor === 'white' ? dir : lastGravWhite;

    const gw = checkWin(b2, curColor);
    if (gw) {
      const val = 100_000 + depth * 100;
      const s = gw.winner === 'current' ? (isMax ? val : -val) : (isMax ? -val : val);
      if (isMax) {
        if (s > best) { best = s; bestMove = { place: cell, gravity: dir, neutral: null }; }
        if (best > alpha) alpha = best;
      } else {
        if (s < best) { best = s; bestMove = { place: cell, gravity: dir, neutral: null }; }
        if (best < beta) beta = best;
      }
      if (beta <= alpha) {
        if (bestMove) recordCutoff(depth, bestMove);
        break outer;
      }
      continue;
    }

    const mp = dir === 'none' ? cell : findMovedPosition(cell, dir, b1, b2);
    const ncands = dir === 'none' ? [] : calcNeutralCandidates(cell, mp, b2);

    if (dir !== 'none' && ncands.length === 0) {
      // 자살 수: 강한 페널티 (alpha-beta가 알아서 안 고름)
      const val = 100_000 + depth * 100;
      const s = isMax ? -val : val;
      if (isMax) {
        if (s > best) { best = s; bestMove = { place: cell, gravity: dir, neutral: null }; }
        if (best > alpha) alpha = best;
      } else {
        if (s < best) { best = s; bestMove = { place: cell, gravity: dir, neutral: null }; }
        if (best < beta) beta = best;
      }
      if (beta <= alpha) {
        if (bestMove) recordCutoff(depth, bestMove);
        break outer;
      }
      continue;
    }

    if (ncands.length === 0) {
      // dir === 'none'
      const s = minimaxV2(b2, depth - 1, alpha, beta, !isMax, newLgB, newLgW, aiColor);
      if (_timedOut) break outer;
      if (isMax) {
        if (s > best) { best = s; bestMove = { place: cell, gravity: dir, neutral: null }; }
        if (best > alpha) alpha = best;
      } else {
        if (s < best) { best = s; bestMove = { place: cell, gravity: dir, neutral: null }; }
        if (best < beta) beta = best;
      }
      if (beta <= alpha) {
        if (bestMove) recordCutoff(depth, bestMove);
        break outer;
      }
    } else {
      for (const nc of ncands) {
        if (_timedOut) break outer;
        const bn = cloneBoard(b2);
        bn[nc.row][nc.col] = 'neutral';

        if (findExactFour(bn, 'neutral') !== null) {
          // 중립 4목 즉시승
          const val = 100_000 + depth * 100;
          const s = isMax ? val : -val;
          if (isMax) {
            if (s > best) { best = s; bestMove = { place: cell, gravity: dir, neutral: nc }; }
            if (best > alpha) alpha = best;
          } else {
            if (s < best) { best = s; bestMove = { place: cell, gravity: dir, neutral: nc }; }
            if (best < beta) beta = best;
          }
          if (beta <= alpha) {
            if (bestMove) recordCutoff(depth, bestMove);
            break outer;
          }
          continue;
        }

        const s = minimaxV2(bn, depth - 1, alpha, beta, !isMax, newLgB, newLgW, aiColor);
        if (_timedOut) break outer;
        if (isMax) {
          if (s > best) { best = s; bestMove = { place: cell, gravity: dir, neutral: nc }; }
          if (best > alpha) alpha = best;
        } else {
          if (s < best) { best = s; bestMove = { place: cell, gravity: dir, neutral: nc }; }
          if (best < beta) beta = best;
        }
        if (beta <= alpha) {
          if (bestMove) recordCutoff(depth, bestMove);
          break outer;
        }
      }
    }
  }

  // TT store
  if (!_timedOut && bestMove) {
    let flag: TTFlag;
    if (best <= origAlpha) flag = 'upper';
    else if (best >= origBeta) flag = 'lower';
    else flag = 'exact';
    ttPut(key, { depth, score: best, flag, best: bestMove });
  }

  return best;
}

/* ─────────────── Root Search (aspiration window 지원) ─────────────── */

interface RootResult {
  move: AIMove | null;
  score: number;
  failedLow: boolean;
  failedHigh: boolean;
}

function findBestMoveAtDepthV2(
  board: CellType[][],
  aiColor: 'black' | 'white',
  lastGravBlack: Direction | null,
  lastGravWhite: Direction | null,
  depth: number,
  alphaIn: number,
  betaIn: number,
): RootResult {
  const lastGrav = aiColor === 'black' ? lastGravBlack : lastGravWhite;
  const dirs = getValidDirections(lastGrav);
  const oppColor: 'black' | 'white' = aiColor === 'black' ? 'white' : 'black';
  const oppLastGrav = aiColor === 'black' ? lastGravWhite : lastGravBlack;

  // E. 즉시승 prescan (자기 색 4목 또는 중립 4목)
  const cells = searchCells(board);
  for (const cell of cells) {
    if (board[cell.row][cell.col] !== 'empty') continue;
    for (const dir of dirs) {
      const b1 = cloneBoard(board);
      b1[cell.row][cell.col] = aiColor;
      const b2 = applyGravity(b1, dir);
      const gw = checkWin(b2, aiColor);
      if (gw && gw.winner === 'current') {
        return {
          move: { place: cell, gravity: dir, neutral: null },
          score: 999_999,
          failedLow: false,
          failedHigh: false,
        };
      }
      if (dir !== 'none') {
        const mp = findMovedPosition(cell, dir, b1, b2);
        const ncands = calcNeutralCandidates(cell, mp, b2);
        for (const nc of ncands) {
          const bn = cloneBoard(b2);
          bn[nc.row][nc.col] = 'neutral';
          const nw = checkWin(bn, aiColor);
          if ((nw && nw.winner === 'current') || findExactFour(bn, 'neutral') !== null) {
            return {
              move: { place: cell, gravity: dir, neutral: nc },
              score: 999_999,
              failedLow: false,
              failedHigh: false,
            };
          }
        }
      }
    }
  }

  // E. 위협 마스크 (상대 1수 즉시승 차단용 → ordering 부스트)
  const threatMask = detectThreatCells(board, oppColor, oppLastGrav);

  const rootKey = hashKey(board, aiColor, lastGravBlack, lastGravWhite);
  const rootTT = TT.get(rootKey);
  const moves = orderedMoves(board, lastGrav, rootTT?.best, depth, threatMask);

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  let alpha = alphaIn;
  const beta = betaIn;

  outer: for (const m of moves) {
    if (_timedOut) break;
    const { cell, dir } = m;

    const b1 = cloneBoard(board);
    b1[cell.row][cell.col] = aiColor;
    const b2 = applyGravity(b1, dir);

    const newLgB = aiColor === 'black' ? dir : lastGravBlack;
    const newLgW = aiColor === 'white' ? dir : lastGravWhite;

    const gw = checkWin(b2, aiColor);
    if (gw && gw.winner === 'current') {
      return {
        move: { place: cell, gravity: dir, neutral: null },
        score: 100_000 + depth * 100,
        failedLow: false,
        failedHigh: false,
      };
    }

    const mp = dir === 'none' ? cell : findMovedPosition(cell, dir, b1, b2);
    const ncands = dir === 'none' ? [] : calcNeutralCandidates(cell, mp, b2);

    // 자살 수는 root에서 bestMove로 절대 채택하지 않음 (즉사 방지)
    if (dir !== 'none' && ncands.length === 0) {
      continue;
    }

    if (ncands.length === 0) {
      const sc = minimaxV2(b2, depth, alpha, beta, false, newLgB, newLgW, aiColor);
      if (_timedOut) break outer;
      if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: null }; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break outer;
    } else {
      for (const nc of ncands) {
        if (_timedOut) break outer;
        const bn = cloneBoard(b2);
        bn[nc.row][nc.col] = 'neutral';

        const nw = checkWin(bn, aiColor);
        if (nw && nw.winner === 'current') {
          return {
            move: { place: cell, gravity: dir, neutral: nc },
            score: 100_000 + depth * 100,
            failedLow: false,
            failedHigh: false,
          };
        }
        if (findExactFour(bn, 'neutral') !== null) {
          return {
            move: { place: cell, gravity: dir, neutral: nc },
            score: 100_000 + depth * 100,
            failedLow: false,
            failedHigh: false,
          };
        }

        const sc = minimaxV2(bn, depth, alpha, beta, false, newLgB, newLgW, aiColor);
        if (_timedOut) break outer;
        if (sc > bestScore) { bestScore = sc; bestMove = { place: cell, gravity: dir, neutral: nc }; }
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) break outer;
      }
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    failedLow: bestScore <= alphaIn,
    failedHigh: bestScore >= betaIn,
  };
}

/* ─────────────── F. Iterative Deepening + Aspiration Window ─────────────── */

// 평가값 스케일이 커졌으므로 초기 창도 확대
const ASPIR_INIT = 200;
const ASPIR_MAX = 8_000;

export function findBestMoveIterativeStrong(data: AIWorkerData, timeLimitMs: number): AIMove {
  _deadline = Date.now() + timeLimitMs;
  _timedOut = false;
  _nodes = 0;
  if (!_superMode) {
    TT.clear();
    clearKillers();
    clearHistory();
  }

  const { board, currentColor: aiColor, lastGravityBlack, lastGravityWhite } = data;
  const lastGrav = aiColor === 'black' ? lastGravityBlack : lastGravityWhite;
  const dirs = getValidDirections(lastGrav);
  const cells = searchCells(board);

  // 안전한 초기 fallback: 돌이 실제로 움직이고 ncands>0인 수
  let bestMove: AIMove = (() => {
    for (const cell of cells) {
      if (board[cell.row][cell.col] !== 'empty') continue;
      for (const dir of dirs) {
        if (dir === 'none') continue;
        const b1 = cloneBoard(board);
        b1[cell.row][cell.col] = aiColor;
        const b2 = applyGravity(b1, dir);
        const mp = findMovedPosition(cell, dir, b1, b2);
        const ncs = calcNeutralCandidates(cell, mp, b2);
        if (ncs.length > 0) return { place: cell, gravity: dir, neutral: ncs[0] };
      }
    }
    // 모든 방향에서 ncands=0이면 'none' 방향 fallback
    const firstEmpty = cells.find(c => board[c.row][c.col] === 'empty') ?? { row: 4, col: 4 };
    return { place: firstEmpty, gravity: 'none' as Direction, neutral: null };
  })();

  let lastScore = 0;
  let completedDepth = 0;
  const started = Date.now();
  const maxDepth = _superMode ? 24 : 20;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() >= _deadline) break;

    let result: RootResult | null = null;

    if (_superMode) {
      _timedOut = false;
      result = findBestMoveAtDepthV2(
        board, aiColor, lastGravityBlack, lastGravityWhite,
        depth, -Infinity, Infinity,
      );
      if (_timedOut) break;
      if (result.move !== null) {
        bestMove = result.move;
        lastScore = result.score;
        completedDepth = depth;
      }
      continue;
    }

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

    for (let attempt = 0; attempt < 4; attempt++) {
      if (Date.now() >= _deadline) break;
      _timedOut = false;

      result = findBestMoveAtDepthV2(
        board, aiColor, lastGravityBlack, lastGravityWhite,
        depth, alpha, beta,
      );

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
      completedDepth = depth;
    }
  }

  console.info(
    `[FG ${_superMode ? 'super' : 'strong'}] depth=${completedDepth} nodes=${_nodes} score=${lastScore} ms=${Date.now() - started}`,
  );

  return bestMove;
}

export function findBestMoveIterativeSuper(data: AIWorkerData, timeLimitMs: number): AIMove {
  _superMode = true;
  try {
    return findBestMoveIterativeStrong(data, timeLimitMs);
  } finally {
    _superMode = false;
  }
}
