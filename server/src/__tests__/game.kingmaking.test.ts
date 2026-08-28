import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyKingmakingAction,
  canMoveKingmakingStack,
  createKingmakingBoard,
} from '@shared/logic/kingmaking.js';
import type {
  KingmakingBoard,
  KingmakingPiece,
  KingmakingPosition,
} from '@shared/types/kingmaking.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { chooseKingmakingAiAction } from '../socket/games/kingmaking/ai.js';
import {
  cleanupKingmaking,
  handleKingmakingAction,
  initKingmaking,
} from '../socket/games/kingmaking/index.js';
import { kingmakingStates } from '../socket/games/kingmaking/state.js';
import type { KingmakingReserve } from '../socket/games/kingmaking/types.js';

const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupKingmaking(roomId);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function piece(id: string, ownerId = 'first', kind: 'normal' | 'special' = 'normal') {
  return { id, ownerId, kind } satisfies KingmakingPiece;
}

function stack(count: number, ownerId = 'first') {
  return Array.from({ length: count }, (_, index) => piece(`${ownerId}-${index}`, ownerId));
}

function boardWith(source: KingmakingPosition, count: number, target: KingmakingPosition) {
  const board = createKingmakingBoard();
  board[source.row][source.col] = stack(count);
  board[target.row][target.col] = [piece('target', 'second')];
  return board;
}

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

describe('킹메이킹 이동 규칙', () => {
  it('이동하는 층수 1~5에 맞는 이동법을 적용한다', () => {
    expect(
      canMoveKingmakingStack(
        boardWith({ row: 2, col: 2 }, 1, { row: 2, col: 3 }),
        { row: 2, col: 2 },
        { row: 2, col: 3 },
        1,
      ),
    ).toBe(true);
    expect(
      canMoveKingmakingStack(
        boardWith({ row: 0, col: 0 }, 2, { row: 0, col: 4 }),
        { row: 0, col: 0 },
        { row: 0, col: 4 },
        2,
      ),
    ).toBe(true);
    expect(
      canMoveKingmakingStack(
        boardWith({ row: 0, col: 0 }, 3, { row: 1, col: 2 }),
        { row: 0, col: 0 },
        { row: 1, col: 2 },
        3,
      ),
    ).toBe(true);
    expect(
      canMoveKingmakingStack(
        boardWith({ row: 0, col: 0 }, 4, { row: 4, col: 4 }),
        { row: 0, col: 0 },
        { row: 4, col: 4 },
        4,
      ),
    ).toBe(true);
    expect(
      canMoveKingmakingStack(
        boardWith({ row: 4, col: 0 }, 5, { row: 0, col: 4 }),
        { row: 4, col: 0 },
        { row: 0, col: 4 },
        5,
      ),
    ).toBe(true);
    expect(
      canMoveKingmakingStack(
        boardWith({ row: 0, col: 0 }, 3, { row: 2, col: 2 }),
        { row: 0, col: 0 },
        { row: 2, col: 2 },
        3,
      ),
    ).toBe(false);
  });

  it('룩·비숍·퀸은 중간의 다른 탑을 통과하지 못한다', () => {
    const rookBoard = boardWith({ row: 0, col: 0 }, 2, { row: 0, col: 4 });
    rookBoard[0][2] = [piece('block')];
    expect(canMoveKingmakingStack(rookBoard, { row: 0, col: 0 }, { row: 0, col: 4 }, 2)).toBe(
      false,
    );
    const bishopBoard = boardWith({ row: 0, col: 0 }, 4, { row: 4, col: 4 });
    bishopBoard[2][2] = [piece('block')];
    expect(canMoveKingmakingStack(bishopBoard, { row: 0, col: 0 }, { row: 4, col: 4 }, 4)).toBe(
      false,
    );
  });

  it('위쪽 일부만 순서를 유지해 떼어 이동한다', () => {
    const board = createKingmakingBoard();
    board[2][1] = ['a', 'b', 'c', 'd', 'e'].map((id) => piece(id));
    board[0][2] = [piece('target', 'second')];
    const moved = applyKingmakingAction(board, {
      type: 'move',
      from: { row: 2, col: 1 },
      to: { row: 0, col: 2 },
      count: 3,
    });
    expect(moved[2][1].map((value) => value.id)).toEqual(['a', 'b']);
    expect(moved[0][2].map((value) => value.id)).toEqual(['target', 'c', 'd', 'e']);
  });

  it('특수말이 맨 위인 탑과 7층 이상이 되는 탑에는 올릴 수 없다', () => {
    const specialBoard = boardWith({ row: 2, col: 2 }, 1, { row: 2, col: 3 });
    specialBoard[2][3] = [piece('special', 'second', 'special')];
    expect(canMoveKingmakingStack(specialBoard, { row: 2, col: 2 }, { row: 2, col: 3 }, 1)).toBe(
      false,
    );
    const tallBoard = boardWith({ row: 2, col: 2 }, 2, { row: 2, col: 3 });
    tallBoard[2][3] = stack(5, 'second');
    expect(canMoveKingmakingStack(tallBoard, { row: 2, col: 2 }, { row: 2, col: 3 }, 2)).toBe(
      false,
    );
  });
});

