import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyEskimoAction,
  createEskimoBoard,
  eskimoMoveTargets,
  eskimoPositionKey,
  findEskimoSurround,
} from '@shared/logic/eskimo.js';
import { ESKIMO_BEAR, type EskimoBoard, type EskimoCell } from '@shared/types/eskimo.js';
import type { Player } from '@shared/types/room.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  canEskimoUndo,
  cleanupEskimo,
  handleEskimoAction,
  initEskimo,
  performEskimoUndo,
} from '../socket/games/eskimo/index.js';
import { eskimoStates } from '../socket/games/eskimo/state.js';
import { sessions } from '../store/sessions.js';

const A = 'es-a';
const B = 'es-b';
const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupEskimo(roomId);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
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
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket & {
    emit: ReturnType<typeof vi.fn>;
  };
}

function start(roomId: string, timeLimitSeconds: number | null = null) {
  const end = vi.fn();
  roomIds.add(roomId);
  initEskimo(
    ioStub(),
    roomId,
    [player(A, '선'), player(B, '후')],
    'multi',
    Date.now(),
    timeLimitSeconds,
    end,
  );
  return { state: eskimoStates.get(roomId)!, end };
}

function move(roomId: string, actor: string, from: EskimoCell, to: EskimoCell) {
  const socket = socketFor(actor);
  handleEskimoAction(ioStub(), socket, roomId, { type: 'move', from, to });
  return socket;
}

function emptyBoard(): EskimoBoard {
  return Array.from({ length: 5 }, () => Array<string | null>(5).fill(null));
}

const cell = (row: number, col: number) => ({ row, col });

describe('에스키모 판·이동 규칙', () => {
  it('선은 아래 줄, 후는 위 줄, 북극곰은 한가운데에서 시작한다', () => {
    const board = createEskimoBoard(A, B);
    expect(board[4]).toEqual([A, A, A, A, A]);
    expect(board[0]).toEqual([B, B, B, B, B]);
    expect(board[2][2]).toBe(ESKIMO_BEAR);
    expect(board.flat().filter((p) => p === null)).toHaveLength(14);
  });

  it('내 말은 막히기 직전까지 미끄러지고, 바로 막힌 방향으로는 못 간다', () => {
    const board = createEskimoBoard(A, B);
    // (4,0): 위로는 (1,0)까지(0행에 상대 말), 오른쪽 위 대각선은 (3,1)에서 곰 앞까지가 아니라
    // (3,1) → (2,2) 가 곰이라 (3,1)에서 멈춘다. 오른쪽·아래·왼쪽은 바로 막혀 없다.
    const targets = eskimoMoveTargets(board, cell(4, 0), A, false);
    expect(targets).toEqual(expect.arrayContaining([cell(1, 0), cell(3, 1)]));
    expect(targets).toHaveLength(2);
    // 남의 말·빈칸은 고를 수 없다
    expect(eskimoMoveTargets(board, cell(0, 0), A, false)).toEqual([]);
    expect(eskimoMoveTargets(board, cell(2, 0), A, false)).toEqual([]);
  });

  it('북극곰은 빈 이웃 한 칸씩만, 잠겨 있으면 못 움직인다', () => {
    const board = createEskimoBoard(A, B);
    expect(eskimoMoveTargets(board, cell(2, 2), A, false)).toHaveLength(8);
    expect(eskimoMoveTargets(board, cell(2, 2), B, false)).toHaveLength(8);
    expect(eskimoMoveTargets(board, cell(2, 2), A, true)).toEqual([]);
  });

  it('사방(상하좌우)이 말이나 판 끝으로 막히면 포위다 — 대각선은 보지 않는다', () => {
    const board = emptyBoard();
    board[2][2] = ESKIMO_BEAR;
    board[1][2] = A;
    board[3][2] = B;
    board[2][1] = A;
    expect(findEskimoSurround(board)).toBeNull();
    board[2][3] = B;
    expect(findEskimoSurround(board)).toHaveLength(5);

    const corner = emptyBoard();
    corner[0][0] = ESKIMO_BEAR;
    corner[0][1] = A;
    expect(findEskimoSurround(corner)).toBeNull();
    corner[1][0] = B;
    expect(findEskimoSurround(corner)).toEqual([cell(0, 0), cell(0, 1), cell(1, 0)]);
  });
});

