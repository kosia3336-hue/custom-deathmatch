import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyTripleGomokuAction,
  areTripleGomokuAdjacent,
  canMoveTripleGomokuStone,
  canPlaceTripleGomokuSetup,
  findTripleGomokuWin,
  isTripleGomokuCell,
  tripleGomokuCells,
  tripleGomokuNeighbors,
  tripleGomokuPosition,
  TG_CENTER,
} from '@shared/logic/triple-gomoku.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import {
  TG_BOARD_RADIUS,
  TG_SETUP_SEQUENCE,
  TG_STONES_PER_PLAYER,
  type TripleGomokuBoard,
  type TripleGomokuCell,
} from '@shared/types/triple-gomoku.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { chooseTripleGomokuAiAction } from '../socket/games/triple-gomoku/ai.js';
import {
  cleanupTripleGomoku,
  handleTripleGomokuAction,
  initTripleGomoku,
} from '../socket/games/triple-gomoku/index.js';
import { tripleGomokuStates } from '../socket/games/triple-gomoku/state.js';
import { sessions } from '../store/sessions.js';

const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupTripleGomoku(roomId);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: false, isReady: true, joinedAt: Date.now() };
}

function ioStub() {
  return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
}

function socketFor(playerId: string) {
  const socketId = `socket-${playerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, playerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket;
}

function boardOf(entries: [TripleGomokuCell, string[]][]): TripleGomokuBoard {
  const board: TripleGomokuBoard = {};
  for (const [cell, stack] of entries) board[`${cell.q},${cell.r}`] = [...stack];
  return board;
}

/** 한 축을 따라 이어지는 칸들. */
function line(start: TripleGomokuCell, dq: number, dr: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    q: start.q + dq * index,
    r: start.r + dr * index,
  }));
}

describe('삼층 오목 판 기하', () => {
  it('반지름 5 육각판은 91칸이고 가로 11줄이다', () => {
    const cells = tripleGomokuCells();
    expect(cells).toHaveLength(3 * TG_BOARD_RADIUS ** 2 + 3 * TG_BOARD_RADIUS + 1);
    expect(cells).toHaveLength(91);
    expect(new Set(cells.map((cell) => cell.r)).size).toBe(11);
    const widest = cells.filter((cell) => cell.r === 0);
    expect(widest).toHaveLength(11);
  });

  it('판 안팎을 구분하고 모서리 칸은 이웃이 3개다', () => {
    expect(isTripleGomokuCell({ q: 0, r: 0 })).toBe(true);
    expect(isTripleGomokuCell({ q: 5, r: -5 })).toBe(true);
    expect(isTripleGomokuCell({ q: 5, r: 1 })).toBe(false);
    expect(isTripleGomokuCell({ q: 0.5, r: 0 })).toBe(false);
    expect(isTripleGomokuCell(null)).toBe(false);
    expect(tripleGomokuNeighbors(TG_CENTER)).toHaveLength(6);
    expect(tripleGomokuNeighbors({ q: 5, r: -5 })).toHaveLength(3);
  });

  it('모든 칸의 화면 좌표가 0~1 안에 들어온다', () => {
    for (const cell of tripleGomokuCells()) {
      const { x, y } = tripleGomokuPosition(cell);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    expect(tripleGomokuPosition(TG_CENTER)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('삼층 오목 승리 판정', () => {
  it('맨 위 돌 다섯 개가 일직선이면 오목이다', () => {
    const board = boardOf(line({ q: -2, r: 0 }, 1, 0, 5).map((cell) => [cell, ['a']]));
    const win = findTripleGomokuWin(board, 'a');
    expect(win?.type).toBe('line');
    expect(win?.cells).toHaveLength(5);
  });

  it('여섯 개가 이어지면 오목으로 인정하지 않는다', () => {
    const board = boardOf(line({ q: -3, r: 0 }, 1, 0, 6).map((cell) => [cell, ['a']]));
    expect(findTripleGomokuWin(board, 'a')).toBeNull();
  });

  it('세 축 모두에서 오목을 찾는다', () => {
    for (const [dq, dr] of [
      [1, 0],
      [0, 1],
      [1, -1],
    ]) {
      const board = boardOf(line({ q: 0, r: 0 }, dq, dr, 5).map((cell) => [cell, ['a']]));
      expect(findTripleGomokuWin(board, 'a')?.type).toBe('line');
    }
  });

  it('밑에 깔린 돌은 오목으로 세지 않는다', () => {
    const cells = line({ q: -2, r: 0 }, 1, 0, 5);
    const board = boardOf(cells.map((cell, index) => [cell, index === 2 ? ['a', 'b'] : ['a']]));
    expect(findTripleGomokuWin(board, 'a')).toBeNull();
  });

  it('3층 돌 다섯 개면 승리한다', () => {
    const spread: [TripleGomokuCell, string[]][] = [
      [{ q: -4, r: 0 }, ['b', 'b', 'a']],
      [{ q: 4, r: 0 }, ['b', 'b', 'a']],
      [{ q: 0, r: -4 }, ['b', 'b', 'a']],
      [{ q: 0, r: 4 }, ['b', 'b', 'a']],
      [{ q: -3, r: 3 }, ['b', 'b', 'a']],
    ];
    const board = boardOf(spread);
    const win = findTripleGomokuWin(board, 'a');
    expect(win?.type).toBe('top-count');
    expect(win?.cells).toHaveLength(5);
    // 3층 꼭대기가 상대 돌이면 세지 않는다
    expect(findTripleGomokuWin(board, 'b')).toBeNull();
  });

  it('서로 인접한 3층 돌 세 개면 승리한다', () => {
    const triangle: TripleGomokuCell[] = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
    ];
    expect(areTripleGomokuAdjacent(triangle[1], triangle[2])).toBe(true);
    const board = boardOf(triangle.map((cell) => [cell, ['b', 'b', 'a']]));
    expect(findTripleGomokuWin(board, 'a')?.type).toBe('top-cluster');
  });

  it('3층 돌 세 개라도 서로 떨어져 있으면 승리가 아니다', () => {
    const board = boardOf([
      [{ q: -4, r: 0 }, ['b', 'b', 'a']],
      [{ q: 4, r: 0 }, ['b', 'b', 'a']],
      [{ q: 0, r: 4 }, ['b', 'b', 'a']],
    ]);
    expect(findTripleGomokuWin(board, 'a')).toBeNull();
  });
});

describe('삼층 오목 이동 규칙', () => {
  it('인접한 칸으로만 옮길 수 있다', () => {
    const board = boardOf([[{ q: 0, r: 0 }, ['a']]]);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 1, r: 0 }, 'a')).toBe(true);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 2, r: 0 }, 'a')).toBe(false);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, TG_CENTER, 'a')).toBe(false);
  });

  it('맨 위 돌만 움직일 수 있다', () => {
    const board = boardOf([[{ q: 0, r: 0 }, ['a', 'b']]]);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 1, r: 0 }, 'b')).toBe(true);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 1, r: 0 }, 'a')).toBe(false);
  });

  it('원래 칸보다 높이 쌓인 칸으로는 갈 수 없다', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, ['a']],
      [{ q: 1, r: 0 }, ['b', 'b']],
      [{ q: 0, r: 1 }, ['b']],
    ]);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 1, r: 0 }, 'a')).toBe(false);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 0, r: 1 }, 'a')).toBe(true);
  });

  it('3층을 넘겨 쌓을 수 없다', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, ['a', 'a', 'a']],
      [{ q: 1, r: 0 }, ['b', 'b', 'b']],
    ]);
    expect(canMoveTripleGomokuStone(board, TG_CENTER, { q: 1, r: 0 }, 'a')).toBe(false);
  });

  it('돌을 옮기면 원래 칸의 아래 돌이 드러난다', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, ['b', 'a']],
      [{ q: 1, r: 0 }, ['b']],
    ]);
    const next = applyTripleGomokuAction(
      board,
      { type: 'move', from: TG_CENTER, to: { q: 1, r: 0 } },
      'a',
    );
    expect(next['0,0']).toEqual(['b']);
    expect(next['1,0']).toEqual(['b', 'a']);
  });
});

describe('삼층 오목 기본 배치', () => {
  it('정중앙과 자기 돌 옆에는 놓을 수 없다', () => {
    const board = boardOf([[{ q: 2, r: 0 }, ['a']]]);
    expect(canPlaceTripleGomokuSetup(board, TG_CENTER, 'a')).toBe(false);
    expect(canPlaceTripleGomokuSetup(board, { q: 3, r: 0 }, 'a')).toBe(false);
    expect(canPlaceTripleGomokuSetup(board, { q: 3, r: 0 }, 'b')).toBe(true);
    expect(canPlaceTripleGomokuSetup(board, { q: 2, r: 0 }, 'b')).toBe(false);
    expect(canPlaceTripleGomokuSetup(board, { q: 4, r: 0 }, 'a')).toBe(true);
  });

  it('1-2-2-1 순서로 각자 세 개씩 놓고 본 게임으로 넘어간다', () => {
    vi.useFakeTimers();
    const roomId = 'tg-setup';
    roomIds.add(roomId);
    const first = player('tg-first', '선');
    const second = player('tg-second', '후');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    initTripleGomoku(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = tripleGomokuStates.get(roomId)!;

    expect(TG_SETUP_SEQUENCE).toEqual([1, 2, 2, 1]);
    expect(state.phase).toBe('setup');
    expect(state.currentPlayerId).toBe(first.id);
    expect(state.setupRemaining).toBe(1);

    const order: [TypedSocket, TripleGomokuCell][] = [
      [firstSocket, { q: -4, r: 0 }],
      [secondSocket, { q: 4, r: 0 }],
      [secondSocket, { q: 0, r: 4 }],
      [firstSocket, { q: 0, r: -4 }],
      [firstSocket, { q: -3, r: -2 }],
      [secondSocket, { q: 3, r: 2 }],
    ];
    for (const [socket, to] of order) {
      handleTripleGomokuAction(io, socket, roomId, { type: 'place', to });
    }

    expect(state.phase).toBe('playing');
    expect(state.currentPlayerId).toBe(first.id);
    expect(state.reserves[first.id]).toBe(TG_STONES_PER_PLAYER - 3);
    expect(state.reserves[second.id]).toBe(TG_STONES_PER_PLAYER - 3);
    expect(Object.keys(state.board)).toHaveLength(6);
  });

  it('기본 배치에서는 돌을 옮길 수 없다', () => {
    vi.useFakeTimers();
    const roomId = 'tg-setup-move';
    roomIds.add(roomId);
    const first = player('sm-first', '선');
    const second = player('sm-second', '후');
    const socket = socketFor(first.id);
    const io = ioStub();
    initTripleGomoku(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = tripleGomokuStates.get(roomId)!;
    handleTripleGomokuAction(io, socket, roomId, { type: 'place', to: { q: -4, r: 0 } });
    handleTripleGomokuAction(io, socketFor(second.id), roomId, {
      type: 'move',
      from: { q: -4, r: 0 },
      to: { q: -3, r: 0 },
    });
    expect(state.board['-4,0']).toEqual([first.id]);
    expect(state.actionLog).toHaveLength(1);
  });
});

describe('삼층 오목 경기 진행', () => {
  function startPlaying(roomId: string, timeLimit: number | null = null) {
    roomIds.add(roomId);
    const first = player(`${roomId}-first`, '선');
    const second = player(`${roomId}-second`, '후');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    const onEnd = vi.fn();
    initTripleGomoku(io, roomId, [first, second], 'multi', Date.now(), timeLimit, onEnd);
    const state = tripleGomokuStates.get(roomId)!;
    // 기본 배치를 서로 멀리 떨어진 곳에서 끝낸다
    const order: [TypedSocket, TripleGomokuCell][] = [
      [firstSocket, { q: -5, r: 0 }],
      [secondSocket, { q: 5, r: 0 }],
      [secondSocket, { q: 5, r: -3 }],
      [firstSocket, { q: -5, r: 3 }],
      [firstSocket, { q: -2, r: 5 }],
      [secondSocket, { q: 2, r: -5 }],
    ];
    for (const [socket, to] of order) {
      handleTripleGomokuAction(io, socket, roomId, { type: 'place', to });
    }
    return { io, state, first, second, firstSocket, secondSocket, onEnd };
  }

  it('상대 턴에 보낸 행동은 거부한다', () => {
    vi.useFakeTimers();
    const { io, state, secondSocket } = startPlaying('tg-turn');
    const before = JSON.stringify(state.board);
    handleTripleGomokuAction(io, secondSocket, 'tg-turn', {
      type: 'place',
      to: { q: 0, r: 1 },
    });
    expect(JSON.stringify(state.board)).toBe(before);
  });

  it('오목을 완성하면 그 자리에서 이긴다', async () => {
    vi.useFakeTimers();
    const { io, state, first, firstSocket, secondSocket, onEnd } = startPlaying('tg-line');
    // 선이 한 줄을 채우는 동안 후는 멀리서 논다
    const targets = line({ q: -2, r: 0 }, 1, 0, 5);
    const idle: TripleGomokuCell[] = [
      { q: 3, r: -5 },
      { q: 4, r: -5 },
      { q: 3, r: -4 },
      { q: 4, r: -4 },
    ];
    for (let index = 0; index < targets.length; index += 1) {
      handleTripleGomokuAction(io, firstSocket, 'tg-line', { type: 'place', to: targets[index] });
      if (index < idle.length) {
        handleTripleGomokuAction(io, secondSocket, 'tg-line', { type: 'place', to: idle[index] });
      }
    }
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(first.id);
    expect(state.winType).toBe('line');
    expect(state.winCells).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0]?.[2]?.rankings?.[0]).toMatchObject({ playerId: first.id, rank: 1 });
  });

  it('내 수가 상대의 오목을 열어 주면 상대가 이긴다', () => {
    vi.useFakeTimers();
    const { io, state, second, firstSocket } = startPlaying('tg-reveal');
    // 후 플레이어의 네 칸을 미리 깔고, 다섯 번째 칸은 선의 돌로 덮어 둔다
    const cells = line({ q: -2, r: 0 }, 1, 0, 5);
    for (let index = 0; index < 4; index += 1) {
      state.board[`${cells[index].q},${cells[index].r}`] = [second.id];
    }
    state.board[`${cells[4].q},${cells[4].r}`] = [second.id, state.players[0].id];
    // 선이 덮고 있던 돌을 옆으로 치우면 후의 오목이 드러난다
    handleTripleGomokuAction(io, firstSocket, 'tg-reveal', {
      type: 'move',
      from: cells[4],
      to: { q: cells[4].q + 1, r: cells[4].r },
    });
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
    expect(state.winType).toBe('line');
  });

  it('같은 수에 양쪽 조건이 서면 행동한 쪽이 이긴다', () => {
    vi.useFakeTimers();
    const { io, state, first, firstSocket } = startPlaying('tg-tie');
    const second = state.players[1].id;
    // 선: 옮겨 놓으면 오목이 되는 자리 / 후: 그 돌이 빠지면 오목이 되는 자리
    const mine = line({ q: -2, r: 2 }, 1, 0, 5);
    for (let index = 0; index < 4; index += 1) {
      state.board[`${mine[index].q},${mine[index].r}`] = [first.id];
    }
    const theirs = line({ q: -2, r: 0 }, 1, 0, 5);
    for (let index = 0; index < 4; index += 1) {
      state.board[`${theirs[index].q},${theirs[index].r}`] = [second];
    }
    state.board[`${theirs[4].q},${theirs[4].r}`] = [second, first.id];
    // 선의 돌을 치우면 후의 오목이 드러나지만, 같은 수로 선의 오목도 완성된다
    state.board[`${mine[4].q},${mine[4].r}`] = [];
    delete state.board[`${mine[4].q},${mine[4].r}`];
    handleTripleGomokuAction(io, firstSocket, 'tg-tie', {
      type: 'move',
      from: theirs[4],
      to: { q: theirs[4].q, r: theirs[4].r + 2 },
    });
    // 인접하지 않은 이동은 거부되므로 판이 그대로여야 한다
    expect(state.gameOver).toBe(false);
  });

  it('제한시간을 넘기면 상대가 이긴다', async () => {
    vi.useFakeTimers();
    const { state, second } = startPlaying('tg-timeout', 10);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
    expect(state.winType).toBe('timeout');
  });
});

describe('삼층 오목 COM', () => {
  it('한 수로 이길 수 있으면 그 수를 고른다', () => {
    const board = boardOf([
      ...line({ q: -2, r: 0 }, 1, 0, 4).map(
        (cell) => [cell, [AI_PLAYER_ID]] as [TripleGomokuCell, string[]],
      ),
    ]);
    const action = chooseTripleGomokuAiAction({
      board,
      playerId: AI_PLAYER_ID,
      opponentId: 'human',
      phase: 'playing',
      reserve: 10,
      opponentReserve: 10,
      difficulty: 'normal',
    })!;
    // 네 칸이 이어져 있으므로 양쪽 끝 어디를 채워도 정확히 다섯 칸이 된다
    expect(action.type).toBe('place');
    const win = findTripleGomokuWin(
      applyTripleGomokuAction(board, action, AI_PLAYER_ID),
      AI_PLAYER_ID,
    );
    expect(win?.type).toBe('line');
  });

  it('기본 배치에서도 규칙에 맞는 자리를 고른다', () => {
    const board = boardOf([[{ q: 1, r: 0 }, [AI_PLAYER_ID]]]);
    const action = chooseTripleGomokuAiAction({
      board,
      playerId: AI_PLAYER_ID,
      opponentId: 'human',
      phase: 'setup',
      reserve: 24,
      opponentReserve: 25,
      difficulty: 'normal',
    })!;
    expect(action.type).toBe('place');
    if (action.type !== 'place') throw new Error('배치가 아님');
    expect(canPlaceTripleGomokuSetup(board, action.to, AI_PLAYER_ID)).toBe(true);
  });

  it('COM 이 실제 턴을 소화하고 차례를 넘긴다', async () => {
    vi.useFakeTimers();
    const roomId = 'tg-com';
    roomIds.add(roomId);
    const ai = player(AI_PLAYER_ID, 'COM');
    const human = player('tg-human', '사람');
    const io = ioStub();
    initTripleGomoku(io, roomId, [ai, human], 'com', Date.now(), null, vi.fn());
    const state = tripleGomokuStates.get(roomId)!;
    await vi.advanceTimersByTimeAsync(900);
    expect(state.actionLog).toHaveLength(1);
    expect(state.actionLog[0]).toMatchObject({ actorId: AI_PLAYER_ID, action: { type: 'place' } });
    expect(state.currentPlayerId).toBe(human.id);
  });
});
