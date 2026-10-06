import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  updateNumberFourNote,
  clearNumberFourNote,
  initializeNumberFourNotes,
} from '../../../lib/numberFourNotes';
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
  it('이전 라운드를 수정하거나 초기화해도 다른 라운드와 플레이어 메모를 유지한다', () => {
    let notes = updateNumberFourNote({}, 1, 'opponent', 'white', 5);
    notes = updateNumberFourNote(notes, 2, 'opponent', 'white', 3);
    notes = updateNumberFourNote(notes, 1, 'another', 'black', 8);
    const edited = updateNumberFourNote(notes, 1, 'opponent', 'black', 10);
    expect(edited[1].opponent).toEqual({ white: 5, black: 10 });
    expect(edited[2].opponent.white).toBe(3);
    expect(notes[1].opponent.black).toBe(20);
    const cleared = clearNumberFourNote(edited, 1, 'opponent');
    expect(cleared[1].opponent).toEqual({ white: 22, black: 20 });
    expect(cleared[1].another.black).toBe(8);
    expect(cleared[2]).toEqual(edited[2]);
    expect(clearNumberFourNote(cleared, 1, 'another')[1].another).toEqual({ white: 22, black: 20 });
  });
  it('최초 메모는 최대치이고 새 라운드는 이전 값을 복사하며 과거 수정과 독립적이다', () => {
    let notes = initializeNumberFourNotes({}, 1, ['opponent', 'another']);
    expect(notes[1].opponent).toEqual({ white: 22, black: 20 });
    notes = updateNumberFourNote(notes, 1, 'opponent', 'white', 16);
    notes = updateNumberFourNote(notes, 1, 'opponent', 'black', 18);
    const round2 = initializeNumberFourNotes(notes, 2, ['opponent', 'another']);
    expect(round2[2].opponent).toEqual({ white: 16, black: 18 });
    expect(round2[2].opponent).not.toBe(round2[1].opponent);
    expect(round2[2].another).toEqual({ white: 22, black: 20 });
    const edited = updateNumberFourNote(round2, 1, 'opponent', 'white', 10);
    expect(edited[2].opponent).toEqual({ white: 16, black: 18 });
    expect(initializeNumberFourNotes(edited, 2, ['opponent', 'another'])).toBe(edited);
    const reset = clearNumberFourNote(edited, 2, 'opponent');
    expect(reset[2].opponent).toEqual({ white: 22, black: 20 });
    expect(reset[1].opponent.white).toBe(10);
    expect(initializeNumberFourNotes(reset, 3, ['opponent'])[3].opponent).toEqual({
      white: 22,
      black: 20,
    });
  });
  it('건너뛴 라운드와 새 관전 대상도 초기화하고 한 색 편집 시 다른 색은 이어받는다', () => {
    let notes = updateNumberFourNote({}, 1, 'opponent', 'black', 12);
    notes = updateNumberFourNote(notes, 2, 'opponent', 'white', 16);
    expect(notes[2].opponent).toEqual({ white: 16, black: 12 });
    const restored = initializeNumberFourNotes(notes, 4, ['opponent', 'new-player']);
    expect(restored[4].opponent).toEqual({ white: 16, black: 12 });
    expect(restored[4]['new-player']).toEqual({ white: 22, black: 20 });
    expect(initializeNumberFourNotes(restored, 7, ['opponent'])).toBe(restored);
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
