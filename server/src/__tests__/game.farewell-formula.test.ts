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
  it('정수·유리수·제곱·루트·팩토리얼과 괄호를 정확히 계산한다', () => {
    expect(evaluateFarewellEquation('2^3×8-64=0').correct).toBe(true);
    expect(evaluateFarewellEquation('[8÷(3-1)]=4').correct).toBe(true);
    expect(evaluateFarewellEquation('1÷3+1÷3=2÷3').correct).toBe(true);
    expect(evaluateFarewellEquation('√9+3!=9').correct).toBe(true);
    expect(evaluateFarewellEquation('√(9÷16)=3÷4').correct).toBe(true);
    expect(evaluateFarewellEquation('√2=1').correct).toBe(false);
    expect(evaluateFarewellEquation('21!=1').correct).toBe(false);
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
      expect(puzzle.goodbyeCount, puzzle.source).toBeGreaterThanOrEqual(2);
      const solved = findMinimumFarewellSolutions(puzzle.source, puzzle.goodbyeCount, 1);
      expect(solved.minimum, puzzle.source).toBe(puzzle.goodbyeCount);
      expect(solved.solutions[0]?.expression, puzzle.source).toBeTruthy();
    }
  });

  it('어려움 문제은행은 제곱·루트·팩토리얼을 모두 포함한다', () => {
    const sources = getFarewellFormulaPuzzleBank('hard').map((puzzle) => puzzle.source);
    expect(sources.some((source) => source.includes('^'))).toBe(true);
    expect(sources.some((source) => source.includes('√'))).toBe(true);
    expect(sources.some((source) => source.includes('!'))).toBe(true);
  });
});

describe('이별 공식 대전', () => {
  it('어려움 설정으로 시작하면 특수 기호 문제를 출제한다', () => {
    const roomId = 'farewell-formula-hard';
    const players: Player[] = [
      {
        id: 'hard-first',
        nickname: '플레이어 1',
        isHost: true,
        isReady: true,
        joinedAt: Date.now(),
      },
      {
        id: 'hard-second',
        nickname: '플레이어 2',
        isHost: false,
        isReady: true,
        joinedAt: Date.now(),
      },
    ];
    const io = { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
    initFarewellFormula(io, roomId, players, 'multi', Date.now(), null, vi.fn(), {
      farewellDifficulty: 'hard',
    });
    try {
      const state = farewellFormulaStates.get(roomId)!;
      expect(state.difficulty).toBe('hard');
      expect(state.puzzle.difficulty).toBe('hard');
      expect(state.puzzle.source).toMatch(/(?:\^|√|!)/);
    } finally {
      cleanupFarewellFormula(roomId);
    }
  });

  it('오답은 상대에게 1점을 주고 라운드를 끝내며, 4점 선취 시 종료한다', async () => {
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
      const opening = farewellFormulaStates.get(roomId)!;
      const allUnitIds = [...new Set(opening.puzzle.tokens.map((token) => token.unitId))];
      let wrongUnits: number[] | null = null;
      for (let firstIndex = 0; firstIndex < allUnitIds.length && !wrongUnits; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < allUnitIds.length; secondIndex++) {
          const candidate = [allUnitIds[firstIndex]!, allUnitIds[secondIndex]!];
          const expression = buildFarewellExpression(opening.puzzle.tokens, candidate);
          if (!evaluateFarewellEquation(expression).correct) {
            wrongUnits = candidate;
            break;
          }
        }
      }
      expect(wrongUnits).not.toBeNull();
      handleFarewellFormulaAction(io, socket, roomId, {
        type: 'submit',
        removedUnitIds: wrongUnits!,
      });
      expect(farewellFormulaStates.get(roomId)?.phase).toBe('reveal');
      expect(farewellFormulaStates.get(roomId)?.scores[first.id]).toBe(0);
      expect(farewellFormulaStates.get(roomId)?.scores[second.id]).toBe(1);
      expect(farewellFormulaStates.get(roomId)?.lastResult).toMatchObject({
        outcome: 'wrong',
        callerId: first.id,
        scorerId: second.id,
      });
      await vi.advanceTimersByTimeAsync(FF_REVEAL_MS);

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
      expect(finished.round).toBe(FF_WIN_SCORE + 1);
      expect(finished.history).toHaveLength(FF_WIN_SCORE + 1);
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
