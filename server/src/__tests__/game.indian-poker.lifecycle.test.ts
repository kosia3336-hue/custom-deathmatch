import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initIndianPoker,
  handleIndianPokerAction,
  getIndianPokerState,
  cleanupIndianPoker,
  performIndianPokerUndo,
  emitIndianPokerStateToSocket,
} from '../socket/games/indian-poker/index';
import { AI_PLAYER_ID } from '../../../shared/types/room';
import { indianPokerBettingLimits } from '../../../shared/indianPokerBetting';
import { buildIndianPokerViewModel } from '../../../components/game/modules/indian-poker/viewModel';
const room = 'ip-refactor-test';
const io = { in: () => ({ fetchSockets: async () => [] }) } as any;
const socket = (id: string) => ({ id, emit: vi.fn() }) as any;
function init(limit: number | null = null, end = vi.fn()) {
  initIndianPoker(
    io,
    room,
    [
      { id: 'a', nickname: '나' },
      { id: 'b', nickname: '상대' },
    ] as any,
    'multi',
    Date.now(),
    limit,
    end,
  );
  return end;
}
function action(id: string, value: Record<string, unknown>) {
  const viewer = socket(id);
  handleIndianPokerAction(io, viewer, room, value);
  return viewer;
}
function read(id: string) {
  const viewer = socket(id);
  emitIndianPokerStateToSocket(viewer, room);
  return viewer.emit.mock.calls.find((call: any[]) => call[0] === 'game:state')[1];
}
function cards(a: number, b: number, shared: [number, number] = [3, 7]) {
  const s = getIndianPokerState(room)!;
  s.players.a.card = a;
  s.players.b.card = b;
  s.communityCards = shared;
  return s;
}
function sum() {
  const s = getIndianPokerState(room)!;
  return s.players.a.chips + s.players.b.chips;
}
afterEach(() => {
  cleanupIndianPoker(room);
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('인디언홀덤Q 베팅·공개 계약', () => {
  it('자신/관전자 카드 숨김과 조작 권한을 서버·화면에서 유지한다', () => {
    init();
    cards(5, 7);
    const player = read('a').gameData;
    const guest = read('guest').gameData;
    expect(player.players.a.card).toBeNull();
    expect(player.players.b.card).toBe(7);
    expect(guest.players.a.card).toBeNull();
    expect(guest.players.b.card).toBeNull();
    expect(buildIndianPokerViewModel(player, 'a', false).canAct).toBe(true);
    expect(buildIndianPokerViewModel(guest, 'guest', true).canAct).toBe(false);
    expect(buildIndianPokerViewModel(guest, 'guest', false).canAct).toBe(false);
    action('guest', { type: 'die' });
    expect(getIndianPokerState(room)!.phase).toBe('betting');
  });
  it('선 체크 후 0칩 콜로 쇼다운한다', () => {
    vi.useFakeTimers();
    init();
    cards(5, 7);
    action('a', { type: 'check' });
    const model = buildIndianPokerViewModel(read('b').gameData, 'b', false);
    expect(model.canCheck).toBe(false);
    expect(model.limits).toMatchObject({ canCall: true, callCost: 0 });
    action('b', { type: 'call' });
    expect(getIndianPokerState(room)!.phase).toBe('showdown');
    expect(sum()).toBe(50);
    expect(read('a').gameData.players.a.card).toBe(5);
  });
  it('총 베팅량·상대 상한을 적용하고 비정수/초과 입력을 거부한다', () => {
    init();
    const s = cards(5, 7);
    s.players.b.chips = 5;
    expect(indianPokerBettingLimits(s.players.a, s.players.b)).toMatchObject({
      minRaise: 1,
      maxRaise: 5,
    });
    action('a', { type: 'raise', amount: 1.5 });
    action('a', { type: 'raise', amount: 6 });
    expect(s.totalBettingActions).toBe(0);
    action('a', { type: 'raise', amount: 5 });
    expect(s.players.a).toMatchObject({ chips: 19, roundBet: 5 });
    expect(buildIndianPokerViewModel(read('b').gameData, 'b', false).limits).toMatchObject({
      canCall: true,
      canRaise: false,
    });
  });
  it('다이 패널티는 보유 칩으로 제한하고 칩 총량을 보존한다', () => {
    vi.useFakeTimers();
    init();
    const s = cards(7, 2);
    s.players.a.chips = 2;
    const total = sum() + s.pot;
    action('a', { type: 'die' });
    expect(s.dieData?.penalty).toBe(2);
    expect(sum()).toBe(total);
    expect(s.dieData?.chipChanges).toMatchObject({ a: -3, b: 3 });
  });
  it('무승부는 팟을 나누고 선 플레이어를 유지한다', async () => {
    vi.useFakeTimers();
    init();
    const s = cards(4, 4);
    action('a', { type: 'check' });
    action('b', { type: 'call' });
    expect(s.showdownData?.isDraw).toBe(true);
    expect(sum()).toBe(50);
    await vi.advanceTimersByTimeAsync(5000);
    expect(s).toMatchObject({ round: 2, firstBettorId: 'a', phase: 'betting' });
  });
  it('기록의 칩 증감은 잔액이 아니라 실제 정산 증감이다', () => {
    vi.useFakeTimers();
    init();
    const s = cards(5, 7);
    action('a', { type: 'check' });
    action('b', { type: 'call' });
    expect(s.roundHistory[0].chipChanges).toEqual({ a: -1, b: 1 });
    expect(read('a').gameData.roundHistory[0].chipChanges).toEqual({ a: -1, b: 1 });
  });
  it('숏스택은 양쪽에 같은 실효 앤티를 차감한다', async () => {
    vi.useFakeTimers();
    init();
    const s = cards(5, 7);
    s.ante = 5;
    s.players.a.chips = 1;
    action('a', { type: 'die' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.roundAnte).toBe(1);
    expect(s.pot).toBe(2);
    expect(s.players.a.chips).toBe(0);
  });
  it('덱 부족 시 리셋·앤티 증가를 적용한다', async () => {
    vi.useFakeTimers();
    init();
    const s = cards(5, 7);
    s.deck = [1, 2, 3];
    action('a', { type: 'die' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.deckCycle).toBe(2);
    expect(s.ante).toBe(2);
    expect(s.roundAnte).toBe(2);
    expect(s.deck.length).toBe(36);
  });
});
describe('인디언홀덤Q 예약·복원 수명', () => {
  it('결과 공개가 정확히 5초다', async () => {
    vi.useFakeTimers();
    init();
    cards(5, 7);
    action('a', { type: 'die' });
    await vi.advanceTimersByTimeAsync(4999);
    expect(getIndianPokerState(room)!.round).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(getIndianPokerState(room)!.round).toBe(2);
  });
  it('결과 중 무르기는 예약 진행을 취소하고 라운드 시작을 복원한다', async () => {
    vi.useFakeTimers();
    init(30);
    const before = read('a');
    action('a', { type: 'die' });
    expect(performIndianPokerUndo(io, room)).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(read('a').gameData).toMatchObject({
      round: 1,
      phase: 'betting',
      roundHistory: [],
      pot: before.gameData.pot,
    });
  });
  it('무르기 불가 요청은 진행 중인 제한 시간을 지우지 않는다', async () => {
    vi.useFakeTimers();
    const end = init(3);
    expect(performIndianPokerUndo(io, room)).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('방 정리 시 결과 진행/종료 타이머도 취소한다', async () => {
    vi.useFakeTimers();
    const end = init();
    action('a', { type: 'die' });
    cleanupIndianPoker(room);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(6000);
    expect(end).not.toHaveBeenCalled();
    init(1, end);
    await vi.advanceTimersByTimeAsync(1000);
    cleanupIndianPoker(room);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('같은 방의 새 경기를 이전 결과 진행/종료 콜백이 건드리지 않는다', async () => {
    vi.useFakeTimers();
    const oldEnd = init(1);
    await vi.advanceTimersByTimeAsync(1000);
    init();
    const current = getIndianPokerState(room);
    await vi.advanceTimersByTimeAsync(6000);
    expect(getIndianPokerState(room)).toBe(current);
    expect(current?.round).toBe(1);
    expect(oldEnd).not.toHaveBeenCalled();
    action('a', { type: 'die' });
    init();
    const second = getIndianPokerState(room);
    await vi.advanceTimersByTimeAsync(6000);
    expect(getIndianPokerState(room)).toBe(second);
    expect(second?.round).toBe(1);
  });
  it('이전 COM 경기의 지연 행동이 새 경기로 넘어오지 않는다', async () => {
    vi.useFakeTimers();
    initIndianPoker(
      io,
      room,
      [
        { id: 'a', nickname: '나' },
        { id: AI_PLAYER_ID, nickname: 'AI' },
      ] as any,
      'com',
      Date.now(),
      null,
      vi.fn(),
    );
    const old = getIndianPokerState(room)!;
    action('a', { type: 'check' });
    init();
    const current = getIndianPokerState(room);
    await vi.advanceTimersByTimeAsync(2000);
    expect(old.totalBettingActions).toBe(1);
    expect(getIndianPokerState(room)).toBe(current);
  });
  it('이전 라운드로 무를 때 표준 앤티와 실효 앤티를 같이 복원한다', async () => {
    vi.useFakeTimers();
    init();
    const s = cards(5, 7);
    s.deck = [1, 2, 3];
    action('a', { type: 'die' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.roundAnte).toBe(2);
    expect(performIndianPokerUndo(io, room)).toBe(true);
    expect(s).toMatchObject({ round: 1, ante: 1, roundAnte: 1 });
  });
  it('재접속 전송은 착수 시작 시각을 바꾸지 않는다', () => {
    vi.useFakeTimers();
    init(30);
    const started = getIndianPokerState(room)!.turnStartedAt;
    vi.advanceTimersByTime(1000);
    read('a');
    expect(getIndianPokerState(room)!.turnStartedAt).toBe(started);
  });
  it('시간 초과 후 종료 이벤트는 2초 뒤 한 번 실행한다', async () => {
    vi.useFakeTimers();
    const end = init(3);
    await vi.advanceTimersByTimeAsync(3000);
    expect(getIndianPokerState(room)).toMatchObject({
      phase: 'finished',
      winner: 'b',
      winType: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(end).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
