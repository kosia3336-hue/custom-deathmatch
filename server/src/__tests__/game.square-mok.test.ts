import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { SquareMokBoard, SquareMokGameData } from '@shared/types/square-mok.js';
import {
  countSquareMokLines,
  createSquareMokBoard,
  decideSquareMok,
  findSquareMokSquares,
  scoreSquareMok,
  squareMokQuota,
  applySquareMokPlacement,
} from '@shared/logic/square-mok.js';
import {
  canSquareMokUndo,
  cleanupSquareMok,
  handleSquareMokAction,
  initSquareMok,
  performSquareMokUndo,
} from '../socket/games/square-mok/index.js';
import { squareMokStates } from '../socket/games/square-mok/state.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { sessions } from '../store/sessions.js';

/** 그림으로 판 만들기 — '타'=A, '헬'=B, 나머지 빈칸 */
function draw(rows: string[]): SquareMokBoard {
  return rows.map((row) => [...row].map((ch) => (ch === '타' ? 'A' : ch === '헬' ? 'B' : null)));
}

describe('사각목 정사각형 승점 (규칙 예시)', () => {
  it('붙은 네 칸 정사각형은 1점', () => {
    const b = draw([
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁㅁ타타ㅁㅁ',
      'ㅁㅁ타타ㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
    ]);
    expect(scoreSquareMok(b, 'A').points).toBe(1);
  });

  it('두 칸 간격 정사각형은 2×2=4점 (9점이 아님)', () => {
    const b = draw([
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁ타ㅁ타ㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁ타ㅁ타ㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
    ]);
    expect(scoreSquareMok(b, 'A').points).toBe(4);
  });

  it('돌아간 정사각형도 센다 — 5점', () => {
    const b = draw([
      'ㅁ타ㅁㅁㅁㅁ',
      'ㅁㅁㅁ타ㅁㅁ',
      '타ㅁㅁㅁㅁㅁ',
      'ㅁㅁ타ㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
    ]);
    const s = scoreSquareMok(b, 'A');
    expect(s.points).toBe(5);
    expect(s.squares).toHaveLength(1);
  });

  it('남의 말이 섞이면 아니다', () => {
    const b = draw([
      '타ㅁㅁㅁ헬ㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      '타ㅁㅁㅁ타ㅁ',
    ]);
    expect(scoreSquareMok(b, 'A').points).toBe(0);
  });

  it('3×3 꽉 찬 판: 1×1 네 개 + 2×2 하나 + 기울어진 (1,1) 하나 = 4+4+2 = 10점, 각 정사각형은 한 번만', () => {
    const b = draw([
      '타타타ㅁㅁㅁ',
      '타타타ㅁㅁㅁ',
      '타타타ㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
    ]);
    const s = scoreSquareMok(b, 'A');
    expect(s.squares.map((q) => q.area).sort()).toEqual([1, 1, 1, 1, 2, 4]);
    expect(s.points).toBe(10);
    expect(s.maxArea).toBe(4);
  });
});

describe('사각목 목 세기·동점', () => {
  it('딱 그 길이만 센다 — 육목은 오목이 아니다', () => {
    const b = draw([
      '타타타타타타',
      '타타타타타ㅁ',
      '타타타타ㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
      'ㅁㅁㅁㅁㅁㅁ',
    ]);
    const lines = countSquareMokLines(b, 'A');
    expect(lines.six).toBe(1);
    expect(lines.five).toBe(1);
    expect(lines.four).toBe(1);
  });

  it('승점 → 최대 정사각형 → 육목 → 오목 → 사목 → 무승부', () => {
    const base = { points: 5, maxArea: 4, squares: [], lines: { six: 0, five: 0, four: 0 } };
    expect(decideSquareMok({ A: { ...base, points: 6 }, B: base }, 'A', 'B')).toEqual({
      winnerId: 'A',
      decider: 'points',
    });
    expect(decideSquareMok({ A: base, B: { ...base, maxArea: 5 } }, 'A', 'B')).toEqual({
      winnerId: 'B',
      decider: 'max-square',
    });
    expect(
      decideSquareMok({ A: base, B: { ...base, lines: { six: 0, five: 1, four: 0 } } }, 'A', 'B')
        .decider,
    ).toBe('five');
    expect(decideSquareMok({ A: base, B: base }, 'A', 'B')).toEqual({
      winnerId: null,
      decider: 'draw',
    });
  });
});

