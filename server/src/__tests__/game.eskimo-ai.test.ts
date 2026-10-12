import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyEskimoAction,
  createEskimoBoard,
  eskimoMoveTargets,
  eskimoPositionKey,
  findEskimoSurround,
} from '@shared/logic/eskimo.js';
import { ESKIMO_BEAR, ESKIMO_SIZE, type EskimoBoard } from '@shared/types/eskimo.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { chooseEskimoAiAction } from '../socket/games/eskimo/ai.js';
import {
  cleanupEskimo,
  handleEskimoAction,
  initEskimo,
  performEskimoUndo,
} from '../socket/games/eskimo/index.js';
import { eskimoStates } from '../socket/games/eskimo/state.js';
import { sessions } from '../store/sessions.js';

const HUMAN = 'es-human';
const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupEskimo(roomId);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
  vi.useRealTimers();
});

function emptyBoard(): EskimoBoard {
  return Array.from({ length: ESKIMO_SIZE }, () => Array<string | null>(ESKIMO_SIZE).fill(null));
}

function ai(
  board: EskimoBoard,
  difficulty: 'normal' | 'hard',
  extra: Partial<Parameters<typeof chooseEskimoAiAction>[0]> = {},
) {
  return chooseEskimoAiAction({
    board,
    firstPlayerId: HUMAN,
    playerId: AI_PLAYER_ID,
    bearLockTurns: 0,
    positions: [],
    difficulty,
    thinkMs: 400,
    random: () => 0,
    ...extra,
  });
}

/** 이 판에서 player 가 바로 이길 수 있는 수가 있는지 */
function hasImmediateWin(board: EskimoBoard, player: string, bearLocked: boolean) {
  for (let r = 0; r < ESKIMO_SIZE; r += 1) {
    for (let c = 0; c < ESKIMO_SIZE; c += 1) {
      for (const to of eskimoMoveTargets(board, { row: r, col: c }, player, bearLocked)) {
        if (
          findEskimoSurround(
            applyEskimoAction(board, { type: 'move', from: { row: r, col: c }, to }),
          )
        )
          return true;
      }
    }
  }
  return false;
}

describe('에스키모 COM 수 읽기', () => {
  // 곰 (2,2), 위·왼쪽·아래가 막혀 오른쪽 (2,3) 한 칸만 남은 판
  function lastSideBoard() {
    const board = emptyBoard();
    board[2][2] = ESKIMO_BEAR;
    board[1][2] = HUMAN;
    board[2][1] = HUMAN;
    board[3][2] = AI_PLAYER_ID;
    board[0][0] = HUMAN;
    board[4][4] = HUMAN;
    return board;
  }

  it.each(['normal', 'hard'] as const)('%s: 바로 이기는 수가 있으면 둔다', (difficulty) => {
    const board = lastSideBoard();
    board[2][4] = AI_PLAYER_ID; // 왼쪽으로 밀면 (2,3) 에서 멈춘다
    const result = ai(board, difficulty)!;
    const after = applyEskimoAction(board, result.action);
    expect(findEskimoSurround(after)).not.toBeNull();
  });

  it.each(['normal', 'hard'] as const)('%s: 상대가 다음 수에 이기는 길을 막는다', (difficulty) => {
    const board = lastSideBoard();
    // 사람 말 (0,3) 이 아래로 밀면 (1,3)… (2,3) 에서 멈추지 않는다 — (3,3) 이 비어 있으면 더 내려간다.
    // 대신 (2,4)→왼쪽 은 곰에 막혀 (2,3) 에 선다: 사람의 위협.
    board[2][4] = HUMAN;
    board[4][0] = AI_PLAYER_ID;
    board[0][4] = AI_PLAYER_ID;
    expect(hasImmediateWin(board, HUMAN, false)).toBe(true);
    const result = ai(board, difficulty)!;
    const after = applyEskimoAction(board, result.action);
    // COM 이 먼저 이기거나, 사람의 바로 이기는 수를 없앴어야 한다
    const won = findEskimoSurround(after) !== null;
    expect(
      won ||
        !hasImmediateWin(
          after,
          HUMAN,
          result.action.from.row === 2 && result.action.from.col === 2,
        ),
    ).toBe(true);
  });

  it('반복수가 되는 수는 두지 않는다', () => {
    const board = createEskimoBoard(HUMAN, AI_PLAYER_ID);
    // COM 말 (0,0) 을 아래로 (3,0) 까지 옮긴 판 — 위로 되돌리면 시작 판이 된다
    const moved = applyEskimoAction(board, {
      type: 'move',
      from: { row: 0, col: 0 },
      to: { row: 3, col: 0 },
    });
    const positions = [eskimoPositionKey(board, HUMAN), eskimoPositionKey(moved, HUMAN)];
    for (let i = 0; i < 20; i += 1) {
      const result = ai(moved, 'normal', { positions, random: () => i / 20 })!;
      const after = applyEskimoAction(moved, result.action);
      expect(positions).not.toContain(eskimoPositionKey(after, HUMAN));
    }
  });

  it.each(['normal', 'hard'] as const)(
    '%s: 남은 수가 전부 반복수면 둘 수가 없다(null)',
    (difficulty) => {
      const board = emptyBoard();
      board[0][0] = AI_PLAYER_ID;
      board[0][1] = HUMAN;
      board[1][1] = HUMAN;
      board[2][0] = HUMAN;
      board[4][4] = ESKIMO_BEAR;
      const after = applyEskimoAction(board, {
        type: 'move',
        from: { row: 0, col: 0 },
        to: { row: 1, col: 0 },
      });
      const result = ai(board, difficulty, {
        bearLockTurns: 2,
        positions: [eskimoPositionKey(after, HUMAN)],
      });
      expect(result).toBeNull();
    },
  );

  it('어려움은 정해진 시간 안에 여러 수 깊이까지 읽는다', () => {
    const start = Date.now();
    const result = chooseEskimoAiAction({
      board: createEskimoBoard(HUMAN, AI_PLAYER_ID),
      firstPlayerId: HUMAN,
      playerId: AI_PLAYER_ID,
      bearLockTurns: 0,
      positions: [eskimoPositionKey(createEskimoBoard(HUMAN, AI_PLAYER_ID), HUMAN)],
      difficulty: 'hard',
      thinkMs: 500,
    })!;
    expect(Date.now() - start).toBeLessThan(1500);
    expect(result.depth).toBeGreaterThanOrEqual(3);
  });
});

