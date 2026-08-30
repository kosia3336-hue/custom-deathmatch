import {
  applyTripleGomokuAction,
  areTripleGomokuAdjacent,
  canMoveTripleGomokuStone,
  canPlaceTripleGomokuSetup,
  findTripleGomokuWin,
  isTripleGomokuCell,
  tripleGomokuCells,
  tripleGomokuHeightAt,
  tripleGomokuNeighbors,
  tripleGomokuTopOwner,
  TG_CENTER,
} from '@shared/logic/triple-gomoku.js';
import type { AbstractAiDifficulty } from '@shared/types/game.js';
import {
  TG_LINE_LENGTH,
  TG_MAX_HEIGHT,
  type TripleGomokuAction,
  type TripleGomokuBoard,
  type TripleGomokuCell,
} from '@shared/types/triple-gomoku.js';

const LINE_AXES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, -1],
];

/** 창 안의 자기 돌 수에 따라 붙는 점수. 4개까지 차면 다음 수에 오목이 된다. */
const WINDOW_SCORE = [0, 1, 6, 30, 220];

export function enumerateTripleGomokuActions(
  board: TripleGomokuBoard,
  playerId: string,
  options: { phase: 'setup' | 'playing'; reserve: number },
): TripleGomokuAction[] {
  const actions: TripleGomokuAction[] = [];
  const cells = tripleGomokuCells();

  if (options.phase === 'setup') {
    for (const to of cells) {
      if (canPlaceTripleGomokuSetup(board, to, playerId)) actions.push({ type: 'place', to });
    }
    return actions;
  }

  if (options.reserve > 0) {
    for (const to of cells) {
      if (tripleGomokuHeightAt(board, to) === 0) actions.push({ type: 'place', to });
    }
  }
  for (const from of cells) {
    if (tripleGomokuTopOwner(board, from) !== playerId) continue;
    for (const to of tripleGomokuNeighbors(from)) {
      if (canMoveTripleGomokuStone(board, from, to, playerId)) {
        actions.push({ type: 'move', from, to });
      }
    }
  }
  return actions;
}

/** 다섯 칸짜리 창을 훑어 오목 가능성을 점수로 바꾼다. */
function lineScore(board: TripleGomokuBoard, playerId: string, opponentId: string) {
  let score = 0;
  for (const cell of tripleGomokuCells()) {
    for (const [dq, dr] of LINE_AXES) {
      let mine = 0;
      let blocked = false;
      for (let step = 0; step < TG_LINE_LENGTH; step += 1) {
        const next = { q: cell.q + dq * step, r: cell.r + dr * step };
        if (!isTripleGomokuCell(next)) {
          blocked = true;
          break;
        }
        const owner = tripleGomokuTopOwner(board, next);
        if (owner === opponentId) {
          blocked = true;
          break;
        }
        if (owner === playerId) mine += 1;
      }
      if (!blocked && mine > 0) score += WINDOW_SCORE[Math.min(mine, 4)];
    }
  }
  return score;
}

/** 3층 돌 개수와 인접 뭉침을 점수로 바꾼다. */
function towerScore(board: TripleGomokuBoard, playerId: string) {
  const topCells: TripleGomokuCell[] = [];
  let stacked = 0;
  for (const cell of tripleGomokuCells()) {
    const height = tripleGomokuHeightAt(board, cell);
    if (height === 0) continue;
    if (tripleGomokuTopOwner(board, cell) !== playerId) continue;
    if (height === TG_MAX_HEIGHT) topCells.push(cell);
    else if (height === 2) stacked += 1;
  }
  let score = topCells.length * 55 + stacked * 6;
  for (let i = 0; i < topCells.length; i += 1) {
    for (let j = i + 1; j < topCells.length; j += 1) {
      if (areTripleGomokuAdjacent(topCells[i], topCells[j])) score += 40;
    }
  }
  return score;
}

function centerBonus(cell: TripleGomokuCell) {
  const distance =
    (Math.abs(cell.q - TG_CENTER.q) +
      Math.abs(cell.r - TG_CENTER.r) +
      Math.abs(cell.q + cell.r - TG_CENTER.q - TG_CENTER.r)) /
    2;
  return 6 - distance;
}

function evaluate(board: TripleGomokuBoard, playerId: string, opponentId: string) {
  return (
    lineScore(board, playerId, opponentId) -
    lineScore(board, opponentId, playerId) * 1.05 +
    towerScore(board, playerId) -
    towerScore(board, opponentId) * 1.05
  );
}

function opponentCanWinNext(board: TripleGomokuBoard, opponentId: string, opponentReserve: number) {
  const replies = enumerateTripleGomokuActions(board, opponentId, {
    phase: 'playing',
    reserve: opponentReserve,
  });
  return replies.some((reply) =>
    findTripleGomokuWin(applyTripleGomokuAction(board, reply, opponentId), opponentId),
  );
}

/**
 * 즉시 승리 → 상대 즉시 승리 차단 → 휴리스틱 순으로 고르는 제한 탐색 AI.
 * hard 는 상위 후보에 한해 상대의 한 수 응수까지 확인한다.
 */
export function chooseTripleGomokuAiAction(input: {
  board: TripleGomokuBoard;
  playerId: string;
  opponentId: string;
  phase: 'setup' | 'playing';
  reserve: number;
  opponentReserve: number;
  difficulty: AbstractAiDifficulty;
}): TripleGomokuAction | null {
  const { board, playerId, opponentId, phase, reserve, opponentReserve, difficulty } = input;
  const actions = enumerateTripleGomokuActions(board, playerId, { phase, reserve });
  if (actions.length === 0) return null;

  const scored: { action: TripleGomokuAction; score: number; next: TripleGomokuBoard }[] = [];
  for (const action of actions) {
    const next = applyTripleGomokuAction(board, action, playerId);
    if (phase === 'playing' && findTripleGomokuWin(next, playerId)) return action;
    // 내 수가 상대의 오목을 열어 주면(밑에 깔린 돌이 드러나는 경우) 즉시 진다.
    if (phase === 'playing' && findTripleGomokuWin(next, opponentId)) continue;
    let score = evaluate(next, playerId, opponentId);
    if (action.type === 'place') score += centerBonus(action.to);
    score += Math.random() * 0.5;
    scored.push({ action, score, next });
  }
  if (scored.length === 0) return actions[0];
  scored.sort((a, b) => b.score - a.score);

  if (difficulty !== 'hard' || phase === 'setup') return scored[0].action;

  const lookahead = scored.slice(0, 10);
  for (const candidate of lookahead) {
    if (!opponentCanWinNext(candidate.next, opponentId, opponentReserve)) return candidate.action;
  }
  return scored[0].action;
}
