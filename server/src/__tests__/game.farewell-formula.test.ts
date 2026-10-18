import { describe, expect, it, vi } from 'vitest';
import {
  buildFarewellExpression,
  evaluateFarewellEquation,
  findMinimumFarewellSolutions,
  tokenizeFarewellFormula,
} from '@shared/logic/farewell-formula.js';
import { FF_REVEAL_MS, FF_WIN_SCORE } from '@shared/types/farewell-formula.js';
import type { Player } from '@shared/types/room.js';
import { sessions } from '../store/sessions.js';
import {
  cleanupFarewellFormula,
  handleFarewellFormulaAction,
  initFarewellFormula,
} from '../socket/games/farewell-formula/index.js';
import { getFarewellFormulaPuzzleBank } from '../socket/games/farewell-formula/generator.js';
import { farewellFormulaStates } from '../socket/games/farewell-formula/state.js';
import type { IO, TypedSocket } from '../socket/types.js';

describe('이별 공식 수식 판정', () => {
  it('정수·유리수·거듭제곱과 두 종류 괄호를 정확히 계산한다', () => {
    expect(evaluateFarewellEquation('2^3×8-64=0').correct).toBe(true);
    expect(evaluateFarewellEquation('[8÷(3-1)]=4').correct).toBe(true);
    expect(evaluateFarewellEquation('1÷3+1÷3=2÷3').correct).toBe(true);
    expect(evaluateFarewellEquation('1÷0=2').correct).toBe(false);
    expect(evaluateFarewellEquation('1=1=1').correct).toBe(false);
  });

  it('숫자는 한 글자씩, 괄호는 한 쌍을 하나의 이별 단위로 묶는다', () => {
    const layout = tokenizeFarewellFormula('12+[3]=4');
    expect(layout.tokens[0]?.unitId).not.toBe(layout.tokens[1]?.unitId);
    expect(layout.tokens[3]?.text).toBe('[');
    expect(layout.tokens[3]?.unitId).toBe(layout.tokens[5]?.unitId);
  });

  it('제시 예시는 규칙상 최소 3회지만, 5회 삭제 정답도 성립한다', () => {
    const source = '2^3×8-64=4+2-[4×(5+2)]';
    const minimum = findMinimumFarewellSolutions(source, 5);
    expect(minimum.minimum).toBe(3);

    const layout = tokenizeFarewellFormula(source);
    const exactFiveUnits = [9, 13, 15, 16, 17].map((position) => layout.tokens[position]!.unitId);
    expect(new Set(exactFiveUnits).size).toBe(5);
    const expression = buildFarewellExpression(layout.tokens, exactFiveUnits);
    expect(expression).toBe('2^3×8-64=+2-4+2');
    expect(evaluateFarewellEquation(expression).correct).toBe(true);
  });
});

describe('이별 공식 문제은행', () => {
  it('모든 문제의 지정 이별 횟수가 실제 최소 삭제 횟수다', () => {
    const bank = getFarewellFormulaPuzzleBank();
    expect(bank.length).toBeGreaterThanOrEqual(20);
    for (const puzzle of bank) {
      const solved = findMinimumFarewellSolutions(puzzle.source, puzzle.goodbyeCount, 1);
      expect(solved.minimum, puzzle.source).toBe(puzzle.goodbyeCount);
      expect(solved.solutions[0]?.expression, puzzle.source).toBeTruthy();
    }
  });
});

describe('이별 공식 대전', () => {
  it('오답에는 점수를 주지 않고 라운드를 유지하며, 4점 선취 시 종료한다', async () => {
    vi.useFakeTimers();
    const roomId = 'farewell-formula-clinch';
    const first: Player = {
      id: 'farewell-first',
      nickname: '선취 플레이어',
      isHost: true,
      isReady: true,
      joinedAt: Date.now(),
    };
    const second: Player = {
      id: 'farewell-second',
      nickname: '상대 플레이어',
      isHost: false,
      isReady: true,
      joinedAt: Date.now(),
    };
    const io = { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
    const socket = { id: 'farewell-socket', emit: vi.fn() } as unknown as TypedSocket;
    const onEnd = vi.fn();

    sessions.linkToken(socket.id, first.id);
    try {
      initFarewellFormula(io, roomId, [first, second], 'multi', Date.now(), null, onEnd);
      handleFarewellFormulaAction(io, socket, roomId, {
        type: 'submit',
        removedUnitIds: [],
      });
      expect(farewellFormulaStates.get(roomId)?.phase).toBe('playing');
      expect(farewellFormulaStates.get(roomId)?.scores[first.id]).toBe(0);
      await vi.advanceTimersByTimeAsync(400);

      for (let score = 1; score <= FF_WIN_SCORE; score++) {
        const state = farewellFormulaStates.get(roomId)!;
        handleFarewellFormulaAction(io, socket, roomId, {
          type: 'submit',
          removedUnitIds: state.puzzle.solutions[0]!.removedUnitIds,
        });
        expect(state.scores[first.id]).toBe(score);
        await vi.advanceTimersByTimeAsync(FF_REVEAL_MS);
      }

      const finished = farewellFormulaStates.get(roomId)!;
      expect(finished.phase).toBe('finished');
      expect(finished.round).toBe(FF_WIN_SCORE);
      expect(finished.history).toHaveLength(FF_WIN_SCORE);
      await vi.advanceTimersByTimeAsync(3000);
      expect(onEnd).toHaveBeenCalledOnce();
      expect(onEnd.mock.calls[0]?.[2]?.rankings?.[0]).toMatchObject({
        playerId: first.id,
        rank: 1,
        score: FF_WIN_SCORE,
      });
    } finally {
      cleanupFarewellFormula(roomId);
      sessions.removeSession(socket.id);
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
