import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KT_ROUND_SECONDS,
  KT_TOTAL_ROUNDS,
  KT_WIN_SCORE,
  type KnightTourCell,
} from '@shared/types/knights-tour.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  cleanupKnightTour,
  handleKnightTourAction,
  initKnightTour,
} from '../socket/games/knights-tour/index.js';
import {
  dealKnightTourRounds,
  isKnightMove,
  KNIGHT_TOUR_TEMPLATE_COUNT,
  knightTourCellKey,
  validateKnightTourPath,
} from '../socket/games/knights-tour/generator.js';
import { knightTourStates } from '../socket/games/knights-tour/state.js';

const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupKnightTour(roomId);
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

function movePath(io: IO, socket: TypedSocket, roomId: string, path: KnightTourCell[]) {
  for (const cell of path) handleKnightTourAction(io, socket, roomId, { type: 'move', ...cell });
}

function submit(io: IO, socket: TypedSocket, roomId: string) {
  handleKnightTourAction(io, socket, roomId, { type: 'submit' });
}

function connectedComponentCount(cells: KnightTourCell[]) {
  const pending = new Map(cells.map((cell) => [knightTourCellKey(cell), cell]));
  let count = 0;
  while (pending.size > 0) {
    count += 1;
    const first = pending.values().next().value as KnightTourCell;
    const queue = [first];
    pending.delete(knightTourCellKey(first));
    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const [key, cell] of pending) {
        if (!isKnightMove(current, cell)) continue;
        pending.delete(key);
        queue.push(cell);
      }
    }
  }
  return count;
}

