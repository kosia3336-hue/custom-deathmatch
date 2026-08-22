import { afterEach, describe, expect, it, vi } from 'vitest';
import { CH_TOTAL_ROUNDS, CH_WIN_SCORE, completeHapCardKey } from '@shared/types/complete-hap.js';
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
  dealCompleteHapBoard,
  dealCompleteHapRounds,
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

function submitGyul(io: IO, socket: TypedSocket, roomId: string, sets: number[][]) {
  handleCompleteHapAction(io, socket, roomId, { type: 'call-gyul', sets });
}

function wrongTriple(allSetKeys: Set<string>) {
  for (let first = 0; first < 7; first++) {
    for (let second = first + 1; second < 8; second++) {
      for (let third = second + 1; third < 9; third++) {
        const triple = [first, second, third];
        if (!allSetKeys.has(triple.join('-'))) return triple;
      }
    }
  }
  throw new Error('오답 조합을 찾지 못했습니다.');
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

  it('합이 2개 이상인 9장 문제를 만들고 모든 합을 열거한다', () => {
    const board = dealCompleteHapBoard(() => 0.314159);
    expect(board.cards).toHaveLength(9);
    expect(board.allSets.length).toBeGreaterThanOrEqual(2);
    expect(board.allSets).toEqual(findCompleteHapSets(board.cards));
    expect(
      board.allSets.every((set) => isCompleteHapSet(set.map((index) => board.cards[index]))),
    ).toBe(true);
  });

  it('기본값으로 9장 문제 일곱 라운드를 준비한다', () => {
    const rounds = dealCompleteHapRounds(CH_TOTAL_ROUNDS, () => 0.314159);
    expect(rounds).toHaveLength(7);
    expect(rounds.every((round) => round.cards.length === 9)).toBe(true);
  });
});

