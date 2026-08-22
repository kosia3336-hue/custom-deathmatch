import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeHapCardKey } from '@shared/types/complete-hap.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  cleanupCompleteHap,
  completeHapRankings,
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

describe('컴플릿 결! 합! 동시 선착순 진행', () => {
  it('차례 없이 두 플레이어가 서로 다른 합을 바로 선점한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'complete-hap-race';
    roomIds.add(roomId);
    const first = player('race-first', '첫 번째');
    const second = player('race-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const answers = state.boards.flatMap((board, boardIndex) =>
      board.allSets.map((cardIndexes) => ({ boardIndex, cardIndexes })),
    );
    expect(answers.length).toBeGreaterThanOrEqual(2);

    await vi.advanceTimersByTimeAsync(1000);
    handleCompleteHapAction(io, firstSocket, roomId, {
      type: 'submit-hap',
      ...answers[0],
    });
    await vi.advanceTimersByTimeAsync(1000);
    handleCompleteHapAction(io, secondSocket, roomId, {
      type: 'submit-hap',
      ...answers[1],
    });

    expect(state.correctCounts).toMatchObject({ [first.id]: 1, [second.id]: 1 });
    expect(state.claims).toHaveLength(2);
    expect(completeHapRankings(state).rankings[0].playerId).toBe(first.id);
    expect(completeHapRankings(state).tiebreak).toBe('speed');
  });

  it('오답과 이미 선점된 합에는 감점이 없고 계속 제출할 수 있다', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'complete-hap-retry';
    roomIds.add(roomId);
    const first = player('retry-first', '첫 번째');
    const second = player('retry-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const boardIndex = state.boards.findIndex((board) => board.allSets.length > 0);
    const answer = state.boards[boardIndex].allSets[0];
    const wrong = findWrongTriple(state.boards[boardIndex].allSetKeys);

    handleCompleteHapAction(io, firstSocket, roomId, {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: wrong,
    });
    expect(state.correctCounts[first.id]).toBe(0);

    handleCompleteHapAction(io, firstSocket, roomId, {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: answer,
    });
    handleCompleteHapAction(io, secondSocket, roomId, {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: [...answer].reverse(),
    });
    expect(state.correctCounts).toMatchObject({ [first.id]: 1, [second.id]: 0 });
    expect(state.claims).toHaveLength(1);
  });

  it('0:0일 때만 무승부로 판정한다', () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-zero-draw';
    roomIds.add(roomId);
    const first = player('draw-first', '첫 번째');
    const second = player('draw-second', '두 번째');
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const result = completeHapRankings(completeHapStates.get(roomId)!);
    expect(result.tiebreak).toBe('zero-draw');
    expect(result.rankings.every((ranking) => ranking.rank === 1)).toBe(true);
  });

  it('솔로는 10분 동안 찾은 정답 수를 단일 랭킹으로 반환한다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-solo';
    roomIds.add(roomId);
    const human = player('solo-player', '솔로');
    const socket = socketFor(human.id);
    const io = ioStub();
    const onEnd = vi.fn();

    initCompleteHap(io, roomId, [human], 'solo', Date.now(), null, onEnd);
    const state = completeHapStates.get(roomId)!;
    const boardIndex = state.boards.findIndex((board) => board.allSets.length > 0);
    handleCompleteHapAction(io, socket, roomId, {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: state.boards[boardIndex].allSets[0],
    });
    await vi.advanceTimersByTimeAsync(603_000);

    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0]?.[2]?.rankings).toEqual([
      { playerId: human.id, nickname: human.nickname, rank: 1, score: 1 },
    ]);
  });

  it('COM은 사람과 동시에 남은 합을 자동으로 선점한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const roomId = 'complete-hap-com';
    roomIds.add(roomId);
    const human = player('human-com', '사람');
    const computer = player(AI_PLAYER_ID, 'COM');
    const io = ioStub();

    initCompleteHap(io, roomId, [human, computer], 'com', Date.now(), null, vi.fn());
    await vi.advanceTimersByTimeAsync(3500);

    const state = completeHapStates.get(roomId)!;
    expect(state.correctCounts[AI_PLAYER_ID]).toBe(1);
    expect(state.claims[0]?.playerId).toBe(AI_PLAYER_ID);
  });
});

function findWrongTriple(validKeys: Set<string>) {
  for (let first = 0; first < 7; first++) {
    for (let second = first + 1; second < 8; second++) {
      for (let third = second + 1; third < 9; third++) {
        const triple = [first, second, third];
        if (!validKeys.has(triple.join('-'))) return triple;
      }
    }
  }
  throw new Error('오답 조합을 찾지 못했습니다.');
}
