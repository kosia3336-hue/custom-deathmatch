import type { DummyAiTier } from '@shared/dummy.js';
import type {
  Cell,
  DoubleSidedChessAction,
  DoubleSidedChessGameData,
  Owner,
  PieceType,
} from '@shared/types/double-sided-chess.js';
import type { AIMove } from '../../socket/games/double-sided-chess/types.js';
import {
  applyMove,
  findBestMoveIterative,
  generateAllMoves,
} from '../../socket/games/double-sided-chess/ai.js';
import { findBestMoveIterativeStrong } from '../../socket/games/double-sided-chess/ai-strong.js';
import { runDscWorkerSearch } from '../../socket/games/double-sided-chess/state.js';
import {
  countNonKingPieces,
  hasAnyValidAction,
  isKingInOpponentTerritory,
} from '../../socket/games/double-sided-chess/board.js';

export interface DoubleSidedChessDummyView {
  gameOver: boolean;
  data: DoubleSidedChessGameData;
  turnNumber: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

function searchBudgetMs(tier: DummyAiTier): number {
  if (tier === '하') return 70;
  if (tier === '중') return 420;
  return 1800;
}

function oppOf(owner: Owner): Owner {
  return owner === 'first' ? 'second' : 'first';
}

/** 실제 방 종료 조건과 같음 (`checkWinAfterAction`). COM checkTerminal 보다 전멸이 넓다. */
export function isImmediateWin(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  justMoved: Owner,
  captured: PieceType | null,
): boolean {
  const opp = oppOf(justMoved);
  if (captured === 'king') return true;
  if (isKingInOpponentTerritory(board, justMoved)) return true;
  if (countNonKingPieces(board, opp) === 0) return true;
  if (!hasAnyValidAction(board, prisoners[opp], opp)) return true;
  return false;
}

export function movesEqual(a: AIMove, b: AIMove): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'move' && b.type === 'move') {
    return a.from.row === b.from.row
      && a.from.col === b.from.col
      && a.to.row === b.to.row
      && a.to.col === b.to.col;
  }
  if (a.type === 'place-prisoner' && b.type === 'place-prisoner') {
    return a.pieceType === b.pieceType
      && a.position.row === b.position.row
      && a.position.col === b.position.col;
  }
  return false;
}

function pickUniform<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function findImmediateWins(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
): AIMove[] {
  const out: AIMove[] = [];
  for (const move of generateAllMoves(board, prisoners, owner)) {
    const r = applyMove(board, prisoners, move, owner);
    if (isImmediateWin(r.board, r.prisoners, owner, r.captured)) out.push(move);
  }
  return out;
}

function opponentHasImmediateWin(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  myOwner: Owner,
): boolean {
  return findImmediateWins(board, prisoners, oppOf(myOwner)).length > 0;
}

/** 이 수를 둔 뒤 상대가 즉시 이기지 않는 수. 왕을 내주는 수도 여기 빠진다. */
export function findSafeMoves(
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  owner: Owner,
): AIMove[] {
  const out: AIMove[] = [];
  for (const move of generateAllMoves(board, prisoners, owner)) {
    const r = applyMove(board, prisoners, move, owner);
    if (isImmediateWin(r.board, r.prisoners, owner, r.captured)) continue;
    if (!opponentHasImmediateWin(r.board, r.prisoners, owner)) out.push(move);
  }
  return out;
}

function inList(move: AIMove, list: AIMove[]): boolean {
  return list.some((m) => movesEqual(m, move));
}

function searchBest(view: DoubleSidedChessDummyView, tier: DummyAiTier): AIMove {
  const d = view.data;
  const data = {
    board: d.board,
    prisoners: d.prisoners,
    currentOwner: d.currentOwner,
    turnNumber: view.turnNumber,
    lastMove: d.lastMove && d.lastMove.type === 'move' && d.lastMove.from
      ? { type: 'move' as const, from: d.lastMove.from, to: d.lastMove.to }
      : null,
  };
  if (tier === '상') return findBestMoveIterativeStrong(data, searchBudgetMs(tier));
  return findBestMoveIterative(data, searchBudgetMs(tier));
}

