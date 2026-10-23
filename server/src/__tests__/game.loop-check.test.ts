import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLoopCheckPath, areLoopCheckNeighbors } from '@shared/logic/loop-check.js';
import {
  LOOP_CHECK_REVEAL_MS,
  resolveLoopCheckOptions,
  type LoopCheckBoard,
} from '@shared/types/loop-check.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import { generateLoopCheckBoard } from '../socket/games/loop-check/generator.js';
import {
  initLoopCheck,
  handleLoopCheckAction,
  cleanupLoopCheck,
} from '../socket/games/loop-check/index.js';
import { loopCheckStates, toLoopCheckGameData } from '../socket/games/loop-check/state.js';
import type { IO, TypedSocket } from '../socket/types.js';

const firstPath = [0, 1, 2, 3, 4, 10, 9, 8, 7, 6];
const secondPath = [24, 25, 26, 27, 28, 34, 33, 32, 31, 30];
function multipleAnswerBoard(): LoopCheckBoard {
  const cells = Array<number>(36).fill(5);
  for (const path of [firstPath, secondPath])
    path.forEach((cell, index) => {
      cells[cell] = index % 5;
    });
  return { cells };
}
function seededRandom() {
  let seed = 7318;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('루프체크 경로·출제', () => {
  it('정방향·역방향·저장된 경로와 다른 복수 정답을 허용한다', () => {
    const board = multipleAnswerBoard();
    expect(validateLoopCheckPath(board, firstPath)).toBeNull();
    expect(validateLoopCheckPath(board, [...firstPath].reverse())).toBeNull();
    expect(validateLoopCheckPath(board, secondPath)).toBeNull();
  });
  it('칸 재방문·대각선·행 경계 넘어가기·색 중복·반복 순서 오류와 변조 입력을 거부한다', () => {
    const board = multipleAnswerBoard();
    expect(areLoopCheckNeighbors(5, 6)).toBe(false);
    for (const path of [
      null,
      [],
      firstPath.slice(1),
      [...firstPath.slice(0, 9), 0],
      [NaN, ...firstPath.slice(1)],
      ['0', ...firstPath.slice(1)],
      [36, ...firstPath.slice(1)],
      [0, 7, ...firstPath.slice(2)],
    ])
      expect(validateLoopCheckPath(board, path)).not.toBeNull();
    const duplicate = { cells: [...board.cells] };
    duplicate.cells[1] = 0;
    expect(validateLoopCheckPath(duplicate, firstPath)).not.toBeNull();
    const mismatch = { cells: [...board.cells] };
    mismatch.cells[10] = 1;
    expect(validateLoopCheckPath(mismatch, firstPath)).not.toBeNull();
  });
  it('매번 6색으로 된 6×6 판과 유효한 10칸 정답을 보장한다', () => {
    const random = seededRandom();
    const keys = new Set<string>();
    for (let index = 0; index < 200; index++) {
      const { board, solution } = generateLoopCheckBoard(random);
      expect(board.cells).toHaveLength(36);
      expect(new Set(board.cells).size).toBe(6);
      expect(validateLoopCheckPath(board, solution)).toBeNull();
      expect(validateLoopCheckPath(board, [...solution].reverse())).toBeNull();
      keys.add(board.cells.join(','));
    }
    expect(keys.size).toBeGreaterThan(190);
    const repeatedRandom = generateLoopCheckBoard(() => 0);
    expect(validateLoopCheckPath(repeatedRandom.board, repeatedRandom.solution)).toBeNull();
  });
  it('경기 방식은 기본 5전이며 3·7전과 색약 모드를 서버에서 검증한다', () => {
    expect(resolveLoopCheckOptions()).toEqual({ bestOf: 5, winScore: 3, colorMode: 'standard' });
    expect(
      resolveLoopCheckOptions({ loopCheckBestOf: 3, loopCheckColorMode: 'colorblind' }),
    ).toEqual({ bestOf: 3, winScore: 2, colorMode: 'colorblind' });
    expect(
      resolveLoopCheckOptions({ loopCheckBestOf: 99, loopCheckColorMode: 'invalid' }).bestOf,
    ).toBe(5);
  });
});

const io = { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
const players: Player[] = ['lc-first', 'lc-second'].map((id, index) => ({
  id,
  nickname: `참가자 ${index + 1}`,
  isHost: index === 0,
  isReady: true,
  joinedAt: 0,
}));
const socket = (id: string) => ({ id, emit: vi.fn() }) as unknown as TypedSocket;
afterEach(() => {
  for (const roomId of [...loopCheckStates.keys()]) cleanupLoopCheck(roomId);
  vi.useRealTimers();
});

describe('루프체크 대전', () => {
  it.each([3, 5, 7])('%i전에서 승리 점수 선취 후 종료하고 결과를 보존한다', async (bestOf) => {
    vi.useFakeTimers();
    const end = vi.fn();
    const roomId = `lc-best-${bestOf}`;
    initLoopCheck(io, roomId, players, 'multi', Date.now(), null, end, { loopCheckBestOf: bestOf });
    const winScore = Math.floor(bestOf / 2) + 1;
    for (let score = 1; score <= winScore; score++) {
      const state = loopCheckStates.get(roomId)!;
      handleLoopCheckAction(io, socket(players[0]!.id), roomId, {
        type: 'submit',
        roundId: state.roundId,
        path: state.solution,
      });
      expect(state.scores[players[0]!.id]).toBe(score);
      // 같은 라운드에 뒤늦게 들어온 상대 제출은 득점하지 않는다.
      handleLoopCheckAction(io, socket(players[1]!.id), roomId, {
        type: 'submit',
        roundId: state.roundId,
        path: state.solution,
      });
      expect(state.scores[players[1]!.id]).toBe(0);
      await vi.advanceTimersByTimeAsync(LOOP_CHECK_REVEAL_MS);
    }
    expect(loopCheckStates.get(roomId)?.phase).toBe('finished');
    await vi.advanceTimersByTimeAsync(3000);
    expect(end).toHaveBeenCalledOnce();
    expect(end.mock.calls[0]?.[2].rankings[0]).toMatchObject({
      playerId: players[0]!.id,
      score: winScore,
      rank: 1,
    });
    expect(end.mock.calls[0]?.[2].gameResultData.history).toHaveLength(winScore);
  });
  it('임의의 다른 정답도 채점하고 오답 피드백·정답·탐색 경로는 상대에게 노출하지 않는다', () => {
    const roomId = 'lc-private';
    initLoopCheck(io, roomId, players, 'multi', Date.now(), null, vi.fn());
    const state = loopCheckStates.get(roomId)!;
    state.board = multipleAnswerBoard();
    state.solution = firstPath;
    handleLoopCheckAction(io, socket(players[0]!.id), roomId, {
      type: 'submit',
      roundId: state.roundId,
      path: [],
    });
    expect(state.phase).toBe('playing');
    expect(toLoopCheckGameData(state, players[0]!.id).myFeedback).not.toBeNull();
    const opponent = toLoopCheckGameData(state, players[1]!.id);
    expect(opponent.myFeedback).toBeNull();
    expect(opponent).not.toHaveProperty('solution');
    expect(opponent).not.toHaveProperty('paths');
    handleLoopCheckAction(io, socket(players[1]!.id), roomId, {
      type: 'submit',
      roundId: state.roundId,
      path: secondPath,
    });
    expect(state.lastResult?.path).toEqual(secondPath);
    expect(state.scores[players[1]!.id]).toBe(1);
  });
  it('관전자와 지난 라운드의 제출을 거부하고 재접속에는 현재 판만 전달한다', async () => {
    vi.useFakeTimers();
    const roomId = 'lc-stale';
    initLoopCheck(io, roomId, players, 'multi', Date.now(), null, vi.fn());
    const state = loopCheckStates.get(roomId)!;
    const oldId = state.roundId;
    handleLoopCheckAction(io, socket('spectator'), roomId, {
      type: 'submit',
      roundId: oldId,
      path: state.solution,
    });
    expect(state.phase).toBe('playing');
    handleLoopCheckAction(io, socket(players[0]!.id), roomId, {
      type: 'submit',
      roundId: oldId,
      path: state.solution,
    });
    await vi.advanceTimersByTimeAsync(LOOP_CHECK_REVEAL_MS);
    handleLoopCheckAction(io, socket(players[0]!.id), roomId, {
      type: 'submit',
      roundId: oldId,
      path: state.solution,
    });
    expect(state.round).toBe(2);
    expect(state.history).toHaveLength(1);
    expect(state.phase).toBe('playing');
    expect(toLoopCheckGameData(state, null).lastResult).toBeNull();
  });
  it('시간 종료는 무득점으로 재출제하며 늦은 정답을 채점하지 않는다', async () => {
    vi.useFakeTimers();
    const roomId = 'lc-timeout';
    initLoopCheck(io, roomId, players, 'multi', Date.now(), 10, vi.fn());
    const state = loopCheckStates.get(roomId)!;
    vi.setSystemTime(state.roundStartedAt + 10_000);
    handleLoopCheckAction(io, socket(players[0]!.id), roomId, {
      type: 'submit',
      roundId: state.roundId,
      path: state.solution,
    });
    expect(state.lastResult?.outcome).toBe('timeout');
    expect(state.scores[players[0]!.id]).toBe(0);
    const oldId = state.roundId;
    await vi.advanceTimersByTimeAsync(LOOP_CHECK_REVEAL_MS);
    expect(state.round).toBe(1);
    expect(state.roundId).not.toBe(oldId);
  });
  it('COM은 지연 제출하고 솔로는 설정된 모든 라운드를 진행한다', async () => {
    vi.useFakeTimers();
    initLoopCheck(
      io,
      'lc-com',
      [players[0]!, { ...players[1]!, id: AI_PLAYER_ID }],
      'com',
      Date.now(),
      null,
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(14_000);
    expect(loopCheckStates.get('lc-com')?.scores[AI_PLAYER_ID]).toBe(1);
    cleanupLoopCheck('lc-com');
    initLoopCheck(io, 'lc-solo', [players[0]!], 'solo', Date.now(), null, vi.fn(), {
      loopCheckBestOf: 3,
    });
    for (let round = 0; round < 3; round++) {
      const state = loopCheckStates.get('lc-solo')!;
      handleLoopCheckAction(io, socket(players[0]!.id), 'lc-solo', {
        type: 'submit',
        roundId: state.roundId,
        path: state.solution,
      });
      await vi.advanceTimersByTimeAsync(LOOP_CHECK_REVEAL_MS);
    }
    expect(loopCheckStates.get('lc-solo')?.phase).toBe('finished');
    expect(loopCheckStates.get('lc-solo')?.history).toHaveLength(3);
  });
});
