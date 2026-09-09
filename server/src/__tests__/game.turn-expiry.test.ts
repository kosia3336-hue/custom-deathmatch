import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@shared/types/room.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { roomStore } from '../store/rooms.js';
import {
  clearTurnExpiry,
  configureTurnExpiryRuntime,
  emitTurnExpiry,
  isTurnExpiryBlocked,
  respondTurnExpiry,
  scheduleTurnExpiry,
} from '../socket/gameTurnExpiry.js';

const emit = vi.fn();
const io = { to: () => ({ emit }) } as unknown as IO;
const finish = vi.fn();
const sync = vi.fn();
const fallback = vi.fn();
let room: Room;
let state: {
  roomId: string;
  gameOver: boolean;
  turnStartedAt: number;
  roundDeadline: number;
  timer: ReturnType<typeof setTimeout> | null;
  actor: string | null;
};

function arm() {
  state.timer = scheduleTurnExpiry(io, state, 'timer', () => state.actor, fallback, 10000);
}
function proposal() {
  return emit.mock.calls.filter(([name, data]) => name === 'game:time-expiry' && data).at(-1)?.[1];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  vi.clearAllMocks();
  room = {
    id: 'expiry-test',
    status: 'playing',
    playMode: 'multi',
    isRanked: false,
    players: [{ id: 'a' }, { id: 'b' }],
  } as Room;
  vi.spyOn(roomStore, 'get').mockImplementation((id) =>
    id === room.id ? (room as ReturnType<typeof roomStore.get>) : undefined,
  );
  configureTurnExpiryRuntime({ finish, sync });
  state = {
    roomId: room.id,
    gameOver: false,
    turnStartedAt: Date.now(),
    roundDeadline: Date.now() + 10000,
    timer: null,
    actor: 'a',
  };
});
afterEach(() => {
  clearTurnExpiry(io, room.id);
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('개인 착수 시간 초과 정책', () => {
  it('랭크는 첫 시간 초과에 즉시 몰수패, 자동 행동 없음', () => {
    room.isRanked = true;
    arm();
    vi.advanceTimersByTime(10000);
    expect(finish).toHaveBeenCalledExactlyOnceWith(io, room.id, 'a');
    expect(proposal()).toBeUndefined();
    expect(fallback).not.toHaveBeenCalled();
  });
  it('일반 대전은 상대에게만 결정권을 주고 착수를 막는다', () => {
    arm();
    vi.advanceTimersByTime(10000);
    const p = proposal();
    expect(p).toMatchObject({ loserId: 'a', deciderId: 'b', mode: 'multi' });
    expect(isTurnExpiryBlocked(room.id)).toBe(true);
    for (const id of ['a', 'spectator']) respondTurnExpiry(io, room.id, id, p.requestId, 'finish');
    respondTurnExpiry(io, room.id, 'b', 'old-request', 'finish');
    expect(finish).not.toHaveBeenCalled();
    respondTurnExpiry(io, room.id, 'b', p.requestId, 'finish');
    respondTurnExpiry(io, room.id, 'b', p.requestId, 'finish');
    expect(finish).toHaveBeenCalledExactlyOnceWith(io, room.id, 'a');
  });
  it('봐주기는 판/차례를 유지하며 전체 시간을 다시 부여한다', () => {
    arm();
    vi.advanceTimersByTime(10000);
    const p = proposal();
    vi.advanceTimersByTime(27000);
    expect(fallback).not.toHaveBeenCalled();
    respondTurnExpiry(io, room.id, 'b', p.requestId, 'continue');
    expect(state.actor).toBe('a');
    expect(state.turnStartedAt).toBe(Date.now());
    expect(state.roundDeadline).toBe(Date.now() + 10000);
    expect(sync).toHaveBeenCalledExactlyOnceWith(io, room.id);
    expect(isTurnExpiryBlocked(room.id)).toBe(false);
    vi.advanceTimersByTime(9999);
    expect(isTurnExpiryBlocked(room.id)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(proposal().requestId).not.toBe(p.requestId);
  });
  it('COM에서는 시간 초과한 사람이 계속하기/패배 인정을 선택한다', () => {
    room.playMode = 'com';
    room.players[1].id = 'AI';
    arm();
    vi.advanceTimersByTime(10000);
    const p = proposal();
    expect(p).toMatchObject({ mode: 'com', deciderId: 'a' });
    respondTurnExpiry(io, room.id, 'a', p.requestId, 'finish');
    expect(finish).toHaveBeenCalledExactlyOnceWith(io, room.id, 'a');
  });
  it('공동 타이머의 기존 판정을 유지한다', () => {
    state.actor = null;
    arm();
    vi.advanceTimersByTime(10000);
    expect(fallback).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled();
    expect(proposal()).toBeUndefined();
  });
  it('비랭크 운영 더미 상대도 사람에게 계속하기 선택을 제공한다', () => {
    room.players[1].id = 'dev-dummy:opponent';
    arm();
    vi.advanceTimersByTime(10000);
    expect(proposal()).toMatchObject({ deciderId: 'a', mode: 'com' });
  });
  it('교체된 타이머와 이미 끝난 게임의 낡은 콜백은 무시한다', () => {
    arm();
    state.timer = null;
    vi.advanceTimersByTime(10000);
    expect(proposal()).toBeUndefined();
    arm();
    state.gameOver = true;
    vi.advanceTimersByTime(10000);
    expect(proposal()).toBeUndefined();
  });
  it('타이머 콜백보다 늦은 착수 이벤트가 먼저 와도 마감을 적용한다', () => {
    arm();
    vi.setSystemTime(Date.now() + 10001);
    expect(isTurnExpiryBlocked(room.id)).toBe(true);
    expect(proposal()).toBeDefined();
    vi.advanceTimersByTime(10000);
    expect(emit.mock.calls.filter(([, data]) => data).length).toBe(1);
  });
  it('재연결 시 같은 요청을 복원하고 종료 시 제거한다', () => {
    arm();
    vi.advanceTimersByTime(10000);
    const send = vi.fn();
    const socket = { emit: send } as unknown as TypedSocket;
    emitTurnExpiry(socket, room.id);
    expect(send).toHaveBeenLastCalledWith('game:time-expiry', proposal());
    clearTurnExpiry(io, room.id);
    emitTurnExpiry(socket, room.id);
    expect(send).toHaveBeenLastCalledWith('game:time-expiry', null);
  });
});
