import type { DummyAiTier } from '@shared/dummy.js';
import type { FourGravityAction, FourGravityGameData, Direction } from '@shared/types/four-gravity.js';
import type { AIMove } from '../../socket/games/four-gravity/types.js';
import {
  findBestMoveIterative,
  getValidDirections,
} from '../../socket/games/four-gravity/ai.js';
import { findBestMoveIterativeStrong } from '../../socket/games/four-gravity/ai-strong.js';
import { applyGravity, cloneBoard, findMovedPosition, calcNeutralCandidates } from '../../socket/games/four-gravity/board.js';
import { checkWin, findExactFour } from '../../socket/games/four-gravity/win.js';
import {
  findImmediateWins,
  findSafeMoves,
  findNonSuicideMoves,
  pickUniform,
  type GravPair,
} from './four-gravity-tactics.js';

export interface FourGravityDummyView {
  gameOver: boolean;
  data: FourGravityGameData;
  lastGravityBlack: Direction | null;
  lastGravityWhite: Direction | null;
  turnNumber: number;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

function searchBudgetMs(tier: DummyAiTier): number {
  if (tier === '하') return 70;
  if (tier === '중') return 420;
  return 1800;
}

function searchBest(
  view: FourGravityDummyView,
  tier: DummyAiTier,
): AIMove {
  const d = view.data;
  const color = d.currentColor;
  const data = {
    board: d.board,
    currentColor: color,
    lastGravityBlack: view.lastGravityBlack,
    lastGravityWhite: view.lastGravityWhite,
    useStrong: false,
  };
  if (tier === '상') return findBestMoveIterativeStrong(data, searchBudgetMs(tier));
  return findBestMoveIterative(data, searchBudgetMs(tier));
}

function sameMove(a: AIMove, b: AIMove): boolean {
  return a.place.row === b.place.row
    && a.place.col === b.place.col
    && a.gravity === b.gravity
    && (a.neutral?.row ?? -1) === (b.neutral?.row ?? -1)
    && (a.neutral?.col ?? -1) === (b.neutral?.col ?? -1);
}

function inList(move: AIMove, list: AIMove[]): boolean {
  return list.some((m) => sameMove(m, move));
}

/**
 * 수 품질만 가른다. 사고 시간은 thinkTime.ts (등급 무관).
 *
 * 공통: 즉시승, 상대 즉시승 차단, 노뉴트럴 자폭 금지.
 * 하: 얕은 탐색 + 안전 수 안에서 노이즈.
 * 중: 보통 탐색, 근접 2순위 가끔.
 * 상: 강 탐색, 노이즈 거의 없음.
 */
export function pickFourGravityAction(
  view: FourGravityDummyView,
  dummyId: string,
  tier: DummyAiTier,
  pending: AIMove | null,
): { action: FourGravityAction; pending: AIMove | null } | null {
  const d = view.data;
  if (view.gameOver || d.winner) return null;
  if (d.currentPlayer !== dummyId) return null;

  const grav: GravPair = {
    lastGravityBlack: view.lastGravityBlack,
    lastGravityWhite: view.lastGravityWhite,
  };

  if (d.phase === 'place') {
    const wins = findImmediateWins(d.board, d.currentColor, grav);
    let chosen: AIMove;
    if (wins.length > 0) {
      chosen = pickUniform(wins);
    } else {
      const safe = findSafeMoves(d.board, d.currentColor, grav);
      const legal = findNonSuicideMoves(d.board, d.currentColor, grav);
      const pool = safe.length > 0 ? safe : (legal.length > 0 ? legal : null);
      const searched = searchBest(view, tier);
      if (!pool) {
        chosen = searched;
      } else if (inList(searched, pool)) {
        chosen = applyTierNoise(searched, pool, tier);
      } else {
        chosen = applyTierNoise(pool[0]!, pool, tier);
      }
    }
    if (d.board[chosen.place.row]?.[chosen.place.col] !== 'empty') return null;
    return {
      action: { type: 'place', row: chosen.place.row, col: chosen.place.col },
      pending: chosen,
    };
  }

  if (d.phase === 'gravity') {
    const dir = pickGravity(view, pending, tier);
    return { action: { type: 'gravity', direction: dir }, pending };
  }

  if (d.phase === 'neutral') {
    const pos = pickNeutral(view, pending, tier);
    if (!pos) return null;
    return { action: { type: 'neutral', row: pos.row, col: pos.col }, pending: null };
  }

  return null;
}

function applyTierNoise(best: AIMove, pool: AIMove[], tier: DummyAiTier): AIMove {
  if (pool.length === 1) return best;
  if (tier === '상') {
    if (Math.random() < 0.04) {
      const rest = pool.filter((m) => !sameMove(m, best));
      if (rest.length > 0) return pickUniform(rest);
    }
    return best;
  }
  if (tier === '중') {
    if (Math.random() < 0.18) {
      const rest = pool.filter((m) => !sameMove(m, best));
      if (rest.length > 0) return pickUniform(rest.slice(0, Math.min(3, rest.length)));
    }
    return best;
  }
  // 하: 안전 풀 안에서 자주 빗나감. 즉시승/차단 풀이면 그 안에서만.
  if (Math.random() < 0.55) return pickUniform(pool);
  return best;
}

function pickGravity(
  view: FourGravityDummyView,
  pending: AIMove | null,
  tier: DummyAiTier,
): Direction {
  const d = view.data;
  const last = d.lastGravity;
  const dirs = getValidDirections(last);
  const placed = d.placedPosition;
  if (!placed) return pending?.gravity ?? dirs[0] ?? 'none';

  const classified = dirs.map((gravity) => {
    const b1 = cloneBoard(d.board);
    const b2 = applyGravity(b1, gravity);
    const wr = checkWin(b2, d.currentColor);
    if (wr?.winner === 'current') return { gravity, kind: 'win' as const };
    if (gravity !== 'none') {
      const mp = findMovedPosition(placed, gravity, b1, b2);
      const ncs = calcNeutralCandidates(placed, mp, b2);
      if (ncs.length === 0) return { gravity, kind: 'suicide' as const };
      for (const nc of ncs) {
        const b3 = cloneBoard(b2);
        b3[nc.row][nc.col] = 'neutral';
        const nw = checkWin(b3, d.currentColor);
        if (nw?.winner === 'current' || findExactFour(b3, 'neutral') !== null) {
          return { gravity, kind: 'win' as const };
        }
      }
    }
    return { gravity, kind: 'ok' as const };
  });

  const wins = classified.filter((c) => c.kind === 'win').map((c) => c.gravity);
  if (wins.length > 0) return pickUniform(wins);

  const ok = classified.filter((c) => c.kind === 'ok').map((c) => c.gravity);
  const pool = ok.length > 0 ? ok : dirs;
  const preferred = pending?.gravity && pool.includes(pending.gravity) ? pending.gravity : pool[0]!;

  if (tier === '하' && pool.length > 1 && Math.random() < 0.32) {
    return pickUniform(pool);
  }
  if (tier === '중' && pool.length > 1 && Math.random() < 0.12) {
    return pickUniform(pool);
  }
  return preferred;
}

function pickNeutral(
  view: FourGravityDummyView,
  pending: AIMove | null,
  tier: DummyAiTier,
): { row: number; col: number } | null {
  const cands = view.data.neutralCandidates;
  if (cands.length === 0) return null;

  const wins = cands.filter((p) => {
    const b = cloneBoard(view.data.board);
    b[p.row][p.col] = 'neutral';
    const nw = checkWin(b, view.data.currentColor);
    return nw?.winner === 'current' || findExactFour(b, 'neutral') !== null;
  });
  if (wins.length > 0) return pickUniform(wins);

  const match = pending?.neutral
    ? cands.find((c) => c.row === pending.neutral!.row && c.col === pending.neutral!.col)
    : null;
  if (tier === '하' && cands.length > 1 && Math.random() < 0.4) {
    return pickUniform(cands);
  }
  return match ?? cands[0]!;
}
