import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateNumberFourNote, clearNumberFourNote } from '../../../lib/numberFourNotes';
import {
  initNumberFour,
  handleNumberFourAction,
  emitNumberFourStateToSocket,
  cleanupNumberFour,
  getNumberFourState,
} from '../socket/games/number4/index';

const room = 'nf4-own-submission-test';
const io = { in: () => ({ fetchSockets: async () => [] }) } as any;
const socket = (id: string) => ({ id, emit: vi.fn() }) as any;
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

describe('넘버 4 라운드 메모', () => {
  it('이전 라운드를 수정하거나 지워도 다른 라운드와 플레이어 메모를 유지한다', () => {
    let notes = updateNumberFourNote({}, 1, 'opponent', 'white', 5);
    notes = updateNumberFourNote(notes, 2, 'opponent', 'white', 3);
    notes = updateNumberFourNote(notes, 1, 'another', 'black', 8);
    const edited = updateNumberFourNote(notes, 1, 'opponent', 'black', 10);
    expect(edited[1].opponent).toEqual({ white: 5, black: 10 });
    expect(edited[2].opponent.white).toBe(3);
    expect(notes[1].opponent.black).toBe(20);
    const cleared = clearNumberFourNote(edited, 1, 'opponent');
    expect(cleared[1].opponent).toBeUndefined();
    expect(cleared[1].another.black).toBe(8);
    expect(cleared[2]).toEqual(edited[2]);
    expect(clearNumberFourNote(cleared, 1, 'another')[1]).toBeUndefined();
  });
  it('범위 밖 숫자는 제한하고 소수 및 잘못된 라운드는 거부한다', () => {
    const notes = updateNumberFourNote({}, 1, 'opponent', 'white', 99);
    expect(notes[1].opponent.white).toBe(22);
    expect(updateNumberFourNote(notes, 1, 'opponent', 'black', -1)[1].opponent.black).toBe(0);
    expect(updateNumberFourNote(notes, 1, 'opponent', 'white', 1.2)).toBe(notes);
    expect(updateNumberFourNote(notes, 7, 'opponent', 'white', 1)).toBe(notes);
  });
});

describe('넘버 4 제출 정보와 결과 표시 시간', () => {
  it('현재 제출과 과거 타일 수량은 본인에게만 전송하고 결과를 5초 유지한다', async () => {
    vi.useFakeTimers();
    initNumberFour(
      io,
      room,
      [
        { id: 'p1', nickname: '나' },
        { id: 'p2', nickname: '상대' },
      ] as any,
      'multi',
      0,
      null,
      vi.fn(),
    );
    handleNumberFourAction(io, socket('p1'), room, {
      type: 'submit',
      white: 4,
      black: 3,
      number: 1,
    });
    expect(read('p1').players.p1.submission).toEqual({ white: 4, black: 3, number: 1 });
    expect(read('p2').players.p1.submission).toBeUndefined();
    expect(read('spectator').players.p1.submission).toBeUndefined();
    handleNumberFourAction(io, socket('p2'), room, {
      type: 'submit',
      white: 3,
      black: 4,
      number: 1,
    });
    expect(read('p1').revealEndsAt).toBe(Date.now() + 5000);
    const deadline = read('p1').revealEndsAt;
    expect(read('p1').roundHistory[0].players.p1).toMatchObject({ white: 4, black: 3 });
    expect(read('p1').roundHistory[0].players.p2.white).toBeUndefined();
    expect(read('p2').roundHistory[0].players.p2).toMatchObject({ white: 3, black: 4 });
    expect(read('spectator').roundHistory[0].players.p1.white).toBeUndefined();
    await vi.advanceTimersByTimeAsync(4999);
    expect(getNumberFourState(room)?.phase).toBe('reveal');
    expect(read('p1').revealEndsAt).toBe(deadline);
    await vi.advanceTimersByTimeAsync(1);
    expect(getNumberFourState(room)).toMatchObject({ phase: 'submit', round: 2 });
    expect(read('p1').players.p1.submission).toBeUndefined();
    expect(read('p1').revealEndsAt).toBeUndefined();
    expect(read('p1').roundHistory[0].players.p1.white).toBe(4);
  });
  it('최종 결과는 5초 공개 후 승패를 2초 더 표시한다', async () => {
    vi.useFakeTimers();
    const end = vi.fn();
    initNumberFour(
      io,
      room,
      [
        { id: 'p1', nickname: '나' },
        { id: 'p2', nickname: '상대' },
      ] as any,
      'multi',
      0,
      null,
      end,
    );
    getNumberFourState(room)!.round = 6;
    handleNumberFourAction(io, socket('p1'), room, {
      type: 'submit',
      white: 4,
      black: 3,
      number: 1,
    });
    handleNumberFourAction(io, socket('p2'), room, {
      type: 'submit',
      white: 3,
      black: 4,
      number: 1,
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(getNumberFourState(room)?.phase).toBe('reveal');
    expect(end).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(getNumberFourState(room)?.phase).toBe('finished');
    await vi.advanceTimersByTimeAsync(1999);
    expect(end).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('솔로의 두 자리 제출은 소유자만 볼 수 있다', () => {
    vi.useFakeTimers();
    initNumberFour(io, room, [{ id: 'p1', nickname: '나' }] as any, 'solo', 0, null, vi.fn());
    handleNumberFourAction(io, socket('p1'), room, {
      type: 'submit',
      white: 4,
      black: 3,
      number: 1,
    });
    expect(read('p1').players.p1.submission).toEqual({ white: 4, black: 3, number: 1 });
    handleNumberFourAction(io, socket('p1'), room, {
      type: 'submit',
      white: 3,
      black: 4,
      number: 1,
    });
    expect(read('p1').roundHistory[0].players.p1_p2.white).toBe(3);
    expect(read('spectator').roundHistory[0].players.p1_p2.white).toBeUndefined();
    expect(read('spectator').players.p1_p2.submission).toBeUndefined();
  });
  it('튜토리얼 역시 관전자에게 본인 제출을 공개하지 않는다', () => {
    initNumberFour(io, room, [{ id: 'p1', nickname: '나' }] as any, 'tutorial', 0, null, vi.fn());
    handleNumberFourAction(io, socket('p1'), room, { type: 'tutorial-ack' });
    handleNumberFourAction(io, socket('p1'), room, {
      type: 'submit',
      white: 4,
      black: 3,
      number: 1,
    });
    expect(read('p1').players.p1.submission?.white).toBe(4);
    expect(read('spectator').players.p1.submission).toBeUndefined();
    expect(read('spectator').roundHistory[0].players.p1.white).toBeUndefined();
  });
});
