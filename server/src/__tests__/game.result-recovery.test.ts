import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_IDS } from '../../../shared/types/game';
import { recoverGameResult } from '../../../lib/gameResultRecovery';
import { roomStore } from '../store/rooms';
import { sessions } from '../store/sessions';
import { endGame, registerGameHandlers, emitGameStateToSocket, clearAutoEnd } from '../socket/game';
import { ensureRoomShopState, cleanupRoomShopState } from '../shop/roomShopState';

vi.mock('../socket/gameEndPersistence.js', () => ({ persistGameEndLog: vi.fn(async () => null) }));
vi.mock('../socket/lobby.js', () => ({
  broadcastRoomUpdated: vi.fn(),
  broadcastRoomRemoved: vi.fn(),
}));

const created: string[] = [];
const emit = vi.fn();
const io = {
  to: () => ({ emit }),
  sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
} as any;

function setup(gameId: string = GAME_IDS.WINNING_STREAK) {
  vi.useFakeTimers();
  const room = roomStore.create({
    title: '종료 복구',
    gameId,
    gameName: gameId,
    playMode: 'com',
    roomType: 'public',
    maxPlayers: 2,
    minPlayers: 2,
    host: { id: 'human', nickname: '나', isHost: true, isReady: true, joinedAt: Date.now() },
  });
  created.push(room.id);
  roomStore.setStatus(room.id, 'playing');
  const handlers = new Map<string, () => void>();
  const socket = {
    id: 'recovery-socket',
    emit: vi.fn(),
    on: (event: string, fn: () => void) => handlers.set(event, fn),
  } as any;
  sessions.linkToken(socket.id, 'human');
  sessions.setRoom(socket.id, room.id);
  registerGameHandlers(io, socket);
  endGame(io, room.id, {
    rankings: [
      { playerId: 'human', nickname: '나', rank: 1, score: 6 },
      { playerId: 'AI', nickname: 'AI', rank: 2, score: 2 },
    ],
    totalTurns: 10,
  });
  return { room, socket, handlers };
}

afterEach(() => {
  created.forEach((id) => {
    clearAutoEnd(id);
    cleanupRoomShopState(id);
    roomStore.delete(id);
  });
  created.length = 0;
  sessions.removeSession('recovery-socket');
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('종료 알림 복구', () => {
  it.each([GAME_IDS.WINNING_STREAK, GAME_IDS.SILPER_BNW])(
    '%s 종료 후 game:sync로 저장된 결과를 재전송한다',
    (gameId) => {
      const { room, socket, handlers } = setup(gameId);
      expect(roomStore.get(room.id)?.status).toBe('finished');
      handlers.get('game:sync')!();
      expect(socket.emit).toHaveBeenCalledWith('game:ended', roomStore.getGameResult(room.id));
      expect(socket.emit).toHaveBeenCalledWith(
        'room:state',
        expect.not.objectContaining({ _gameResult: expect.anything() }),
      );
    },
  );
  it('재접속 전송도 익명 닉네임을 가리고 원본 결과는 변경하지 않는다', () => {
    const { room } = setup();
    ensureRoomShopState(room.id).anonymizedTokens.add('human');
    const spectator = { id: 'spectator', emit: vi.fn() } as any;
    emitGameStateToSocket(spectator, room.id, room.gameId);
    expect(spectator.emit.mock.calls[0][1].rankings[0].nickname).toBe('???');
    expect(roomStore.getGameResult(room.id)?.rankings[0].nickname).toBe('나');
    roomStore.resetForRematch(room.id);
    expect(roomStore.getGameResult(room.id)).toBeUndefined();
    emitGameStateToSocket(spectator, room.id, room.gameId);
    expect(
      spectator.emit.mock.calls.filter(([event]: [string]) => event === 'game:ended'),
    ).toHaveLength(1);
  });
  it('결과 도착 전에는 재시도하고 도착 또는 unmount 후에는 멈춘다', async () => {
    vi.useFakeTimers();
    const sync = vi.fn();
    let received = false;
    const stop = recoverGameResult(sync, () => received);
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(sync).toHaveBeenCalledTimes(3);
    received = true;
    await vi.advanceTimersByTimeAsync(5000);
    expect(sync).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
    stop();
    received = false;
    const cancel = recoverGameResult(sync, () => received);
    cancel();
    await vi.advanceTimersByTimeAsync(3000);
    expect(sync).toHaveBeenCalledTimes(4);
  });
});