describe('놓는 개수', () => {
  it('선 1 → 2개씩 → 마지막 1개, 두 사람 15개씩', () => {
    let board = createSquareMokBoard();
    const placed = { A: 0, B: 0 };
    let turn = 1;
    let who: 'A' | 'B' = 'A';
    const quotas: number[] = [];
    while (board.some((row) => row.some((v) => v === null))) {
      const q = squareMokQuota(turn, board);
      quotas.push(q);
      const empties = board
        .flatMap((row, r) => row.map((v, c) => (v === null ? { row: r, col: c } : null)))
        .filter(Boolean) as { row: number; col: number }[];
      board = applySquareMokPlacement(board, empties.slice(0, q), who);
      placed[who] += q;
      who = who === 'A' ? 'B' : 'A';
      turn += 1;
    }
    expect(quotas[0]).toBe(1);
    expect(quotas.at(-1)).toBe(1);
    expect(quotas.slice(1, -1).every((q) => q === 2)).toBe(true);
    expect(placed).toEqual({ A: 15, B: 15 });
    expect(quotas.length % 2).toBe(0); // 마지막은 후
  });
});

const ROOM = 'square-mok-room';
afterEach(() => {
  cleanupSquareMok(ROOM);
  for (const id of ['sq-a', 'sq-b']) sessions.removeSession(`sock-${id}`);
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('사각목 판 진행', () => {
  it('정해진 개수만 받고, 판이 차면 점수로 끝난다', async () => {
    vi.useFakeTimers();
    const sockets = ['sq-a', 'sq-b'].map((id) => {
      sessions.linkToken(`sock-${id}`, id);
      return { id: `sock-${id}`, emit: vi.fn() };
    });
    const io = {
      in: () => ({ fetchSockets: async () => sockets }),
      to: () => ({ emit: vi.fn() }),
    } as unknown as IO;
    const players = ['sq-a', 'sq-b'].map(
      (id, i) => ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: 0 }) as Player,
    );
    const end = vi.fn();
    initSquareMok(io, ROOM, players, 'multi', Date.now(), null, end);
    const send = (who: number, cells: { row: number; col: number }[]) =>
      handleSquareMokAction(io, sockets[who] as unknown as TypedSocket, ROOM, {
        type: 'place',
        cells,
      });

    // 첫 차례에 2개는 거절
    send(0, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(sockets[0].emit.mock.calls.some(([e]) => e === 'error')).toBe(true);
    // 상대 차례에 두기도 거절
    send(1, [{ row: 0, col: 0 }]);
    expect(squareMokStates.get(ROOM)!.history).toHaveLength(0);

    send(0, [{ row: 0, col: 0 }]);
    expect(canSquareMokUndo(ROOM)).toBe(true);
    performSquareMokUndo(io, ROOM);
    expect(squareMokStates.get(ROOM)!.board[0][0]).toBeNull();
    send(0, [{ row: 0, col: 0 }]);

    // 나머지는 차례대로 빈칸을 채운다: A 는 왼쪽 위 2×2 를 만든다
    const order: { row: number; col: number }[] = [];
    for (let r = 0; r < 5; r += 1)
      for (let c = 0; c < 6; c += 1) if (!(r === 0 && c === 0)) order.push({ row: r, col: c });
    // 후: (0,2),(0,3) / 선: (0,1),(1,0)... 간단히 순서대로 두되 A 가 (0,1),(1,0),(1,1) 을 갖게 배치
    const plan: Array<[number, { row: number; col: number }[]]> = [
      [
        1,
        [
          { row: 0, col: 2 },
          { row: 0, col: 3 },
        ],
      ],
      [
        0,
        [
          { row: 0, col: 1 },
          { row: 1, col: 0 },
        ],
      ],
      [
        1,
        [
          { row: 0, col: 4 },
          { row: 0, col: 5 },
        ],
      ],
      [
        0,
        [
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
      ],
    ];
    for (const [who, cells] of plan) send(who, cells);
    let st = squareMokStates.get(ROOM)!;
    const used = new Set(st.history.flatMap((h) => h.cells.map((c) => `${c.row},${c.col}`)));
    const rest = order.filter((c) => !used.has(`${c.row},${c.col}`));
    let who = 1;
    while (rest.length) {
      st = squareMokStates.get(ROOM)!;
      const q = Math.min(2, rest.length);
      send(who, rest.splice(0, q));
      who = 1 - who;
    }
    await vi.advanceTimersByTimeAsync(0);
    const view = sockets[1].emit.mock.calls.filter(([e]) => e === 'game:state').at(-1)![1]
      .gameData as SquareMokGameData;
    expect(view.phase).toBe('finished');
    expect(view.scores['sq-a'].points).toBeGreaterThanOrEqual(1);
    expect(view.board.flat().every((v) => v !== null)).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(end).toHaveBeenCalledOnce();
    const payload = end.mock.calls[0][2];
    expect(payload.rankings).toHaveLength(2);
  });
});

it('정사각형 탐색은 판 밖으로 나가지 않는다', () => {
  const b: SquareMokBoard = createSquareMokBoard().map((row) => row.map(() => 'A'));
  const squares = findSquareMokSquares(b, 'A');
  for (const s of squares)
    for (const c of s.cells) {
      expect(c.row).toBeGreaterThanOrEqual(0);
      expect(c.row).toBeLessThan(5);
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col).toBeLessThan(6);
    }
  expect(squares.length).toBeGreaterThan(40);
});