describe('킹메이킹 경기 진행', () => {
  it('각자 일반말 15개와 특수말 1개를 받고 빈칸에 번갈아 배치한다', () => {
    const roomId = 'kingmaking-place';
    roomIds.add(roomId);
    const first = player('first', '첫 번째');
    const second = player('second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    initKingmaking(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = kingmakingStates.get(roomId)!;

    handleKingmakingAction(io, firstSocket, roomId, {
      type: 'place',
      kind: 'normal',
      to: { row: 0, col: 0 },
    });
    handleKingmakingAction(io, secondSocket, roomId, {
      type: 'place',
      kind: 'special',
      to: { row: 4, col: 4 },
    });

    expect(state.reserves[first.id].normal).toHaveLength(14);
    expect(state.reserves[second.id].special).toBeNull();
    expect(state.board[0][0][0]).toMatchObject({ ownerId: first.id, kind: 'normal' });
    expect(state.board[4][4][0]).toMatchObject({ ownerId: second.id, kind: 'special' });
    expect(state.currentPlayerId).toBe(first.id);
  });

  it('상대 말을 이동해 6층을 만들면 맨 위 말 주인인 상대가 승리한다', () => {
    vi.useFakeTimers();
    const roomId = 'kingmaking-opponent-wins';
    roomIds.add(roomId);
    const first = player('actor', '행동자');
    const second = player('top-owner', '말 주인');
    const socket = socketFor(first.id);
    const io = ioStub();
    initKingmaking(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = kingmakingStates.get(roomId)!;
    state.board[2][1] = [piece('opponent-top', second.id)];
    state.board[2][2] = stack(5, first.id);

    handleKingmakingAction(io, socket, roomId, {
      type: 'move',
      from: { row: 2, col: 1 },
      to: { row: 2, col: 2 },
      count: 1,
    });

    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
    expect(state.winType).toBe('six-stack');
    expect(state.board[2][2]).toHaveLength(6);
  });

  it('제한시간이 끝나면 현재 플레이어가 패배한다', async () => {
    vi.useFakeTimers();
    const roomId = 'kingmaking-timeout';
    roomIds.add(roomId);
    const first = player('slow', '느린 플레이어');
    const second = player('winner', '상대');
    const io = ioStub();
    initKingmaking(io, roomId, [first, second], 'multi', Date.now(), 10, vi.fn());
    const state = kingmakingStates.get(roomId)!;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
    expect(state.winType).toBe('timeout');
  });

  it('COM은 즉시 6층을 완성할 수 있는 수를 선택한다', () => {
    const board: KingmakingBoard = createKingmakingBoard();
    board[2][1] = [piece('ai-top', AI_PLAYER_ID)];
    board[2][2] = stack(5, 'human');
    const reserves: Record<string, KingmakingReserve> = {
      [AI_PLAYER_ID]: { normal: [], special: null },
      human: { normal: [], special: null },
    };
    const action = chooseKingmakingAiAction(board, reserves, AI_PLAYER_ID, 'human');
    expect(action).toEqual({
      type: 'move',
      from: { row: 2, col: 1 },
      to: { row: 2, col: 2 },
      count: 1,
    });
  });

  it('COM이 선 플레이어라면 예약된 시간 뒤 실제 행동하고 턴을 넘긴다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const roomId = 'kingmaking-com-turn';
    roomIds.add(roomId);
    const ai = player(AI_PLAYER_ID, 'AI');
    const human = player('human-player', '플레이어');
    const io = ioStub();
    initKingmaking(io, roomId, [ai, human], 'com', Date.now(), null, vi.fn());
    const state = kingmakingStates.get(roomId)!;

    await vi.advanceTimersByTimeAsync(900);

    expect(state.actionLog).toHaveLength(1);
    expect(state.actionLog[0]).toMatchObject({ actorId: AI_PLAYER_ID, action: { type: 'place' } });
    expect(state.currentPlayerId).toBe(human.id);
  });
});