describe('나이트의 여행 보드 생성기', () => {
  it('서로 다른 일곱 장애물 보드를 만들며 COM 참고 경로가 유효하다', () => {
    let seed = 314159;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const rounds = dealKnightTourRounds(KT_TOTAL_ROUNDS, random);
    expect(rounds).toHaveLength(7);
    expect(
      new Set(rounds.map((round) => round.board.shapeId.split('-').slice(0, -2).join('-'))).size,
    ).toBe(7);
    expect(rounds.every((round) => validateKnightTourPath(round.board, round.solution))).toBe(true);
    expect(rounds.every((round) => round.board.activeCells.length < round.board.size ** 2)).toBe(
      true,
    );
    expect(rounds.some((round) => round.solution.length < round.board.activeCells.length)).toBe(
      true,
    );
    expect(rounds.some((round) => connectedComponentCount(round.board.activeCells) > 1)).toBe(true);
    expect(rounds.every((round) => round.board.size >= 5 && round.board.size <= 7)).toBe(true);
  });

  it('모든 원형 템플릿을 여러 회전·반전해도 내부 구멍과 유효 경로를 유지한다', () => {
    for (let sample = 0; sample < 32; sample += 1) {
      let value = (sample + 1) / 37;
      const rounds = dealKnightTourRounds(KNIGHT_TOUR_TEMPLATE_COUNT, () => {
        value = (value * 7.13 + 0.173) % 1;
        return value;
      });
      expect(rounds).toHaveLength(KNIGHT_TOUR_TEMPLATE_COUNT);
      expect(rounds.every((round) => validateKnightTourPath(round.board, round.solution))).toBe(
        true,
      );
      for (const round of rounds) {
        const active = new Set(round.board.activeCells.map(knightTourCellKey));
        const holes = Array.from({ length: round.board.size ** 2 }, (_, index) => ({
          row: Math.floor(index / round.board.size),
          col: index % round.board.size,
        })).filter((cell) => !active.has(knightTourCellKey(cell)));
        expect(
          holes.some(
            (cell) =>
              cell.row > 0 &&
              cell.col > 0 &&
              cell.row < round.board.size - 1 &&
              cell.col < round.board.size - 1,
          ),
        ).toBe(true);
      }
    }
  });

  it('L자 이동만 나이트 이동으로 인정한다', () => {
    expect(isKnightMove({ row: 0, col: 0 }, { row: 1, col: 2 })).toBe(true);
    expect(isKnightMove({ row: 3, col: 3 }, { row: 1, col: 2 })).toBe(true);
    expect(isKnightMove({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
  });
});

describe('나이트의 여행 경기 진행', () => {
  it('방 시간 설정과 무관하게 라운드를 60초로 고정하고 더 많은 칸 제출자가 승리한다', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'knight-tour-count';
    roomIds.add(roomId);
    const first = player('knight-first', '첫 번째');
    const second = player('knight-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), 10, vi.fn());
    const state = knightTourStates.get(roomId)!;
    const route = state.rounds[0].solution;

    expect(state.roundSeconds).toBe(KT_ROUND_SECONDS);
    movePath(io, firstSocket, roomId, route.slice(0, 3));
    movePath(io, secondSocket, roomId, route.slice(0, 2));
    handleKnightTourAction(io, firstSocket, roomId, { type: 'move', ...route[0] });
    expect(state.paths[first.id]).toHaveLength(3);

    submit(io, firstSocket, roomId);
    handleKnightTourAction(io, firstSocket, roomId, { type: 'backtrack' });
    expect(state.paths[first.id]).toHaveLength(3);
    submit(io, secondSocket, roomId);

    expect(state.phase).toBe('round-result');
    expect(state.scores[first.id]).toBe(1);
    expect(state.roundResults[0]).toMatchObject({
      winnerId: first.id,
      reason: 'submitted',
      visitedCounts: { [first.id]: 3, [second.id]: 2 },
    });
  });

  it('방문 칸 수가 같으면 같은 시각이어도 실제 제출 순서가 빠른 플레이어가 승리한다', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.271828);
    const roomId = 'knight-tour-submit-order';
    roomIds.add(roomId);
    const first = player('order-first', '첫 번째');
    const second = player('order-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;
    const route = state.rounds[0].solution.slice(0, 3);
    movePath(io, firstSocket, roomId, route);
    movePath(io, secondSocket, roomId, route);

    submit(io, secondSocket, roomId);
    submit(io, firstSocket, roomId);

    expect(state.roundResults[0].winnerId).toBe(second.id);
    expect(state.scores[second.id]).toBe(1);
  });

  it('60초가 끝나면 미제출 경로를 자동 제출해 방문 칸 수를 비교한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const roomId = 'knight-tour-timeout';
    roomIds.add(roomId);
    const first = player('timeout-first', '첫 번째');
    const second = player('timeout-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;
    const route = state.rounds[0].solution;
    movePath(io, firstSocket, roomId, route.slice(0, 2));
    movePath(io, secondSocket, roomId, route.slice(0, 1));

    await vi.advanceTimersByTimeAsync(KT_ROUND_SECONDS * 1000);

    expect(state.roundResults[0]).toMatchObject({
      winnerId: first.id,
      reason: 'timeout',
      autoSubmitted: { [first.id]: true, [second.id]: true },
    });
  });

  it('둘 다 시간 종료로 같은 칸 수를 기록하면 라운드를 무승부로 처리한다', async () => {
    vi.useFakeTimers();
    const roomId = 'knight-tour-timeout-draw';
    roomIds.add(roomId);
    const first = player('draw-first', '첫 번째');
    const second = player('draw-second', '두 번째');
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;

    await vi.advanceTimersByTimeAsync(KT_ROUND_SECONDS * 1000);

    expect(state.roundResults[0].winnerId).toBeNull();
    expect(state.scores).toEqual({ [first.id]: 0, [second.id]: 0 });
  });

  it('멀티 대전은 4점을 선취하면 다음 라운드 전에 판정승한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.618034);
    const roomId = 'knight-tour-clinch';
    roomIds.add(roomId);
    const first = player('clinch-first', '선취자');
    const second = player('clinch-second', '상대');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;

    for (let round = 0; round < KT_WIN_SCORE; round += 1) {
      movePath(io, firstSocket, roomId, state.rounds[state.currentRoundIndex].solution.slice(0, 1));
      submit(io, firstSocket, roomId);
      submit(io, secondSocket, roomId);
      await vi.advanceTimersByTimeAsync(2300);
    }

    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(first.id);
    expect(state.scores[first.id]).toBe(KT_WIN_SCORE);
    expect(state.roundResults).toHaveLength(KT_WIN_SCORE);
  });

  it('COM은 장애물을 피한 참고 경로를 이동한 뒤 제출한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const roomId = 'knight-tour-com';
    roomIds.add(roomId);
    const human = player('com-human', '플레이어');
    const ai = player(AI_PLAYER_ID, 'AI');
    const humanSocket = socketFor(human.id);
    const io = ioStub();
    initKnightTour(io, roomId, [human, ai], 'com', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;
    submit(io, humanSocket, roomId);

    await vi.advanceTimersByTimeAsync(35_000);

    expect(state.roundResults.length).toBeGreaterThanOrEqual(1);
    expect(state.scores[AI_PLAYER_ID]).toBeGreaterThanOrEqual(1);
    expect(state.roundResults[0]).toMatchObject({ winnerId: AI_PLAYER_ID, reason: 'submitted' });
  });

  it('솔로는 제출한 방문 칸을 누적하며 4라운드 뒤에도 일곱 라운드를 계속한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.707107);
    const roomId = 'knight-tour-solo';
    roomIds.add(roomId);
    const solo = player('solo-player', '솔로');
    const socket = socketFor(solo.id);
    const io = ioStub();
    initKnightTour(io, roomId, [solo], 'solo', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;

    for (let round = 0; round < KT_WIN_SCORE; round += 1) {
      movePath(io, socket, roomId, state.rounds[state.currentRoundIndex].solution.slice(0, 2));
      submit(io, socket, roomId);
      await vi.advanceTimersByTimeAsync(2300);
    }

    expect(state.gameOver).toBe(false);
    expect(state.currentRoundIndex).toBe(KT_WIN_SCORE);
    expect(state.scores[solo.id]).toBe(KT_WIN_SCORE * 2);
  });
});
