import { DSC_BOARD_SIZE } from '@shared/types/double-sided-chess.js';
import type { Cell, PieceType, Owner, Position } from '@shared/types/double-sided-chess.js';
import { nextIsPromoted, getValidMoves, getValidPrisonerPlacements } from '@shared/logic/double-sided-chess.js';
import { isKingInOpponentTerritory, countNonKingPieces, hasAnyValidAction } from './board.js';
import type { AIMove } from './types.js';

export interface AIWorkerData {
  board: Cell[][];
  prisoners: { first: PieceType[]; second: PieceType[] };
  currentOwner: Owner;
  useStrong?: boolean;
  useSuper?: boolean;
  /** 있으면 COM 워커 기본 5s/90s 대신 이 예산(ms)을 쓴다. 더미 상중하. */
  timeLimitMs?: number;
  /** 실제 턴. 강한 AI 초반/종반 평가용. */
  turnNumber?: number;
  /** 직전 수. 왕복(oscillation) 억제용. */
  lastMove?: AIMove | null;
}

/* ── 기물 가치 ── */

export const BASE_VALUE: Record<PieceType, number> = {
  king: 100_000,
  infantry: 400,
  copper: 450,
  silver: 500,
  gold: 600,
};

export const PROMOTED_VALUE: Record<PieceType, number> = {
  king: 100_000,
  infantry: 900,   // 비차 (룩)
  gold: 750,       // 계마 (나이트)
  silver: 800,     // 각행 (비숍)
  copper: 550,     // 향차 (랜스)
};

export function pieceValue(piece: PieceType, isPromoted: boolean): number {
  return isPromoted ? PROMOTED_VALUE[piece] : BASE_VALUE[piece];
}

/* ── 보드 복사 ── */

export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map(row => row.map(c => (c ? { ...c } : null)));
}

export function clonePrisoners(p: { first: PieceType[]; second: PieceType[] }) {
  return { first: [...p.first], second: [...p.second] };
}

/* ── 수 생성 ── */

export function generateAllMoves(board: Cell[][], prisoners: { first: PieceType[]; second: PieceType[] }, owner: Owner): AIMove[] {
  const moves: AIMove[] = [];

  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.owner !== owner) continue;
      const targets = getValidMoves(board, r, c);
      for (const to of targets) {
        moves.push({ type: 'move', from: { row: r, col: c }, to });
      }
    }
  }

  if (prisoners[owner].length > 0) {
    const placements = getValidPrisonerPlacements(board, owner);
    if (placements.length > 0) {
      const uniqueTypes = [...new Set(prisoners[owner])];
      for (const pt of uniqueTypes) {
        for (const pos of placements) {
          moves.push({ type: 'place-prisoner', pieceType: pt, position: pos });
        }
      }
    }
  }

  return moves;
}

/* ── 수 시뮬레이션 ── */

export interface ApplyResult {
  board: Cell[][];
  prisoners: { first: PieceType[]; second: PieceType[] };
  captured: PieceType | null;
}

export function applyMove(board: Cell[][], prisoners: { first: PieceType[]; second: PieceType[] }, move: AIMove, owner: Owner): ApplyResult {
  const b = cloneBoard(board);
  const p = clonePrisoners(prisoners);

  if (move.type === 'move') {
    const cell = b[move.from.row][move.from.col]!;
    const target = b[move.to.row][move.to.col];
    let captured: PieceType | null = null;

    if (target && target.owner !== owner) {
      captured = target.piece;
      if (captured !== 'king') {
        p[owner].push(captured);
      }
    }

    b[move.to.row][move.to.col] = {
      piece: cell.piece,
      owner: cell.owner,
      isPromoted: nextIsPromoted(cell.piece, cell.isPromoted),
    };
    b[move.from.row][move.from.col] = null;
    return { board: b, prisoners: p, captured };
  }

  // place-prisoner
  const idx = p[owner].indexOf(move.pieceType);
  if (idx !== -1) p[owner].splice(idx, 1);
  b[move.position.row][move.position.col] = { piece: move.pieceType, owner, isPromoted: false };
  return { board: b, prisoners: p, captured: null };
}

/* ── 종료 판정 ── */

export type TerminalResult = { score: number } | null;

export function checkTerminal(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  justMovedOwner: Owner,
  captured: PieceType | null,
  depth: number,
  aiOwner: Owner,
): TerminalResult {
  const opponent: Owner = justMovedOwner === 'first' ? 'second' : 'first';
  const winVal = 1_000_000 + depth * 1000;
  const isAIWin = justMovedOwner === aiOwner;

  if (captured === 'king') {
    return { score: isAIWin ? winVal : -winVal };
  }

  if (isKingInOpponentTerritory(board, justMovedOwner)) {
    return { score: isAIWin ? winVal : -winVal };
  }

  if (countNonKingPieces(board, opponent) === 0 && prisoners[opponent].length === 0) {
    return { score: isAIWin ? winVal : -winVal };
  }

  if (!hasAnyValidAction(board, prisoners[opponent], opponent)) {
    return { score: isAIWin ? winVal : -winVal };
  }

  return null;
}

/* ── 평가 함수 ── */

