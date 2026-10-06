import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initInvestDonate,
  handleInvestDonateAction,
  getInvestDonateState,
  cleanupInvestDonate,
  performInvestDonateUndo,
  emitInvestDonateStateToSocket,
} from '../socket/games/invest-donate/index';
import { AI_PLAYER_ID } from '../../../shared/types/room';
import { allocationError, parseCoinAllocation } from '../../../shared/investDonateAllocation';
import { buildInvestDonateView } from '../../../components/game/modules/invest-donate/viewModel';

const room = 'invest-refactor-test';
const io = { in: () => ({ fetchSockets: async () => [] }) } as any;
const socket = (id: string) => ({ id, emit: vi.fn() }) as any;
const zero = () => ({ coin50: 0, coin10: 0, coin1: 0 });
function init(limit: number | null = null, end = vi.fn(), com = false) {
  initInvestDonate(
    io,
    room,
    [
      { id: 'a', nickname: '나' },
      { id: com ? AI_PLAYER_ID : 'b', nickname: '상대' },
    ] as any,
    com ? 'com' : 'multi',
    Date.now(),
    limit,
    end,
  );
  return end;
}
function action(id: string, value: Record<string, unknown>) {
  const viewer = socket(id);
  handleInvestDonateAction(io, viewer, room, value);
  return viewer;
}
function submit(id: string, invest = zero(), donate = zero()) {
  return action(id, { type: 'submit', invest, donate });
}
function read(id: string) {
  const viewer = socket(id);
  emitInvestDonateStateToSocket(viewer, room);
  return viewer.emit.mock.calls.find((call: any[]) => call[0] === 'game:state')[1];
}
const state = () => getInvestDonateState(room)!;
afterEach(() => {
  cleanupInvestDonate(room);
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('투자와 기부 제출·공개·정산', () => {
  it('본인 제출만 공개하고 상대와 관전자 배분은 숨긴다', () => {
    init();
    submit('a', { ...zero(), coin10: 2 });
    expect(read('a').gameData.players.a.investCoins.coin10).toBe(2);
    expect(read('b').gameData.players.a.investCoins).toBeNull();
    expect(read('guest').gameData.players.a.investCoins).toBeNull();
    action('guest', { type: 'submit', invest: zero(), donate: zero() });
    expect(state().player2.submitted).toBe(false);
    expect(buildInvestDonateView(read('guest').gameData, 'guest', true).canAct).toBe(false);
    expect(buildInvestDonateView(read('guest').gameData, 'guest', false).canAct).toBe(false);
  });
  it('본인이 두 번째 자리여도 본인 표시와 취소 가능 여부를 계산한다', () => {
    init();
    submit('b');
    const model = buildInvestDonateView(read('b').gameData, 'b', false);
    expect(model.orderedIds).toEqual(['b', 'a']);
    expect(model.canCancel).toBe(true);
    expect(model.phaseLabel).toContain('상대 대기');
  });
  it('음수·소수·NaN·Infinity·누락과 보유량 초과를 거부한다', () => {
    init();
    for (const amount of [-1, 0.5, NaN, Infinity, 3]) {
      const viewer = submit('a', { ...zero(), coin50: amount });
      expect(viewer.emit).toHaveBeenCalledWith('error', expect.anything());
    }
    expect(parseCoinAllocation({ coin50: 0 })).toBeNull();
    expect(
      allocationError(
        state().player1.coinStock,
        { ...zero(), coin50: 2 },
        { ...zero(), coin50: 1 },
      ),
    ).toContain('50원');
    submit('a', { ...zero(), coin50: 2 }, { ...zero(), coin50: 1 });
    expect(state().player1.submitted).toBe(false);
  });
  it('상대 제출 전 취소할 수 있고 중복 제출은 거부한다', () => {
    init();
    submit('a');
    expect(submit('a').emit).toHaveBeenCalledWith('error', expect.anything());
    action('a', { type: 'cancelSubmit' });
    expect(state().player1).toMatchObject({
      submitted: false,
      investCoins: null,
      donateCoins: null,
    });
    submit('a');
    submit('b');
    expect(action('a', { type: 'cancelSubmit' }).emit).toHaveBeenCalledWith(
      'error',
      expect.anything(),
    );
  });
  it('동시 정산 시 코인 차감·승점·기록을 한 번만 반영한다', () => {
    vi.useFakeTimers();
    init();
    submit('a', { ...zero(), coin10: 2 }, { ...zero(), coin1: 2 });
    submit('b', { ...zero(), coin10: 1 }, { ...zero(), coin1: 1 });
    const s = state();
    expect(s.player1).toMatchObject({ score: 5, coinStock: { coin50: 2, coin10: 4, coin1: 8 } });
    expect(s.player2.score).toBe(3);
    expect(s.roundHistory[0].players.a.scoreChange).toBe(1);
    expect(s.actionLog[0].players.b).toMatchObject({ scoreBefore: 4, scoreAfter: 3 });
    submit('b');
    expect(s.roundHistory).toHaveLength(1);
    expect(read('guest').gameData.revealData.players.a.investTotal).toBe(20);
  });
  it('투자 동점은 대주주 없음, 기부 동점은 양쪽 수전노다', () => {
    vi.useFakeTimers();
    init();
    submit('a');
    submit('b');
    expect(read('a').gameData.revealData).toMatchObject({ investTied: true, donateTied: true });
    expect(state().player1.score).toBe(3);
    expect(state().player2.score).toBe(3);
  });
  it('양쪽 시간 초과는 0 배분 정산, 한쪽만 미제출이면 제출자 승리다', async () => {
    vi.useFakeTimers();
    init(3);
    await vi.advanceTimersByTimeAsync(3000);
    expect(state()).toMatchObject({ phase: 'reveal', roundHistory: [expect.anything()] });
    cleanupInvestDonate(room);
    const end = init(3);
    submit('b');
    await vi.advanceTimersByTimeAsync(3000);
    expect(state()).toMatchObject({ phase: 'finished', winner: 'b', winType: 'timeout' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
describe('투자와 기부 결과 시간·무르기·경기 수명', () => {
  it('절대 공개 마감 시각을 전송하고 정확히 4초 뒤 다음 라운드로 간다', async () => {
    vi.useFakeTimers();
    init();
    submit('a');
    submit('b');
    const deadline = read('a').gameData.revealEndsAt;
    expect(deadline).toBe(Date.now() + 4000);
    expect(read('a').turnStartedAt).toBeNull();
    await vi.advanceTimersByTimeAsync(2500);
    expect(read('b').gameData.revealEndsAt).toBe(deadline);
    await vi.advanceTimersByTimeAsync(1499);
    expect(state().round).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(state()).toMatchObject({ round: 2, phase: 'submit', revealEndsAt: null });
  });
  it('새 라운드 시간 초과에 지난 라운드 결과를 새 결과처럼 보내지 않는다', async () => {
    vi.useFakeTimers();
    init(3);
    submit('a');
    submit('b');
    await vi.advanceTimersByTimeAsync(4000);
    submit('a');
    await vi.advanceTimersByTimeAsync(3000);
    expect(state().phase).toBe('finished');
    expect(read('a').gameData.revealData).toBeNull();
  });
  it('불가능한 무르기는 제한 시간을 취소하지 않는다', async () => {
    vi.useFakeTimers();
    init(3);
    expect(performInvestDonateUndo(io, room)).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(state().phase).toBe('reveal');
  });
  it('공개 중 무르기는 점수·코인·기록을 복원하고 전환을 취소한다', async () => {
    vi.useFakeTimers();
    init(30);
    submit('a');
    submit('b');
    expect(performInvestDonateUndo(io, room)).toBe(true);
    expect(state()).toMatchObject({
      round: 1,
      phase: 'submit',
      revealEndsAt: null,
      roundHistory: [],
    });
    expect(state().player1.score).toBe(4);
    await vi.advanceTimersByTimeAsync(4000);
    expect(state().round).toBe(1);
  });
  it('새 라운드 직후에는 이전 라운드 시작으로 돌아간다', async () => {
    vi.useFakeTimers();
    init();
    submit('a');
    submit('b');
    await vi.advanceTimersByTimeAsync(4000);
    expect(state().round).toBe(2);
    expect(performInvestDonateUndo(io, room)).toBe(true);
    expect(state()).toMatchObject({ round: 1, phase: 'submit', roundHistory: [] });
  });
  it('정리하면 공개 전환과 최종 종료 타이머가 제거된다', async () => {
    vi.useFakeTimers();
    const end = init();
    submit('a');
    submit('b');
    cleanupInvestDonate(room);
    expect(vi.getTimerCount()).toBe(0);
    init(1, end);
    submit('a');
    await vi.advanceTimersByTimeAsync(1000);
    cleanupInvestDonate(room);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10000);
    expect(end).not.toHaveBeenCalled();
  });
  it('같은 방 새 경기에서 이전 공개/최종 종료 콜백이 실행되지 않는다', async () => {
    vi.useFakeTimers();
    const oldEnd = init();
    submit('a');
    submit('b');
    init();
    const fresh = state();
    await vi.advanceTimersByTimeAsync(4000);
    expect(state()).toBe(fresh);
    expect(fresh.round).toBe(1);
    init(1, oldEnd);
    submit('a');
    await vi.advanceTimersByTimeAsync(1000);
    init();
    const again = state();
    await vi.advanceTimersByTimeAsync(2000);
    expect(state()).toBe(again);
    expect(oldEnd).not.toHaveBeenCalled();
  });
  it('COM 지연 제출은 취소/교체한 경기에서 적용되지 않는다', async () => {
    vi.useFakeTimers();
    init(null, vi.fn(), true);
    submit('a');
    const old = state();
    action('a', { type: 'cancelSubmit' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(old.player2.submitted).toBe(false);
    submit('a');
    init();
    await vi.advanceTimersByTimeAsync(1600);
    expect(old.player2.submitted).toBe(false);
    expect(state().roundHistory).toEqual([]);
  });
  it.each(['score', 'tiebreaker', 'draw', 'elimination'] as const)(
    '최종 %s 판정은 4초 공개 후 2초 뒤 한 번 종료한다',
    async (kind) => {
      vi.useFakeTimers();
      const end = init();
      const s = state();
      s.round = 7;
      if (kind === 'score') s.player1.score = 5;
      if (kind === 'tiebreaker') s.player2.coinStock.coin1 = 9;
      if (kind === 'elimination') s.player2.score = 1;
      submit('a');
      submit('b');
      await vi.advanceTimersByTimeAsync(4000);
      expect(s.winType).toBe(kind);
      expect(s.phase).toBe('finished');
      expect(read('a').gameData.finishedEndsAt).toBe(Date.now() + 2000);
      await vi.advanceTimersByTimeAsync(1999);
      expect(end).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(end).toHaveBeenCalledTimes(1);
      expect(end.mock.calls[0][2].gameResultData.actions).toHaveLength(1);
    },
  );
});
