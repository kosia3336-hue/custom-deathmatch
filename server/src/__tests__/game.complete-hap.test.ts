import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeHapCardKey } from '@shared/types/complete-hap.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  cleanupCompleteHap,
  handleCompleteHapAction,
  initCompleteHap,
} from '../socket/games/complete-hap/index.js';
import {
  createCompleteHapDeck,
  dealCompleteHapBoards,
  findCompleteHapSets,
  isCompleteHapSet,
} from '../socket/games/complete-hap/generator.js';
import { completeHapStates } from '../socket/games/complete-hap/state.js';

const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupCompleteHap(roomId);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function player(id: string, nickname: string): Player {
  return {
    id,
    nickname,
    isHost: false,
    isReady: true,
    joinedAt: Date.now(),
  };
}

function ioStub() {
  return {
    in: () => ({ fetchSockets: async () => [] }),
  } as unknown as IO;
}

function socketFor(playerId: string) {
  const socketId = `socket-${playerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, playerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket;
}

describe('컴플릿 결! 합! 카드와 판정', () => {
  it('3×3×3 조합의 서로 다른 카드 27장을 만든다', () => {
    const deck = createCompleteHapDeck();
    expect(deck).toHaveLength(27);
    expect(new Set(deck.map(completeHapCardKey))).toHaveLength(27);
  });

  it('각 속성이 모두 같거나 모두 다른 세 장만 합으로 인정한다', () => {
    expect(
      isCompleteHapSet([
        { shape: 'circle', background: 'black', color: 'red' },
        { shape: 'circle', background: 'gray', color: 'yellow' },
        { shape: 'circle', background: 'white', color: 'blue' },
      ]),
    ).toBe(true);
    expect(
      isCompleteHapSet([
        { shape: 'circle', background: 'black', color: 'red' },
        { shape: 'triangle', background: 'gray', color: 'yellow' },
        { shape: 'square', background: 'white', color: 'blue' },
      ]),
    ).toBe(true);
    expect(
      isCompleteHapSet([
        { shape: 'circle', background: 'black', color: 'red' },
        { shape: 'circle', background: 'gray', color: 'yellow' },
        { shape: 'triangle', background: 'white', color: 'blue' },
      ]),
    ).toBe(false);
  });

  it('27장을 중복 없이 9장짜리 보드 세 개로 나누고 모든 합을 열거한다', () => {
    const boards = dealCompleteHapBoards(() => 0.314159);
    const cards = boards.flatMap((board) => board.cards);
    expect(boards).toHaveLength(3);
    expect(boards.every((board) => board.cards.length === 9)).toBe(true);
    expect(new Set(cards.map(completeHapCardKey))).toHaveLength(27);
    for (const board of boards) {
      expect(board.allSets).toEqual(findCompleteHapSets(board.cards));
      expect(
        board.allSets.every((set) => isCompleteHapSet(set.map((index) => board.cards[index]))),
      ).toBe(true);
    }
  });
});

describe('컴플릿 결! 합! 진행', () => {
  it('솔로에서 합 정답은 +1, 같은 합 반복은 -1로 처리한다', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'complete-hap-solo';
    roomIds.add(roomId);
    const human = player('human-solo', '솔로');
    const socket = socketFor(human.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [human], 'solo', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const boardIndex = state.boards.findIndex((board) => board.allSets.length > 0);
    expect(boardIndex).toBeGreaterThanOrEqual(0);
    const answer = state.boards[boardIndex].allSets[0];

    handleCompleteHapAction(io, socket, roomId, { type: 'call-hap', boardIndex });
    handleCompleteHapAction(io, socket, roomId, {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: answer,
    });
    expect(state.scores[human.id]).toBe(1);
    expect(state.currentPlayerId).toBe(human.id);

    handleCompleteHapAction(io, socket, roomId, { type: 'call-hap', boardIndex });
    handleCompleteHapAction(io, socket, roomId, {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: [...answer].reverse(),
    });
    expect(state.scores[human.id]).toBe(0);
    expect(state.actionLog.at(-1)?.kind).toBe('duplicate-hap');
  });

  it('합 호명 후 5초를 넘기면 -1점과 함께 상대 차례가 된다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-call-timeout';
    roomIds.add(roomId);
    const first = player('first-call', '선공');
    const second = player('second-call', '후공');
    const socket = socketFor(first.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    handleCompleteHapAction(io, socket, roomId, { type: 'call-hap', boardIndex: 0 });
    await vi.advanceTimersByTimeAsync(5000);

    const state = completeHapStates.get(roomId)!;
    expect(state.scores[first.id]).toBe(-1);
    expect(state.currentPlayerId).toBe(second.id);
    expect(state.actionLog.at(-1)?.kind).toBe('call-timeout');
  });

  it('10초 동안 외치지 않으면 점수 변화 없이 상대 차례가 된다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-turn-timeout';
    roomIds.add(roomId);
    const first = player('first-turn', '선공');
    const second = player('second-turn', '후공');
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    await vi.advanceTimersByTimeAsync(10_000);

    const state = completeHapStates.get(roomId)!;
    expect(state.scores[first.id]).toBe(0);
    expect(state.currentPlayerId).toBe(second.id);
    expect(state.actionLog.at(-1)?.kind).toBe('turn-timeout');
  });

  it('남은 합이 없는 보드의 결은 +3점으로 처리한다', () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-gyul';
    roomIds.add(roomId);
    const human = player('human-gyul', '솔로');
    const socket = socketFor(human.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [human], 'solo', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const board = state.boards[0];
    board.claimedSetKeys = new Set(board.allSetKeys);
    board.claimedSets = board.allSets.map((set) => [...set]);
    handleCompleteHapAction(io, socket, roomId, { type: 'call-gyul', boardIndex: 0 });

    expect(state.scores[human.id]).toBe(3);
    expect(board.completed).toBe(true);
    expect(state.actionLog.at(-1)?.kind).toBe('gyul');
  });

  it('COM 차례에는 서버 AI가 합 또는 결을 자동으로 처리한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const roomId = 'complete-hap-com';
    roomIds.add(roomId);
    const human = player('human-com', '사람');
    const computer = player(AI_PLAYER_ID, 'COM');
    const io = ioStub();

    initCompleteHap(io, roomId, [human, computer], 'com', Date.now(), null, vi.fn());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(completeHapStates.get(roomId)?.currentPlayerId).toBe(AI_PLAYER_ID);
    await vi.advanceTimersByTimeAsync(2000);

    const state = completeHapStates.get(roomId)!;
    expect(
      state.actionLog.some(
        (record) =>
          record.playerId === AI_PLAYER_ID && (record.kind === 'hap' || record.kind === 'gyul'),
      ),
    ).toBe(true);
    expect(state.currentPlayerId).toBe(human.id);
  });
});
