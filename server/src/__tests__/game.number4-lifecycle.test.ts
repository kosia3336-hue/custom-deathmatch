import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_PLAYER_ID } from '../../../shared/types/room';
import {
  initNumberFour,
  handleNumberFourAction,
  cleanupNumberFour,
  getNumberFourState,
  performNumberFourUndo,
} from '../socket/games/number4/index';
import {
  validateNumberFourSubmission,
  numberFourTileBounds,
} from '../../../shared/numberFourSubmission';
import { buildNumberFourViewModel } from '../../../lib/numberFourView';
import { emitNumberFourStateToSocket } from '../socket/games/number4/index';

const room = 'nf4-lifecycle';
const io = { in: () => ({ fetchSockets: async () => [] }) } as any;
const socket = (id: string) => ({ id, emit: vi.fn() }) as any;
function init(limit: number | null = null, mode: 'multi' | 'solo' = 'multi', end = vi.fn()) {
  initNumberFour(
    io,
    room,
    [
      { id: 'p1', nickname: '나' },
      { id: 'p2', nickname: '상대' },
    ] as any,
    mode,
    Date.now(),
    limit,
    end,
  );
  return end;
}
function submit(id: string) {
  handleNumberFourAction(io, socket(id), room, { type: 'submit', white: 4, black: 3, number: 1 });
}
function read(id: string) {
  const viewer = socket(id);
  emitNumberFourStateToSocket(viewer, room);
  return viewer.emit.mock.calls.find((call: any[]) => call[0] === 'game:state')[1].gameData;
}
afterEach(() => {
  cleanupNumberFour(room);
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('넘버 4 경기 수명과 취소', () => {
  it('최종 결과 지연 중 같은 방에서 새 경기를 시작해도 이전 경기 콜백은 실행되지 않는다', async () => {
    vi.useFakeTimers();
    const oldEnd = init();
    getNumberFourState(room)!.round = 6;
    submit('p1');
    submit('p2');
    expect(vi.getTimerCount()).toBe(1);
    const newEnd = init();
    const current = getNumberFourState(room);
    await vi.advanceTimersByTimeAsync(8000);
    expect(getNumberFourState(room)).toBe(current);
    expect(current).toMatchObject({ round: 1, phase: 'submit', gameOver: false });
    expect(oldEnd).not.toHaveBeenCalled();
    expect(newEnd).not.toHaveBeenCalled();
  });
  it('이전 COM 경기의 지연 제출이 새 경기 상태를 건드리지 않는다', async () => {
    vi.useFakeTimers();
    initNumberFour(
      io,
      room,
      [
        { id: 'p1', nickname: '나' },
        { id: AI_PLAYER_ID, nickname: 'AI' },
      ] as any,
      'com',
      Date.now(),
      null,
      vi.fn(),
    );
    const old = getNumberFourState(room)!;
    submit('p1');
    init();
    await vi.advanceTimersByTimeAsync(5000);
    expect(old.player2.submitted).toBe(false);
    expect(getNumberFourState(room)).toMatchObject({ round: 1, phase: 'submit' });
  });
  it('결과 공개 중 방을 정리하면 다음 라운드 타이머도 취소된다', async () => {
    vi.useFakeTimers();
    const end = init();
    submit('p1');
    submit('p2');
    cleanupNumberFour(room);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(8000);
    expect(getNumberFourState(room)).toBeUndefined();
    expect(end).not.toHaveBeenCalled();
  });
  it('결과 공개를 무르면 점수/잔여 타일/기록을 복원하고 예약된 다음 라운드는 진행하지 않는다', async () => {
    vi.useFakeTimers();
    init();
    const before = read('p1');
    submit('p1');
    submit('p2');
    expect(performNumberFourUndo(io, room)).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    const after = read('p1');
    expect(after).toMatchObject({ round: 1, phase: 'submit', roundHistory: [] });
    expect(after.players.p1).toEqual(before.players.p1);
    expect(after.revealEndsAt).toBeUndefined();
  });
  it('무르기 불가 요청은 현재 제한 시간을 지우지 않는다', async () => {
    vi.useFakeTimers();
    init(3);
    expect(performNumberFourUndo(io, room)).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(getNumberFourState(room)).toMatchObject({ round: 1, phase: 'reveal' });
  });
  it('제한 시간에 한 사람만 제출했다면 시간 초과 패배를 판정한다', async () => {
    vi.useFakeTimers();
    const end = init(3);
    submit('p1');
    await vi.advanceTimersByTimeAsync(3000);
    expect(getNumberFourState(room)).toMatchObject({
      phase: 'finished',
      winner: 'p1',
      winType: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(end).toHaveBeenCalledTimes(1);
  });
});

describe('넘버 4 조작자 및 제출 계약', () => {
  it('관전자는 솔로 두 자리 어느 쪽도 제출할 수 없다', () => {
    init(null, 'solo');
    submit('spectator');
    expect(getNumberFourState(room)!.player1.submitted).toBe(false);
    submit('p1');
    submit('spectator');
    expect(getNumberFourState(room)!.player2.submitted).toBe(false);
    const view = buildNumberFourViewModel(read('p1'), 'p1', false);
    expect(view.player?.id).toBe('p1_p2');
    expect(view.canChoose).toBe(true);
    expect(buildNumberFourViewModel(read('spectator'), 'spectator', true).canChoose).toBe(false);
    submit('p1');
    expect(getNumberFourState(room)!.phase).toBe('reveal');
  });
  it('남은 타일에 맞춰 범위를 제한하며 비정수/잘못된 합계/보유 초과를 거부한다', () => {
    const stock = { remainingWhite: 2, remainingBlack: 6 };
    expect(numberFourTileBounds(stock)).toEqual({ minWhite: 1, maxWhite: 2, initialWhite: 2 });
    expect(validateNumberFourSubmission(2, 5, 4, stock)).toMatchObject({ ok: true });
    expect(validateNumberFourSubmission(1.5, 5.5, 1, stock)).toEqual({ ok: false, reason: 'type' });
    expect(validateNumberFourSubmission(2, 4, 1, stock)).toEqual({ ok: false, reason: 'sum' });
    expect(validateNumberFourSubmission(2, 5, 5, stock)).toEqual({ ok: false, reason: 'number' });
    expect(validateNumberFourSubmission(3, 4, 1, stock)).toEqual({ ok: false, reason: 'stock' });
    init();
    handleNumberFourAction(io, socket('p1'), room, {
      type: 'submit',
      white: 4,
      black: 3,
      number: 1.5,
    });
    expect(getNumberFourState(room)!.player1.submitted).toBe(false);
  });
});
