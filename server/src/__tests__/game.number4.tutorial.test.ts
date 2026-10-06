import { describe, it, expect, vi } from 'vitest';
import {
  createNumberFourTutorial,
  advanceNumberFourTutorial,
  NUMBER_FOUR_LESSONS,
} from '@shared/numberFourTutorial';
import {
  initNumberFour,
  handleNumberFourAction,
  cleanupNumberFour,
  getNumberFourState,
  canNumberFourUndo,
  emitNumberFourStateToSocket,
} from '../socket/games/number4/index';

describe('넘버 4 튜토리얼', () => {
  it('모든 넘버와 실패 감점을 배우고 결과 확인 후에만 완료한다', () => {
    let data = advanceNumberFourTutorial(createNumberFourTutorial('owner', '나'), {
      type: 'tutorial-ack',
    }).data;
    for (const lesson of NUMBER_FOUR_LESSONS) {
      expect(data.tutorial?.step).toBe('choose');
      expect(advanceNumberFourTutorial(data, { type: 'tutorial-ack' }).error).toBeTruthy();
      const action = {
        type: 'submit' as const,
        white: lesson.white,
        black: 7 - lesson.white,
        number: lesson.number,
      };
      const result = advanceNumberFourTutorial(data, action);
      expect(result.error).toBeUndefined();
      data = result.data;
      expect(data.phase).toBe('reveal');
      expect(advanceNumberFourTutorial(data, action).data).toBe(data);
      data = advanceNumberFourTutorial(data, { type: 'tutorial-ack' }).data;
    }
    expect(data.tutorial?.step).toBe('summary');
    expect(data.roundHistory).toHaveLength(6);
    expect(data.players.owner).toMatchObject({ score: 17, remainingWhite: 0, remainingBlack: 0 });
    expect(data.roundHistory[5].players.owner.scoreChange).toBe(-1);
    expect(advanceNumberFourTutorial(data, { type: 'tutorial-ack' })).toMatchObject({
      complete: true,
      data: { phase: 'finished' },
    });
  });
  it('잘못된 선택은 단계와 타일을 유지한다', () => {
    const data = advanceNumberFourTutorial(createNumberFourTutorial('owner', '나'), {
      type: 'tutorial-ack',
    }).data;
    const result = advanceNumberFourTutorial(data, {
      type: 'submit',
      white: 4,
      black: 3,
      number: 0,
    });
    expect(result.error).toBeTruthy();
    expect(result.data).toBe(data);
    expect(data.players.owner.remainingWhite).toBe(22);
  });
  it('서버는 한 명으로 시작하고 관전 진행과 중복 완료를 차단한다', () => {
    const io = { in: () => ({ fetchSockets: async () => [] }) } as any;
    const end = vi.fn();
    const owner = { id: 'owner', emit: vi.fn() } as any;
    const stranger = { id: 'spectator', emit: vi.fn() } as any;
    const room = 'nf4-tutorial-test';
    initNumberFour(io, room, [{ id: 'owner', nickname: '나' }] as any, 'tutorial', 0, 30, end);
    expect(getNumberFourState(room)?.timeLimitSeconds).toBeNull();
    expect(canNumberFourUndo(room)).toBe(false);
    handleNumberFourAction(io, stranger, room, { type: 'tutorial-ack' });
    expect(stranger.emit).toHaveBeenCalledWith('error', expect.anything());
    expect(getNumberFourState(room)?.tutorialData?.tutorial?.step).toBe('intro');
    handleNumberFourAction(io, owner, room, { type: 'tutorial-ack' });
    emitNumberFourStateToSocket(owner, room);
    const payload = owner.emit.mock.calls.find((c: any[]) => c[0] === 'game:state')[1];
    expect(payload.gameData.tutorial.step).toBe('choose');
    expect(payload.gameData.players.tutorial_guide.remainingWhite).toBe(-1);
    for (const lesson of NUMBER_FOUR_LESSONS) {
      handleNumberFourAction(io, owner, room, {
        type: 'submit',
        white: lesson.white,
        black: 7 - lesson.white,
        number: lesson.number,
      });
      handleNumberFourAction(io, owner, room, { type: 'tutorial-ack' });
    }
    expect(end).not.toHaveBeenCalled();
    handleNumberFourAction(io, owner, room, { type: 'tutorial-ack' });
    handleNumberFourAction(io, owner, room, { type: 'tutorial-ack' });
    expect(end).toHaveBeenCalledTimes(1);
    expect(end.mock.calls[0][2].gameResultData).toMatchObject({
      tutorial: true,
      finalScores: { owner: 17 },
      players: { owner: { nickname: '나' } },
      roundHistory: expect.arrayContaining([expect.objectContaining({ round: 6 })]),
    });
    cleanupNumberFour(room);
    expect(getNumberFourState(room)).toBeUndefined();
  });
});
