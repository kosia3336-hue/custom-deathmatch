import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initBettingRps,
  handleBettingRpsAction,
  getBettingRpsState,
  cleanupBettingRps,
  performBettingRpsUndo,
  emitBettingRpsStateToSocket,
} from '../socket/games/betting-rps/index';
import { buildBettingRpsView } from '../../../components/game/modules/betting-rps/viewModel';
import { brpsMatchWinBonus } from '../../../shared/types/betting-rps';
import { validBettingRpsBet } from '../../../shared/bettingRpsSubmission';
import { aiSubmit, aiSelectRole } from '../socket/games/betting-rps/ai';
import { AI_PLAYER_ID } from '../../../shared/types/room';
const room = 'brps-refactor-test';
const io = { in: () => ({ fetchSockets: async () => [] }) } as any;
const socket = (id: string) => ({ id, emit: vi.fn() }) as any;
function init(limit: number | null = null, end = vi.fn()) {
  initBettingRps(
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
const state = () => getBettingRpsState(room)!;
function action(id: string, data: Record<string, unknown>) {
  const s = socket(id);
  handleBettingRpsAction(io, s, room, data);
  return s;
}
const select = () => action('a', { type: 'selectRole', role: 'match' });
const match = (result = 'win') => action('a', { type: 'submitMatch', result });
const bet = (prediction = 'win', chips = 1) =>
  action('b', { type: 'submitBet', prediction, chips });
function read(id: string) {
  const s = socket(id);
  emitBettingRpsStateToSocket(s, room);
  return s.emit.mock.calls.find((c: any[]) => c[0] === 'game:state')[1];
}
afterEach(() => {
  cleanupBettingRps(room);
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('베팅 가위바위보 입력·정산·정보 범위', () => {
  it('선택권·역할 권한을 검증하고 본인 입력만 공개한다', () => {
    init();
    expect(action('b', { type: 'selectRole', role: 'match' }).emit).toHaveBeenCalledWith(
      'error',
      expect.anything(),
    );
    select();
    match();
    expect(read('a').gameData.players.a.matchResult).toBe('win');
    expect(read('b').gameData.players.a.matchResult).toBeNull();
    expect(read('guest').gameData.players.a.role).toBeNull();
    expect(read('guest').gameData.players.a.submitted).toBe(false);
    expect(buildBettingRpsView(read('guest').gameData, 'guest', true).canSubmit).toBe(false);
    expect(buildBettingRpsView(read('b').gameData, 'b', false).phaseLabel).toContain('(공동 차례)');
    expect(action('b', { type: 'submitMatch', result: 'win' }).emit).toHaveBeenCalledWith(
      'error',
      expect.anything(),
    );
    expect(match().emit).toHaveBeenCalledWith('error', expect.anything());
  });
  it('잘못된 결과와 음수·소수·0·보유량 초과·비숫자 베팅을 거부한다', () => {
    init();
    select();
    expect(match('invalid').emit).toHaveBeenCalledWith('error', expect.anything());
    for (const chips of [-1, 0, 0.5, 3, NaN, Infinity, '1', undefined]) {
      expect(
        action('b', { type: 'submitBet', prediction: 'win', chips }).emit,
      ).toHaveBeenCalledWith('error', expect.anything());
    }
    expect(bet('invalid').emit).toHaveBeenCalledWith('error', expect.anything());
    expect(state().player2.submitted).toBe(false);
    expect(validBettingRpsBet(0, 'win', 0)).toBe(true);
    expect(validBettingRpsBet(0, 'win', 1)).toBe(false);
  });
  it.each([
    ['win', 'win', 3, 3, 'success'],
    ['draw', 'draw', 2, 4, 'success'],
    ['draw', 'lose', 2, 2, 'refund'],
    ['lose', 'win', 2, 1, 'fail'],
  ])('결과 %s / 예측 %s 정산', (result, prediction, matchChips, betChips, outcome) => {
    vi.useFakeTimers();
    init();
    select();
    match(result as string);
    bet(prediction as string);
    expect(state().phase).toBe('reveal');
    expect(state().player1.chips).toBe(matchChips);
    expect(state().player2.chips).toBe(betChips);
    expect(read('guest').gameData.revealData.players.b.betOutcome).toBe(outcome);
    expect(state().actionLog).toHaveLength(1);
    bet();
    expect(state().actionLog).toHaveLength(1);
  });
  it.each([
    [1, 1],
    [4, 2],
    [7, 3],
    [10, 4],
  ])('R%s 승리 배지와 서버 보상은 +%s', (round, bonus) => {
    vi.useFakeTimers();
    init();
    state().round = round;
    state().player1.hasChoiceRight = round % 2 === 1;
    state().player2.hasChoiceRight = round % 2 === 0;
    const chooser = round % 2 === 1 ? 'a' : 'b';
    action(chooser, { type: 'selectRole', role: chooser === 'a' ? 'match' : 'bet' });
    match();
    bet();
    expect(brpsMatchWinBonus(round)).toBe(bonus);
    expect(state().player1.chips).toBe(2 + bonus);
  });
});
describe('베팅 가위바위보 타이머·복원', () => {
  it('역할 선택과 제출은 같은 제한시간을 사용하고 한 명만 제출하면 시간 초과 승리한다', () => {
    vi.useFakeTimers();
    const end = init(10);
    const clock = state().turnStartedAt;
    vi.advanceTimersByTime(3000);
    select();
    match();
    expect(state().turnStartedAt).toBe(clock);
    vi.advanceTimersByTime(6999);
    expect(state().phase).toBe('submit');
    vi.advanceTimersByTime(1);
    expect(state()).toMatchObject({ phase: 'finished', winner: 'a', winType: 'timeout' });
    expect(read('a').gameData.revealData).toBeNull();
    vi.advanceTimersByTime(1999);
    expect(end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(end).toHaveBeenCalledOnce();
  });
  it('공개는 정확히 5초, 마지막 결과는 추가 2초이며 재접속 종료 시각은 동일하다', () => {
    vi.useFakeTimers();
    const end = init();
    state().round = 10;
    action('b', { type: 'selectRole', role: 'bet' });
    match();
    bet();
    const deadline = state().revealEndsAt;
    vi.advanceTimersByTime(1000);
    expect(read('guest').gameData.revealEndsAt).toBe(deadline);
    vi.advanceTimersByTime(3999);
    expect(state().phase).toBe('reveal');
    vi.advanceTimersByTime(1);
    expect(state().phase).toBe('finished');
    expect(read('a').turnStartedAt).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(end).toHaveBeenCalledOnce();
  });
  it('다음 라운드 선택권을 교대하고 제출값을 초기화한다', () => {
    vi.useFakeTimers();
    init();
    select();
    match();
    bet();
    vi.advanceTimersByTime(5000);
    expect(state()).toMatchObject({ round: 2, phase: 'roleSelect', revealEndsAt: null });
    expect(state().player2.hasChoiceRight).toBe(true);
    expect(state().player1.matchResult).toBeNull();
  });
  it('아무도 입력하지 않은 시간 초과는 자동 정산된다', () => {
    vi.useFakeTimers();
    init(10);
    vi.advanceTimersByTime(10000);
    expect(state().phase).toBe('reveal');
    expect(state().actionLog).toHaveLength(1);
  });
  it('무르기 불가 요청은 타이머를 유지하고 공개 중 무르기는 정산·예약 전환을 되돌린다', () => {
    vi.useFakeTimers();
    init(10);
    const timer = state().roundTimer;
    expect(performBettingRpsUndo(io, room)).toBe(false);
    expect(state().roundTimer).toBe(timer);
    select();
    match();
    bet();
    expect(performBettingRpsUndo(io, room)).toBe(true);
    expect(state().player1.chips).toBe(2);
    expect(state().actionLog).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(state().phase).toBe('roleSelect');
    expect(state().round).toBe(1);
  });
  it('이전 라운드로 무르면 기록과 선택권을 복구한다', () => {
    vi.useFakeTimers();
    init();
    select();
    match();
    bet();
    vi.advanceTimersByTime(5000);
    expect(performBettingRpsUndo(io, room)).toBe(true);
    expect(state().round).toBe(1);
    expect(state().player1.hasChoiceRight).toBe(true);
    expect(state().actionLog).toHaveLength(0);
  });
  it('정리와 같은 방 새 경기 후 이전 결과 콜백이 실행되지 않는다', () => {
    vi.useFakeTimers();
    const oldEnd = init();
    state().round = 10;
    action('b', { type: 'selectRole', role: 'bet' });
    match();
    bet();
    vi.advanceTimersByTime(5000);
    const newEnd = init();
    vi.advanceTimersByTime(2000);
    expect(oldEnd).not.toHaveBeenCalled();
    expect(newEnd).not.toHaveBeenCalled();
    expect(state().round).toBe(1);
    select();
    match();
    bet();
    cleanupBettingRps(room);
    vi.advanceTimersByTime(5000);
    expect(getBettingRpsState(room)).toBeUndefined();
    expect(newEnd).not.toHaveBeenCalled();
  });
});

describe('COM 예약 작업 수명', () => {
  function com() {
    initBettingRps(
      io,
      room,
      [
        { id: 'a', nickname: '나' },
        { id: AI_PLAYER_ID, nickname: 'COM' },
      ] as any,
      'com',
      Date.now(),
      null,
      vi.fn(),
    );
  }
  it('동시에 예약된 AI 제출은 한 번만 정산한다', async () => {
    vi.useFakeTimers();
    com();
    select();
    const pending = aiSubmit(io, state());
    match();
    await vi.advanceTimersByTimeAsync(1600);
    await pending;
    expect(state().phase).toBe('reveal');
    expect(state().actionLog).toHaveLength(1);
  });
  it('같은 방 새 경기 후 이전 AI 제출은 새 상태와 오래된 상태 모두 변경하지 않는다', async () => {
    vi.useFakeTimers();
    com();
    select();
    const old = state();
    const pending = aiSubmit(io, old);
    com();
    await vi.advanceTimersByTimeAsync(1600);
    await pending;
    expect(old.player2.submitted).toBe(false);
    expect(state().phase).toBe('roleSelect');
    expect(state().actionLog).toHaveLength(0);
  });
  it('같은 방 새 경기 후 이전 AI 역할 선택은 실행되지 않는다', async () => {
    vi.useFakeTimers();
    com();
    const old = state();
    old.round = 2;
    const pending = aiSelectRole(io, old);
    com();
    await vi.advanceTimersByTimeAsync(900);
    await pending;
    expect(old.phase).toBe('roleSelect');
    expect(old.player2.role).toBeNull();
    expect(state().player2.role).toBeNull();
  });
});