describe('컴플릿 결! 합! 결 일괄 제출 진행', () => {
  it('저장한 합 전체가 정답과 정확히 같을 때만 결을 외친 플레이어가 득점한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'complete-hap-correct';
    roomIds.add(roomId);
    const first = player('correct-first', '첫 번째');
    const second = player('correct-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const answers = state.rounds[0].allSets.map((set) => [...set].reverse()).reverse();
    await vi.advanceTimersByTimeAsync(1200);
    submitGyul(io, firstSocket, roomId, answers);

    expect(state.phase).toBe('round-result');
    expect(state.scores).toMatchObject({ [first.id]: 1, [second.id]: 0 });
    expect(state.roundResults[0]).toMatchObject({
      round: 1,
      callerId: first.id,
      pointPlayerId: first.id,
      correct: true,
      elapsedMs: 1200,
    });

    await vi.advanceTimersByTimeAsync(2500);
    expect(state.phase).toBe('playing');
    expect(state.currentRoundIndex).toBe(1);
  });

  it('누락·불필요한 합·중복 제출은 오답이며 상대가 각각 1점 득점한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.314159);
    const roomId = 'complete-hap-wrong';
    roomIds.add(roomId);
    const first = player('wrong-first', '첫 번째');
    const second = player('wrong-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;

    const incomplete = state.rounds[0].allSets.slice(0, -1);
    submitGyul(io, firstSocket, roomId, incomplete);
    expect(state.roundResults[0]?.correct).toBe(false);
    expect(state.scores[second.id]).toBe(1);
    await vi.advanceTimersByTimeAsync(2500);

    const secondRound = state.rounds[1];
    submitGyul(io, firstSocket, roomId, [
      ...secondRound.allSets,
      wrongTriple(secondRound.allSetKeys),
    ]);
    expect(state.roundResults[1]?.correct).toBe(false);
    expect(state.scores[second.id]).toBe(2);
    await vi.advanceTimersByTimeAsync(2500);

    const thirdRound = state.rounds[2];
    submitGyul(io, firstSocket, roomId, [...thirdRound.allSets, thirdRound.allSets[0]]);
    expect(state.roundResults[2]?.correct).toBe(false);
    expect(state.scores[second.id]).toBe(3);
  });

  it('한 플레이어가 결을 외친 뒤 같은 라운드의 후속 제출은 무시한다', () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-lock';
    roomIds.add(roomId);
    const first = player('lock-first', '첫 번째');
    const second = player('lock-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    submitGyul(io, firstSocket, roomId, []);
    submitGyul(io, secondSocket, roomId, state.rounds[0].allSets);

    expect(state.roundResults).toHaveLength(1);
    expect(state.scores).toMatchObject({ [first.id]: 0, [second.id]: 1 });
  });

  it('솔로는 7라운드가 끝나면 일곱 번의 판정 기록을 반환한다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-seven-rounds';
    roomIds.add(roomId);
    const first = player('seven-first', '첫 번째');
    const firstSocket = socketFor(first.id);
    const io = ioStub();
    const onEnd = vi.fn();

    initCompleteHap(io, roomId, [first], 'solo', Date.now(), null, onEnd);
    const state = completeHapStates.get(roomId)!;
    for (let roundIndex = 0; roundIndex < CH_TOTAL_ROUNDS; roundIndex++) {
      submitGyul(io, firstSocket, roomId, state.rounds[roundIndex].allSets);
      await vi.advanceTimersByTimeAsync(2500);
    }

    expect(state.phase).toBe('finished');
    expect(state.scores[first.id]).toBe(7);
    expect(state.roundResults).toHaveLength(7);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0]?.[2]).toMatchObject({ totalTurns: 7 });
    expect(onEnd.mock.calls[0]?.[2]?.gameResultData).toMatchObject({ totalRounds: 7 });
  });

  it('7라운드 대전에서 한 플레이어가 4점을 선취하면 남은 라운드 없이 종료한다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-clinch';
    roomIds.add(roomId);
    const first = player('clinch-first', '선취 플레이어');
    const second = player('clinch-second', '상대 플레이어');
    const firstSocket = socketFor(first.id);
    const io = ioStub();
    const onEnd = vi.fn();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, onEnd);
    const state = completeHapStates.get(roomId)!;
    for (let roundIndex = 0; roundIndex < CH_WIN_SCORE; roundIndex++) {
      submitGyul(io, firstSocket, roomId, state.rounds[roundIndex].allSets);
      await vi.advanceTimersByTimeAsync(2500);
    }

    expect(state.phase).toBe('finished');
    expect(state.currentRoundIndex).toBe(CH_WIN_SCORE - 1);
    expect(state.scores[first.id]).toBe(CH_WIN_SCORE);
    expect(state.roundResults).toHaveLength(CH_WIN_SCORE);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0]?.[2]).toMatchObject({ totalTurns: CH_WIN_SCORE });
  });

  it('솔로 모드에서 오답이면 상대 득점 없이 다음 라운드로 넘어간다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-solo-wrong';
    roomIds.add(roomId);
    const human = player('solo-player', '솔로');
    const socket = socketFor(human.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [human], 'solo', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    submitGyul(io, socket, roomId, []);
    expect(state.scores[human.id]).toBe(0);
    expect(state.roundResults[0]?.pointPlayerId).toBeNull();
    await vi.advanceTimersByTimeAsync(2500);
    expect(state.currentRoundIndex).toBe(1);
  });

  it('0:0일 때만 무승부이고, 동점 득점이면 먼저 득점한 플레이어가 우위다', async () => {
    vi.useFakeTimers();
    const roomId = 'complete-hap-speed';
    roomIds.add(roomId);
    const first = player('speed-first', '첫 번째');
    const second = player('speed-second', '두 번째');
    const firstSocket = socketFor(first.id);
    const secondSocket = socketFor(second.id);
    const io = ioStub();

    initCompleteHap(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const empty = completeHapRankings(state);
    expect(empty.tiebreak).toBe('zero-draw');

    await vi.advanceTimersByTimeAsync(1000);
    submitGyul(io, firstSocket, roomId, state.rounds[0].allSets);
    await vi.advanceTimersByTimeAsync(2500);
    await vi.advanceTimersByTimeAsync(1000);
    submitGyul(io, secondSocket, roomId, state.rounds[1].allSets);

    const result = completeHapRankings(state);
    expect(state.scores).toMatchObject({ [first.id]: 1, [second.id]: 1 });
    expect(result.tiebreak).toBe('speed');
    expect(result.rankings[0].playerId).toBe(first.id);
  });

  it('멀티는 방의 시간설정을 사용하고 COM·솔로는 기본 10분을 사용한다', () => {
    vi.useFakeTimers();
    const io = ioStub();
    const first = player('timer-first', '첫 번째');
    const second = player('timer-second', '두 번째');
    const multiRoomId = 'complete-hap-multi-timer';
    const soloRoomId = 'complete-hap-solo-timer';
    roomIds.add(multiRoomId);
    roomIds.add(soloRoomId);

    initCompleteHap(io, multiRoomId, [first, second], 'multi', Date.now(), 45, vi.fn());
    initCompleteHap(io, soloRoomId, [first], 'solo', Date.now(), null, vi.fn());
    expect(completeHapStates.get(multiRoomId)?.matchSeconds).toBe(45);
    expect(completeHapStates.get(soloRoomId)?.matchSeconds).toBe(600);
  });

  it('COM도 한 번에 모든 합을 제출해 라운드 점수를 얻는다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const roomId = 'complete-hap-com';
    roomIds.add(roomId);
    const human = player('human-com', '사람');
    const computer = player(AI_PLAYER_ID, 'COM');
    const io = ioStub();

    initCompleteHap(io, roomId, [human, computer], 'com', Date.now(), null, vi.fn());
    const state = completeHapStates.get(roomId)!;
    const delay = state.rounds[0].allSets.length * 3500;
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(state.scores[AI_PLAYER_ID]).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.scores[AI_PLAYER_ID]).toBe(1);
    expect(state.roundResults[0]).toMatchObject({ callerId: AI_PLAYER_ID, correct: true });
  });
});
