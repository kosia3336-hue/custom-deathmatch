import { beforeEach, describe, expect, it } from 'vitest';
import { useRoomStore } from '../../../stores/room';
import type { ChatMessage, GameResult, Room } from '../../../shared/types';

const message = (id: string, scope: ChatMessage['scope'] = 'room'): ChatMessage => ({
  id,
  scope,
  sender: 'player',
  senderNickname: '플레이어',
  message: id,
  timestamp: 1,
  isSystem: false,
});
const room = (id: string, gameId = 'game-001') => ({ id, gameId }) as Room;

describe('방 채팅 단계 전환 보존', () => {
  beforeEach(() => useRoomStore.getState().reset());

  it('대기실 → 밴픽 → 게임 → 결과 → 다시하기에서도 같은 방의 메시지를 유지한다', () => {
    const store = useRoomStore.getState();
    store.beginRoomChat('room-a');
    store.setRoom(room('room-a', 'ban-pick'));
    store.addMessage(message('대기실'));
    store.beginRoomChat('room-a');
    store.setRoom(room('room-a', 'game-001'));
    store.addMessage(message('게임', 'game'));
    store.setGameResult({ roomId: 'room-a' } as GameResult);
    store.beginRoomChat('room-a');
    store.setGameResult(null);
    expect(useRoomStore.getState().messages.map((m) => m.id)).toEqual(['대기실', '게임']);
  });

  it('결과가 나온 뒤 방이 해산되어도 결과 채팅은 남는다', () => {
    const store = useRoomStore.getState();
    store.setRoom(room('room-a'));
    store.addMessage(message('지난 채팅'));
    store.setGameResult({ roomId: 'room-a' } as GameResult);
    store.setRoom(null);
    store.beginRoomChat('room-a');
    expect(useRoomStore.getState().chatRoomId).toBe('room-a');
    expect(useRoomStore.getState().messages).toHaveLength(1);
  });

  it('다른 방으로 이동하거나 명시적으로 나갈 때에만 이전 방 기록을 비운다', () => {
    const store = useRoomStore.getState();
    store.setRoom(room('room-a'));
    store.addMessage(message('이전 방'));
    store.beginRoomChat('room-b');
    expect(useRoomStore.getState().messages).toEqual([]);
    store.addMessage(message('새 방'));
    store.reset();
    expect(useRoomStore.getState().chatRoomId).toBeNull();
    expect(useRoomStore.getState().messages).toEqual([]);
  });

  it('구독 인계 중 같은 메시지가 다시 들어와도 중복 표시하지 않는다', () => {
    const store = useRoomStore.getState();
    store.beginRoomChat('room-a');
    store.addMessage(message('중복'));
    store.addMessage(message('중복'));
    expect(useRoomStore.getState().messages).toHaveLength(1);
  });

  it('200건이 넘는 한 판의 대화도 결과에서 전부 볼 수 있다', () => {
    const store = useRoomStore.getState();
    store.beginRoomChat('room-a');
    for (let i = 0; i < 220; i++) store.addMessage(message(String(i)));
    store.beginRoomChat('room-a');
    expect(useRoomStore.getState().messages).toHaveLength(220);
    expect(useRoomStore.getState().messages[0].id).toBe('0');
  });
});
