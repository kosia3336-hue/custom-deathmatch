import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';
import type { Player } from '@shared/types/room.js';
import { registerGameHandlers } from '../socket/game.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { cleanupKingmaking, initKingmaking } from '../socket/games/kingmaking/index.js';
import { kingmakingStates } from '../socket/games/kingmaking/state.js';
import type { IO, TypedSocket } from '../socket/types.js';

/**
 * 회귀 테스트 — game:action 페이로드가 망가져도 서버가 죽지 않아야 한다.
 *
 * 게임 모듈은 대부분 data 를 자기 액션 타입으로 캐스팅한 뒤 곧바로 .type 을 읽는다.
 * null 이 들어오면 거기서 TypeError 가 나는데, socket.io 는 리스너 예외를 잡지 않고
 * process.nextTick 밖으로 흘려보내므로 서버 프로세스가 통째로 죽는다. 이 서버는
 * 방·게임 상태를 전부 메모리에 들고 있어서(index.ts /health 주석 참고) 그러면
 * 진행 중이던 모든 방이 함께 사라진다.
 */

const createdRooms: string[] = [];
const socketIds: string[] = [];

afterEach(() => {
  for (const roomId of createdRooms) {
    cleanupKingmaking(roomId);
    roomStore.delete(roomId);
  }
  for (const socketId of socketIds) sessions.removeSession(socketId);
  createdRooms.length = 0;
  socketIds.length = 0;
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: false, isReady: true, joinedAt: Date.now() };
}

function ioStub() {
  return {
    in: () => ({ fetchSockets: async () => [] }),
    to: () => ({ emit: () => {} }),
  } as unknown as IO;
}

/** socket.on 으로 등록되는 핸들러를 붙잡아 두는 가짜 소켓 */
function harness(playerId: string) {
  const handlers = new Map<string, (data: unknown) => void>();
  const emitted: { event: string; payload: unknown }[] = [];
  const socketId = `socket-${playerId}`;
  socketIds.push(socketId);
  const socket = {
    id: socketId,
    on: (event: string, handler: (data: unknown) => void) => handlers.set(event, handler),
    emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    join: () => {},
    leave: () => {},
  } as unknown as TypedSocket;
  return { socket, handlers, emitted, socketId };
}

function startKingmakingRoom() {
  const host = player('payload-host', '방장');
  const guest = player('payload-guest', '손님');
  const room = roomStore.create({
    title: '페이로드 방어',
    gameId: GAME_IDS.KINGMAKING,
    gameName: '킹메이킹',
    playMode: 'multi',
    roomType: 'public',
    maxPlayers: 2,
    minPlayers: 2,
    host,
  });
  createdRooms.push(room.id);
  roomStore.addPlayer(room.id, guest);
  roomStore.setStatus(room.id, 'playing');
  const io = ioStub();
  initKingmaking(io, room.id, [host, guest], 'multi', Date.now(), null, vi.fn());
  return { io, roomId: room.id, host, guest };
}

describe('game:action 페이로드 방어', () => {
  const malformed: [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['문자열', 'place'],
    ['숫자', 42],
    ['불리언', true],
    ['배열', [{ type: 'place' }]],
    ['type 이 null 인 객체', { type: null }],
    ['중첩 null', { type: 'move', from: null, to: null, count: null }],
  ];

  it.each(malformed)('%s 페이로드를 받아도 예외가 새지 않는다', (_label, payload) => {
    const { io, roomId, host } = startKingmakingRoom();
    const { socket, handlers } = harness(host.id);
    sessions.linkToken(socket.id, host.id);
    sessions.setRoom(socket.id, roomId);
    registerGameHandlers(io, socket);

    const onGameAction = handlers.get('game:action');
    expect(onGameAction).toBeTypeOf('function');
    expect(() => onGameAction!(payload)).not.toThrow();
  });

  it('정상 페이로드는 그대로 처리된다', () => {
    const { io, roomId, host } = startKingmakingRoom();
    const { socket, handlers } = harness(host.id);
    sessions.linkToken(socket.id, host.id);
    sessions.setRoom(socket.id, roomId);
    registerGameHandlers(io, socket);

    handlers.get('game:action')!({ type: 'place', kind: 'normal', to: { row: 2, col: 2 } });
    expect(kingmakingStates.get(roomId)!.board[2][2]).toHaveLength(1);
  });
});
