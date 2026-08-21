import { describe, expect, it, vi } from 'vitest';
import { FC_REVEAL_MS } from '@shared/types/formula-completion.js';
import type { Player } from '@shared/types/room.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  cleanupFormulaCompletion,
  handleFormulaCompletionAction,
  initFormulaCompletion,
} from '../socket/games/formula-completion/index.js';
import { FC_FINISH_DISPLAY_MS } from '../socket/games/formula-completion/constants.js';
import { judgeExpression } from '../socket/games/formula-completion/expression.js';
import { generatePuzzle } from '../socket/games/formula-completion/generator.js';
import { formulaCompletionStates } from '../socket/games/formula-completion/state.js';

describe('수식완성N 수식 판정', () => {
  it('예시 수식 4*6+7-5를 Target 26의 정답으로 인정한다', () => {
    const result = judgeExpression('4*6+7-5', [4, 5, 6, 7], 26);
    expect(result.correct).toBe(true);
    expect(result.evaluatedValue).toBe('26');
  });

  it('곱셈·나눗셈 기호와 괄호를 지원한다', () => {
    const result = judgeExpression('(8 ÷ 4) × (7 + 3)', [8, 4, 7, 3], 20);
    expect(result.correct).toBe(true);
  });

  it('중간 계산이 분수여도 정확한 유리수로 판정한다', () => {
    const result = judgeExpression('(3 / 2) * 8 + 4', [3, 2, 8, 4], 16);
    expect(result.correct).toBe(true);
  });

  it('숫자를 빼먹거나 반복하면 오답 처리한다', () => {
    expect(judgeExpression('4*6+7', [4, 5, 6, 7], 31).correct).toBe(false);
    expect(judgeExpression('4*6+7-4', [4, 5, 6, 7], 31).correct).toBe(false);
  });

  it('숫자 이어붙이기와 0 나누기를 거부한다', () => {
    expect(judgeExpression('45+6+7', [4, 5, 6, 7], 58).correct).toBe(false);
    const dividedByZero = judgeExpression('4/(7-7)+5', [4, 5, 7, 7], 5);
    expect(dividedByZero.correct).toBe(false);
    expect(dividedByZero.reason).toContain('0으로');
  });
});

describe('수식완성N 출제기', () => {
  it.each([4, 5, 6])('N=%i 퍼즐에 검증 가능한 해답을 포함한다', (numberCount) => {
    const used = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const puzzle = generatePuzzle(numberCount, used);
      used.add(puzzle.key);
      expect(puzzle.numbers).toHaveLength(numberCount);
      expect(puzzle.target).toBeGreaterThan(0);
      expect(judgeExpression(puzzle.solution, puzzle.numbers, puzzle.target).correct).toBe(true);
    }
  });
});

describe('수식완성N 1:1 솔로', () => {
  it('1명으로 9라운드를 완주하고 단일 랭킹을 반환한다', async () => {
    vi.useFakeTimers();
    const roomId = 'formula-solo-test';
    const player: Player = {
      id: 'formula-solo-player',
      nickname: '솔로 플레이어',
      isHost: true,
      isReady: true,
      joinedAt: Date.now(),
    };
    const io = {
      in: () => ({ fetchSockets: async () => [] }),
    } as unknown as IO;
    const socket = {
      id: 'formula-solo-socket',
      emit: vi.fn(),
    } as unknown as TypedSocket;
    const onEnd = vi.fn();

    sessions.linkToken(socket.id, player.id);
    try {
      initFormulaCompletion(io, roomId, [player], 'solo', Date.now(), null, onEnd, {
        numberCount: 4,
      });

      const initial = formulaCompletionStates.get(roomId);
      expect(initial?.players[0].id).toBe(player.id);
      expect(initial?.players[1].id).toBe(player.id);

      for (let round = 1; round <= 9; round++) {
        const state = formulaCompletionStates.get(roomId);
        expect(state?.round).toBe(round);
        handleFormulaCompletionAction(io, socket, roomId, {
          type: 'submit',
          expression: state?.solution,
        });
        await vi.advanceTimersByTimeAsync(FC_REVEAL_MS);
      }
      await vi.advanceTimersByTimeAsync(FC_FINISH_DISPLAY_MS);

      expect(onEnd).toHaveBeenCalledOnce();
      const payload = onEnd.mock.calls[0]?.[2];
      expect(payload?.rankings).toEqual([
        { playerId: player.id, nickname: player.nickname, rank: 1, score: 9 },
      ]);
      expect(payload?.totalTurns).toBe(9);
    } finally {
      cleanupFormulaCompletion(roomId);
      sessions.removeSession(socket.id);
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
