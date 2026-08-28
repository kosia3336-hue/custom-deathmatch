import {
  applyKingmakingAction,
  canMoveKingmakingStack,
  kingmakingBoardPositionKey,
} from '@shared/logic/kingmaking.js';
import {
  KM_BOARD_SIZE,
  type KingmakingAction,
  type KingmakingBoard,
  type KingmakingPiece,
} from '@shared/types/kingmaking.js';
import type { KingmakingReserve } from './types.js';

function emptyPositions(board: KingmakingBoard) {
  const result: { row: number; col: number }[] = [];
  for (let row = 0; row < KM_BOARD_SIZE; row += 1) {
    for (let col = 0; col < KM_BOARD_SIZE; col += 1) {
      if (board[row][col].length === 0) result.push({ row, col });
    }
  }
  return result;
}

export function enumerateKingmakingActions(
  board: KingmakingBoard,
  reserve: { normal: number; special: number },
  actorId = 'simulated-player',
  forbiddenPositionKeys: ReadonlySet<string> = new Set(),
) {
  const actions: KingmakingAction[] = [];
  const addUnlessRepeated = (action: KingmakingAction) => {
    // 배치는 판 위 말 수가 늘어나므로 과거 배치를 재현할 수 없다.
    if (action.type === 'place' || forbiddenPositionKeys.size === 0) {
      actions.push(action);
      return;
    }
    const next = simulate(board, action, actorId);
    if (!forbiddenPositionKeys.has(kingmakingBoardPositionKey(next))) actions.push(action);
  };
  const empty = emptyPositions(board);
  if (reserve.normal > 0) {
    for (const to of empty) addUnlessRepeated({ type: 'place', kind: 'normal', to });
  }
  if (reserve.special > 0) {
    for (const to of empty) addUnlessRepeated({ type: 'place', kind: 'special', to });
  }
  for (let row = 0; row < KM_BOARD_SIZE; row += 1) {
    for (let col = 0; col < KM_BOARD_SIZE; col += 1) {
      const height = board[row][col].length;
      if (height === 0) continue;
      const from = { row, col };
      for (let count = 1; count <= Math.min(5, height); count += 1) {
        for (let toRow = 0; toRow < KM_BOARD_SIZE; toRow += 1) {
          for (let toCol = 0; toCol < KM_BOARD_SIZE; toCol += 1) {
            const to = { row: toRow, col: toCol };
            if (canMoveKingmakingStack(board, from, to, count)) {
              addUnlessRepeated({ type: 'move', from, to, count });
            }
          }
        }
      }
    }
  }
  return actions;
}

function simulatedPiece(actorId: string, kind: 'normal' | 'special'): KingmakingPiece {
  return { id: `sim-${actorId}-${kind}`, ownerId: actorId, kind };
}

function simulate(board: KingmakingBoard, action: KingmakingAction, actorId: string) {
  return applyKingmakingAction(
    board,
    action,
    action.type === 'place' ? simulatedPiece(actorId, action.kind) : undefined,
  );
}

function winnerAfter(board: KingmakingBoard, action: KingmakingAction) {
  const target = board[action.to.row][action.to.col];
  return target.length === 6 ? (target.at(-1)?.ownerId ?? null) : null;
}

function evaluateBoard(board: KingmakingBoard, aiId: string, opponentId: string) {
  let score = 0;
  for (const row of board) {
    for (const stack of row) {
      if (stack.length === 0) continue;
      const top = stack.at(-1)!;
      const value = stack.length ** 3 + (stack.length === 5 ? 800 : 0);
      score += top.ownerId === aiId ? value : top.ownerId === opponentId ? -value * 1.1 : 0;
      if (top.kind === 'special') {
        score += top.ownerId === aiId ? stack.length * 3 : -stack.length * 3;
      }
    }
  }
  return score;
}

function reserveCounts(reserve: KingmakingReserve) {
  return { normal: reserve.normal.length, special: reserve.special ? 1 : 0 };
}

/** 즉시 승리와 상대의 한 수 승리를 우선 계산하는 제한형 2수 탐색 AI. */
export function chooseKingmakingAiAction(
  board: KingmakingBoard,
  reserves: Record<string, KingmakingReserve>,
  aiId: string,
  opponentId: string,
  forbiddenPositionKeys: ReadonlySet<string> = new Set(),
) {
  const actions = enumerateKingmakingActions(
    board,
    reserveCounts(reserves[aiId]),
    aiId,
    forbiddenPositionKeys,
  );
  if (actions.length === 0) return null;

  let best: { action: KingmakingAction; score: number } | null = null;
  for (const action of actions) {
    const next = simulate(board, action, aiId);
    const winner = winnerAfter(next, action);
    if (winner === aiId) return action;
    if (winner === opponentId) continue;

    let score = evaluateBoard(next, aiId, opponentId);
    const nextPositionHistory = new Set(forbiddenPositionKeys);
    nextPositionHistory.add(kingmakingBoardPositionKey(next));
    const opponentActions = enumerateKingmakingActions(
      next,
      reserveCounts(reserves[opponentId]),
      opponentId,
      nextPositionHistory,
    );
    const opponentCanWin = opponentActions.some((reply) => {
      const replied = simulate(next, reply, opponentId);
      return winnerAfter(replied, reply) === opponentId;
    });
    if (opponentCanWin) score -= 100_000;
    if (action.type === 'place') {
      const centerDistance = Math.abs(action.to.row - 2) + Math.abs(action.to.col - 2);
      score += 5 - centerDistance;
      if (action.kind === 'special') score -= 12;
    }
    score += Math.random() * 0.01;
    if (!best || score > best.score) best = { action, score };
  }
  return best?.action ?? actions[0];
}
