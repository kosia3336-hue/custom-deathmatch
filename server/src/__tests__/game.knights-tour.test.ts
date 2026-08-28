import { afterEach, describe, expect, it, vi } from 'vitest';
import { KT_TOTAL_ROUNDS, KT_WIN_SCORE } from '@shared/types/knights-tour.js';
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
  validateKnightTour,
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

describe('나이트의 여행 보드 생성기', () => {
  it('서로 다른 일곱 보드를 만들며 모든 판에 완주 경로가 있다', () => {
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
    expect(rounds.every((round) => validateKnightTour(round.board, round.solution))).toBe(true);
    expect(rounds.every((round) => round.board.size >= 5 && round.board.size <= 7)).toBe(true);
  });

  it('모든 원형 템플릿을 여러 회전·반전에서도 완주할 수 있다', () => {
    for (let sample = 0; sample < 32; sample += 1) {
      let value = (sample + 1) / 37;
      const rounds = dealKnightTourRounds(KNIGHT_TOUR_TEMPLATE_COUNT, () => {
        value = (value * 7.13 + 0.173) % 1;
        return value;
      });
      expect(rounds).toHaveLength(KNIGHT_TOUR_TEMPLATE_COUNT);
      expect(rounds.every((round) => validateKnightTour(round.board, round.solution))).toBe(true);
    }
  });

  it('L자 이동만 나이트 이동으로 인정한다', () => {
    expect(isKnightMove({ row: 0, col: 0 }, { row: 1, col: 2 })).toBe(true);
    expect(isKnightMove({ row: 3, col: 3 }, { row: 1, col: 2 })).toBe(true);
    expect(isKnightMove({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
  });
});

describe('나이트의 여행 경기 진행', () => {
  it('잘못된 이동은 무시하고 완주한 플레이어에게 라운드 1점을 준다', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'knight-tour-complete';
    roomIds.add(roomId);
    const first = player('knight-first', '첫 번째');
    const second = player('knight-second', '두 번째');
    const socket = socketFor(first.id);
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;
    const solution = state.rounds[0].solution;

    handleKnightTourAction(io, socket, roomId, {
      type: 'move',
      row: solution[0].row,
      col: solution[0].col,
    });
    handleKnightTourAction(io, socket, roomId, {
      type: 'move',
      row: solution[0].row,
      col: solution[0].col,
    });
    expect(state.paths[first.id]).toHaveLength(1);
    for (const cell of solution.slice(1))
      handleKnightTourAction(io, socket, roomId, { type: 'move', ...cell });

    expect(state.phase).toBe('round-result');
    expect(state.scores[first.id]).toBe(1);
    expect(state.roundResults[0]).toMatchObject({ winnerId: first.id, reason: 'completed' });
  });

  it('멀티 대전은 4점을 선취하면 다음 라운드 전에 판정승한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.271828);
    const roomId = 'knight-tour-clinch';
    roomIds.add(roomId);
    const first = player('clinch-first', '선취자');
    const second = player('clinch-second', '상대');
    const socket = socketFor(first.id);
    const io = ioStub();
    initKnightTour(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;

    for (let round = 0; round < KT_WIN_SCORE; round += 1) {
      for (const cell of state.rounds[state.currentRoundIndex].solution) {
        handleKnightTourAction(io, socket, roomId, { type: 'move', ...cell });
      }
      await vi.advanceTimersByTimeAsync(2300);
    }

    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(first.id);
    expect(state.scores[first.id]).toBe(KT_WIN_SCORE);
    expect(state.roundResults).toHaveLength(KT_WIN_SCORE);
  });

  it('COM은 서버가 검증한 경로를 따라 보드를 완주한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const roomId = 'knight-tour-com';
    roomIds.add(roomId);
    const human = player('com-human', '플레이어');
    const ai = player(AI_PLAYER_ID, 'AI');
    const io = ioStub();
    initKnightTour(io, roomId, [human, ai], 'com', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;

    await vi.advanceTimersByTimeAsync(40_000);

    expect(state.roundResults.length).toBeGreaterThanOrEqual(1);
    expect(state.scores[AI_PLAYER_ID]).toBeGreaterThanOrEqual(1);
    expect(state.roundResults[0]).toMatchObject({ winnerId: AI_PLAYER_ID, reason: 'completed' });
  });

  it('솔로는 4점을 얻어도 판정승하지 않고 일곱 라운드를 계속한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.618034);
    const roomId = 'knight-tour-solo';
    roomIds.add(roomId);
    const solo = player('solo-player', '솔로');
    const socket = socketFor(solo.id);
    const io = ioStub();
    initKnightTour(io, roomId, [solo], 'solo', Date.now(), null, vi.fn());
    const state = knightTourStates.get(roomId)!;

    for (let round = 0; round < KT_WIN_SCORE; round += 1) {
      for (const cell of state.rounds[state.currentRoundIndex].solution) {
        handleKnightTourAction(io, socket, roomId, { type: 'move', ...cell });
      }
      await vi.advanceTimersByTimeAsync(2300);
    }

    expect(state.gameOver).toBe(false);
    expect(state.currentRoundIndex).toBe(KT_WIN_SCORE);
    expect(state.scores[solo.id]).toBe(KT_WIN_SCORE);
  });
});