function evaluate(board: Cell[][], prisoners: { first: PieceType[]; second: PieceType[] }, aiOwner: Owner): number {
  const oppOwner: Owner = aiOwner === 'first' ? 'second' : 'first';
  let score = 0;

  // ① 기물 가치 + ② 위치 점수
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      const val = pieceValue(cell.piece, cell.isPromoted);
      const sign = cell.owner === aiOwner ? 1 : -1;
      score += sign * val;

      // 중앙 통제 보너스 (1,1)~(3,3)
      if (r >= 1 && r <= 3 && c >= 1 && c <= 3) {
        score += sign * 15;
      }

      // 왕 전진 보너스
      if (cell.piece === 'king') {
        if (cell.owner === 'first') {
          // first 왕: row가 작을수록 상대 진영에 가까움
          score += sign * (DSC_BOARD_SIZE - 1 - r) * 30;
        } else {
          // second 왕: row가 클수록 상대 진영에 가까움
          score += sign * r * 30;
        }
      }
    }
  }

  // ③ 이동성 점수
  let aiMobility = 0;
  let oppMobility = 0;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const moveCount = getValidMoves(board, r, c).length;
      if (cell.owner === aiOwner) aiMobility += moveCount;
      else oppMobility += moveCount;
    }
  }
  score += (aiMobility - oppMobility) * 8;

  // ④ 포로 점수 (80%)
  for (const pt of prisoners[aiOwner]) {
    score += BASE_VALUE[pt] * 0.8;
  }
  for (const pt of prisoners[oppOwner]) {
    score -= BASE_VALUE[pt] * 0.8;
  }

  // ⑤ 왕 안전 점수
  score += kingThreatScore(board, aiOwner, -50);
  score += kingThreatScore(board, oppOwner, 50);

  return score;
}

function kingThreatScore(board: Cell[][], owner: Owner, penalty: number): number {
  let kingR = -1;
  let kingC = -1;
  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell && cell.owner === owner && cell.piece === 'king') {
        kingR = r;
        kingC = c;
        break;
      }
    }
    if (kingR !== -1) break;
  }
  if (kingR === -1) return 0;

  let score = 0;
  const opp: Owner = owner === 'first' ? 'second' : 'first';

  for (let r = 0; r < DSC_BOARD_SIZE; r++) {
    for (let c = 0; c < DSC_BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.owner !== opp) continue;
      const moves = getValidMoves(board, r, c);
      if (moves.some(m => m.row === kingR && m.col === kingC)) {
        score += penalty;
      }
    }
  }

  return score;
}

/* ── Minimax + Alpha-Beta ── */

let _timedOut = false;
let _deadline = Infinity;

function minimax(
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

  const currentOwner: Owner = isMax ? aiOwner : (aiOwner === 'first' ? 'second' : 'first');

  if (depth === 0) return evaluate(board, prisoners, aiOwner);

  const moves = generateAllMoves(board, prisoners, currentOwner);
  if (moves.length === 0) {
    const val = 1_000_000 + depth * 1000;
    return isMax ? -val : val;
  }

  let best = isMax ? -Infinity : Infinity;

  for (const move of moves) {
    if (_timedOut) return best;

    const result = applyMove(board, prisoners, move, currentOwner);

    const terminal = checkTerminal(result.board, result.prisoners, currentOwner, result.captured, depth, aiOwner);
    if (terminal) {
      if (isMax) { best = Math.max(best, terminal.score); alpha = Math.max(alpha, best); }
      else { best = Math.min(best, terminal.score); beta = Math.min(beta, best); }
      if (beta <= alpha) return best;
      continue;
    }

    const s = minimax(result.board, result.prisoners, depth - 1, alpha, beta, !isMax, aiOwner);
    if (_timedOut) return best;

    if (isMax) { best = Math.max(best, s); alpha = Math.max(alpha, best); }
    else { best = Math.min(best, s); beta = Math.min(beta, best); }
    if (beta <= alpha) return best;
  }

  return best;
}

/* ── Root move selection ── */

function findBestMoveAtDepth(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  aiOwner: Owner,
  depth: number,
): AIMove | null {
  const moves = generateAllMoves(board, prisoners, aiOwner);
  if (moves.length === 0) return null;

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    if (_timedOut) return bestMove;

    const result = applyMove(board, prisoners, move, aiOwner);

    const terminal = checkTerminal(result.board, result.prisoners, aiOwner, result.captured, depth, aiOwner);
    if (terminal) {
      if (terminal.score > 500_000) return move;
      if (terminal.score > bestScore) { bestScore = terminal.score; bestMove = move; }
      alpha = Math.max(alpha, bestScore);
      continue;
    }

    const sc = minimax(result.board, result.prisoners, depth - 1, alpha, beta, false, aiOwner);
    if (_timedOut) return bestMove;

    if (sc > bestScore) { bestScore = sc; bestMove = move; }
    alpha = Math.max(alpha, bestScore);
  }

  return bestMove;
}

/* ── Iterative Deepening ── */

export function findBestMoveIterative(data: AIWorkerData, timeLimitMs: number): AIMove {
  _deadline = Date.now() + timeLimitMs;
  _timedOut = false;

  const { board, prisoners, currentOwner: aiOwner } = data;

  const moves = generateAllMoves(board, prisoners, aiOwner);
  let bestMove: AIMove = moves[0] ?? { type: 'move', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } };

  for (let depth = 1; depth <= 30; depth++) {
    if (Date.now() >= _deadline) break;
    _timedOut = false;
    const result = findBestMoveAtDepth(board, prisoners, aiOwner, depth);
    if (result !== null && !_timedOut) bestMove = result;
    if (_timedOut) break;
  }

  return bestMove;
}

/* ── Fallback (Worker 에러 시) ── */

export function getQuickFallbackMove(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
): AIMove {
  const moves = generateAllMoves(board, prisoners, owner);
  return moves[0] ?? { type: 'move', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } };
}