describe('에스키모 COM 판 진행', () => {
  function ioStub() {
    return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
  }
  function player(id: string, nickname: string): Player {
    return { id, nickname, isHost: false, isReady: true, joinedAt: Date.now() };
  }
  function socketFor(playerId: string) {
    const socketId = `socket-${playerId}`;
    socketIds.add(socketId);
    sessions.linkToken(socketId, playerId);
    return { id: socketId, emit: vi.fn() } as unknown as TypedSocket;
  }

  it('사람이 두면 COM(보통)이 이어 두고, 무르기는 COM 수와 내 수를 함께 되돌린다', async () => {
    vi.useFakeTimers();
    const roomId = 'es-com';
    roomIds.add(roomId);
    initEskimo(
      ioStub(),
      roomId,
      [player(HUMAN, '나'), player(AI_PLAYER_ID, 'COM')],
      'com',
      Date.now(),
      null,
      vi.fn(),
      {
        aiDifficulty: 'normal',
      },
    );
    const state = eskimoStates.get(roomId)!;
    expect(state.aiDifficulty).toBe('normal');
    handleEskimoAction(ioStub(), socketFor(HUMAN), roomId, {
      type: 'move',
      from: { row: 4, col: 0 },
      to: { row: 1, col: 0 },
    });
    expect(state.currentPlayerId).toBe(AI_PLAYER_ID);
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.currentPlayerId).toBe(HUMAN);
    expect(state.actionLog).toHaveLength(2);
    expect(state.actionLog[1].actorId).toBe(AI_PLAYER_ID);

    expect(performEskimoUndo(ioStub(), roomId)).toBe(true);
    expect(state.actionLog).toHaveLength(0);
    expect(state.currentPlayerId).toBe(HUMAN);
    expect(state.board).toEqual(createEskimoBoard(HUMAN, AI_PLAYER_ID));
  });

  it('COM 이 선이면 시작하자마자 둔다', async () => {
    vi.useFakeTimers();
    const roomId = 'es-com-first';
    roomIds.add(roomId);
    initEskimo(
      ioStub(),
      roomId,
      [player(AI_PLAYER_ID, 'COM'), player(HUMAN, '나')],
      'com',
      Date.now(),
      null,
      vi.fn(),
    );
    const state = eskimoStates.get(roomId)!;
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.actionLog).toHaveLength(1);
    expect(state.currentPlayerId).toBe(HUMAN);
  });
});
