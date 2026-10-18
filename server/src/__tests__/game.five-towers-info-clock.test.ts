/**
 * 5개의 탑 — 정보 아이템을 써도 상대가 눈치채지 못하는지.
 *
 * 실제로 났던 버그: 정보는 턴을 소모하지 않는데 턴 시계를 다시 걸고 모두에게 방송해,
 * 상대 화면의 남은 시간이 처음(3분)으로 돌아가 '정보를 썼다' 가 드러났다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { cleanupFiveTowers, handleFiveTowersAction, initFiveTowers } from '../socket/games/five-towers/index.js';
import { gameStates } from '../socket/games/five-towers/state.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { sessions } from '../store/sessions.js';

const ROOM = 'ft-info-clock';
const ids = ['ft-a', 'ft-b', 'ft-spec'];

afterEach(() => {
  cleanupFiveTowers(ROOM);
  for (const id of ids) sessions.removeSession(`sock-${id}`);
  vi.useRealTimers();
});

describe('5개의 탑 정보 아이템', () => {
  it('시계를 다시 걸지 않고, 갱신은 쓴 사람에게만 간다', async () => {
    vi.useFakeTimers();
    const sockets = ids.map((id) => {
      sessions.linkToken(`sock-${id}`, id);
      return { id: `sock-${id}`, emit: vi.fn() };
    });
    const io = {
      in: () => ({ fetchSockets: async () => sockets }),
      to: () => ({ emit: vi.fn() }),
    } as unknown as IO;
    const players = ['ft-a', 'ft-b'].map(
      (id, i) => ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: Date.now() }) as Player,
    );
    initFiveTowers(io, ROOM, players, 'multi', Date.now(), 180, vi.fn());
    const s = gameStates.get(ROOM)!;
    const actor = s.currentPlayerId;
    const startedAt = s.turnStartedAt;

    await vi.advanceTimersByTimeAsync(60_000); // 시작 방송까지 흘려보낸다
    for (const sock of sockets) sock.emit.mockClear();
    const actorSocket = sockets.find((x) => x.id === `sock-${actor}`)!;
    handleFiveTowersAction(io, actorSocket as unknown as TypedSocket, ROOM, {
      type: 'item',
      item: 'info',
      targets: ['A', 'B'],
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(s.currentPlayerId).toBe(actor);
    expect(s.turnStartedAt).toBe(startedAt);
    for (const sock of sockets) {
      const states = sock.emit.mock.calls.filter(([e]) => e === 'game:state');
      expect(states.length).toBe(sock === actorSocket ? 1 : 0);
    }
    expect((actorSocket.emit.mock.calls.find(([e]) => e === 'game:state')![1] as { turnStartedAt: number }).turnStartedAt).toBe(startedAt);

    // 원래 마감(3분)에 그대로 시간 초과가 난다 — 정보로 시간을 벌 수 없다
    const turnBefore = s.turn;
    await vi.advanceTimersByTimeAsync(120_000 + 50);
    expect(s.turn !== turnBefore || s.currentPlayerId !== actor || s.gameOver).toBe(true);
  });
});