describe('에스키모 진행', () => {
  it('차례를 번갈아 두고, 상대 차례·잘못된 도착점은 거부한다', () => {
    const { state } = start('es-turn');
    const wrong = move('es-turn', B, cell(0, 0), cell(3, 0));
    expect(wrong.emit).toHaveBeenCalledWith('error', { message: '상대 턴입니다.' });
    const bad = move('es-turn', A, cell(4, 0), cell(2, 0));
    expect(bad.emit).toHaveBeenCalledWith('error', { message: '그 칸으로는 옮길 수 없습니다.' });

    move('es-turn', A, cell(4, 0), cell(1, 0));
    expect(state.board[1][0]).toBe(A);
    expect(state.board[4][0]).toBeNull();
    expect(state.currentPlayerId).toBe(B);
    expect(state.turnNumber).toBe(2);
  });

  it('북극곰을 옮기면 이어지는 네 턴 동안 아무도 못 옮긴다', () => {
    const { state } = start('es-bear');
    move('es-bear', A, cell(2, 2), cell(2, 3)); // 1턴: 선이 곰을 옮김
    expect(state.bearLockTurns).toBe(4);

    // 2~5턴은 잠김
    const plays: [string, EskimoCell, EskimoCell][] = [
      [B, cell(0, 0), cell(3, 0)],
      [A, cell(4, 4), cell(1, 4)],
      [B, cell(0, 1), cell(3, 1)],
      [A, cell(4, 2), cell(1, 2)], // 곰이 비킨 가운데 줄을 지나 (1,2) 까지
    ];
    for (const [actor, from, to] of plays) {
      const blocked = move('es-bear', actor, cell(2, 3), cell(2, 2));
      expect(blocked.emit).toHaveBeenCalledWith('error', {
        message: `북극곰은 ${state.bearLockTurns}턴 뒤에 옮길 수 있습니다.`,
      });
      move('es-bear', actor, from, to);
    }
    // 6턴(후 차례)에 다시 옮길 수 있다
    expect(state.bearLockTurns).toBe(0);
    expect(state.currentPlayerId).toBe(B);
    move('es-bear', B, cell(2, 3), cell(2, 2));
    expect(state.board[2][2]).toBe(ESKIMO_BEAR);
    expect(state.bearLockTurns).toBe(4);
  });

  it('자기 수로 북극곰의 사방을 막으면 이긴다 — 상대 말이 섞여 있어도', () => {
    vi.useFakeTimers();
    const { state, end } = start('es-win');
    const board = emptyBoard();
    board[2][2] = ESKIMO_BEAR;
    board[3][2] = A;
    board[1][2] = B;
    board[2][1] = B;
    board[2][4] = A;
    board[0][0] = B;
    state.board = board;
    // (2,4) 를 왼쪽으로 밀면 곰 바로 옆 (2,3) 에서 멈춰 사방이 막힌다
    move('es-win', A, cell(2, 4), cell(2, 3));
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(A);
    expect(state.winType).toBe('surround');
    expect(state.winCells).toHaveLength(5);
    vi.advanceTimersByTime(3000);
    expect(end).toHaveBeenCalledTimes(1);
    expect(end.mock.calls[0][2].rankings[0]).toMatchObject({ playerId: A, rank: 1 });
  });

  it('북극곰을 옮겨 스스로 포위 자리에 넣어도 옮긴 쪽이 이긴다', () => {
    const { state } = start('es-bear-win');
    const board = emptyBoard();
    board[1][1] = ESKIMO_BEAR;
    board[0][0] = A;
    board[0][1] = B;
    board[1][0] = A;
    board[4][4] = B;
    state.board = board;
    // 모서리 (0,0) 의 곰은 판 끝 둘 + (0,1)·(1,0) 으로 막힌다 — (0,0) 이 비어야 하므로 옮겨 둔다
    state.board[0][0] = null;
    move('es-bear-win', A, cell(1, 1), cell(0, 0));
    expect(state.winnerId).toBe(A);
    expect(state.winType).toBe('surround');
  });

  it('반복수(이미 나왔던 판)는 둘 수 없다 — 거부하고 차례는 그대로', () => {
    const { state } = start('es-repeat');
    move('es-repeat', A, cell(4, 0), cell(1, 0));
    move('es-repeat', B, cell(0, 4), cell(3, 4));
    move('es-repeat', A, cell(1, 0), cell(4, 0));
    expect(state.gameOver).toBe(false);
    // 후가 (3,4) 를 위로 밀면 (0,4) 로 돌아가 시작 판과 같아진다
    const socket = move('es-repeat', B, cell(3, 4), cell(0, 4));
    expect(socket.emit).toHaveBeenCalledWith('error', {
      message: '반복수는 둘 수 없습니다. 이전에 나온 판과 같아집니다.',
    });
    expect(state.gameOver).toBe(false);
    expect(state.currentPlayerId).toBe(B);
    expect(state.board[3][4]).toBe(B);
    expect(state.actionLog).toHaveLength(3);
  });

  it('남은 수가 전부 반복수면 더 둘 수 있는 수가 없어 진다', () => {
    const { state } = start('es-only-repeat');
    // 선(A)의 말은 (0,0) 하나, 갈 수 있는 곳은 (1,0) 뿐 — 북극곰은 잠겨 있다
    const board = emptyBoard();
    board[0][0] = A;
    board[0][1] = B;
    board[1][1] = B;
    board[2][0] = B;
    board[3][3] = B;
    board[4][4] = ESKIMO_BEAR;
    state.board = board;
    state.currentPlayerId = B;
    state.bearLockTurns = 3;
    // 후가 (3,3)→(3,4) 로 둔 뒤 선이 (0,0)→(1,0) 으로 둔 판이 이미 나왔던 판이라고 둔다
    const afterB = applyEskimoAction(board, { type: 'move', from: cell(3, 3), to: cell(3, 4) });
    const afterA = applyEskimoAction(afterB, { type: 'move', from: cell(0, 0), to: cell(1, 0) });
    state.positions.push(eskimoPositionKey(afterA, A));

    move('es-only-repeat', B, cell(3, 3), cell(3, 4));
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(B);
    expect(state.winType).toBe('no-move');
  });

  it('시간 초과는 공통 처리에 맡기고 게임이 직접 끝내지 않는다', () => {
    vi.useFakeTimers();
    const { state } = start('es-timeout', 120);
    expect(state.turnTimer).not.toBeNull();
    vi.advanceTimersByTime(121_000);
    expect(state.gameOver).toBe(false);
  });

  it('무르기는 판·곰 잠금·반복수 기록을 한 수 전으로 돌린다', () => {
    const { state } = start('es-undo');
    expect(canEskimoUndo('es-undo')).toBe(false);
    move('es-undo', A, cell(2, 2), cell(1, 1));
    expect(state.bearLockTurns).toBe(4);
    expect(state.positions).toHaveLength(2);
    expect(performEskimoUndo(ioStub(), 'es-undo')).toBe(true);
    expect(state.board).toEqual(createEskimoBoard(A, B));
    expect(state.bearLockTurns).toBe(0);
    expect(state.positions).toHaveLength(1);
    expect(state.currentPlayerId).toBe(A);
    expect(state.actionLog).toHaveLength(0);
  });
});