function applyTierNoise(best: AIMove, pool: AIMove[], tier: DummyAiTier): AIMove {
  if (pool.length === 1) return best;
  if (tier === '상') {
    if (Math.random() < 0.04) {
      const rest = pool.filter((m) => !movesEqual(m, best));
      if (rest.length > 0) return pickUniform(rest);
    }
    return best;
  }
  if (tier === '중') {
    if (Math.random() < 0.18) {
      const rest = pool.filter((m) => !movesEqual(m, best));
      if (rest.length > 0) return pickUniform(rest.slice(0, Math.min(3, rest.length)));
    }
    return best;
  }
  if (Math.random() < 0.55) return pickUniform(pool);
  return best;
}

function toAction(move: AIMove): DoubleSidedChessAction {
  if (move.type === 'move') return { type: 'move', from: move.from, to: move.to };
  return { type: 'place-prisoner', pieceType: move.pieceType, position: move.position };
}

function chooseMove(
  dummyId: string,
  view: DoubleSidedChessDummyView,
  tier: DummyAiTier,
  searched: AIMove | null,
): DoubleSidedChessAction | null {
  const d = view.data;
  if (view.gameOver || d.winner) return null;
  if (d.currentPlayer !== dummyId) return null;

  const owner = d.currentOwner;
  const board = d.board;
  const prisoners = d.prisoners;
  const legal = generateAllMoves(board, prisoners, owner);
  if (legal.length === 0) return null;

  const wins = findImmediateWins(board, prisoners, owner);
  if (wins.length > 0) return toAction(pickUniform(wins));

  const safe = findSafeMoves(board, prisoners, owner);
  const pool = safe.length > 0 ? safe : legal;
  if (searched && inList(searched, pool)) {
    return toAction(applyTierNoise(searched, pool, tier));
  }
  return toAction(applyTierNoise(pool[0]!, pool, tier));
}

/**
 * 수 품질만 가른다. 사고 시간은 thinkTime.ts (등급 무관).
 *
 * 공통: 즉시승, 상대 즉시승 차단, 왕 자폭 금지.
 * 하: 얕은 탐색 + 안전 수 안에서 노이즈.
 * 중: 보통 탐색, 근접 2순위 가끔.
 * 상: 강 탐색, 노이즈 거의 없음. 공개 보드만. COM 워커·owner 강수 아님.
 */
export function pickDoubleSidedChessAction(
  view: DoubleSidedChessDummyView,
  dummyId: string,
  tier: DummyAiTier,
): DoubleSidedChessAction | null {
  const wins = view.data.currentPlayer === dummyId
    ? findImmediateWins(view.data.board, view.data.prisoners, view.data.currentOwner)
    : [];
  if (wins.length > 0) {
    return chooseMove(dummyId, view, tier, wins[0]!);
  }
  const searched = searchBest(view, tier);
  return chooseMove(dummyId, view, tier, searched);
}

/**
 * 에이전트용. 중·상 탐색은 COM과 같은 워커에서 돌려 메인 스레드(턴 타이머)를 막지 않는다.
 * 하는 워커 없이 안전 풀만 고른다.
 */
export async function pickDoubleSidedChessActionAsync(
  view: DoubleSidedChessDummyView,
  dummyId: string,
  tier: DummyAiTier,
  roomId: string,
): Promise<DoubleSidedChessAction | null> {
  const d = view.data;
  if (view.gameOver || d.winner || d.currentPlayer !== dummyId) return null;

  const wins = findImmediateWins(d.board, d.prisoners, d.currentOwner);
  if (wins.length > 0) return toAction(pickUniform(wins));

  if (tier === '하') return chooseMove(dummyId, view, tier, null);

  const searched = await runDscWorkerSearch(roomId, {
    board: d.board,
    prisoners: d.prisoners,
    currentOwner: d.currentOwner,
    useStrong: tier === '상',
    timeLimitMs: searchBudgetMs(tier),
    turnNumber: view.turnNumber,
    lastMove: d.lastMove && d.lastMove.type === 'move' && d.lastMove.from
      ? { type: 'move', from: d.lastMove.from, to: d.lastMove.to }
      : null,
  });
  return chooseMove(dummyId, view, tier, searched);
}
