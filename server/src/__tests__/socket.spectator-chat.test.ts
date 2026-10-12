import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerRoomHandlers } from '../socket/room';
import { roomStore } from '../store/rooms';
import { sessions } from '../store/sessions';
import type { IO, TypedSocket } from '../socket/types';

describe('관전자 입·퇴장 채팅 알림', () => {
  afterEach(() => {
    roomStore.getAll().forEach((r) => roomStore.delete(r.id));
    sessions.removeSession('spectator-chat-test');
  });

  it('입·퇴장 메시지는 분류와 닉네임을 포함하며 반복 요청은 중복 알리지 않는다', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const emit = vi.fn();
    const socket = {
      id: 'spectator-chat-test',
      data: {},
      on: (name: string, handler: (...args: unknown[]) => void) => handlers.set(name, handler),
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
    } as unknown as TypedSocket;
    const io = {
      to: vi.fn(() => ({ emit })),
      emit,
      sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    } as unknown as IO;
    sessions.linkToken(socket.id, 'spectator-chat-token');
    sessions.setNickname(socket.id, '별빛관전자');
    const room = roomStore.create({
      title: '테스트',
      gameId: 'game-001',
      gameName: '사중력 사목',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host: { id: 'host', nickname: '방장', isHost: true, isReady: false, joinedAt: 1 },
    });
    registerRoomHandlers(io, socket);
    const callback = vi.fn();
    const join = handlers.get('spectate:join')!;
    join({ roomId: room.id }, callback);
    join({ roomId: room.id }, callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const chats = emit.mock.calls.filter(([name]) => name === 'chat:message');
    expect(chats).toHaveLength(1);
    expect(chats[0][1]).toMatchObject({
      scope: 'room',
      isSystem: true,
      systemEvent: 'spectator_join',
      message: '별빛관전자 님이 관전자로 들어왔습니다.',
    });
    expect(roomStore.get(room.id)?.spectators).toHaveLength(1);
    const leave = handlers.get('spectate:leave')!;
    leave();
    leave();
    const allChats = emit.mock.calls.filter(([name]) => name === 'chat:message');
    expect(allChats).toHaveLength(2);
    expect(allChats[1][1]).toMatchObject({
      scope: 'room',
      isSystem: true,
      systemEvent: 'spectator_leave',
      message: '별빛관전자 님이 관전에서 나갔습니다.',
    });
    expect(roomStore.get(room.id)?.spectators).toHaveLength(0);
  });
});
