'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useLobbyStore } from '@/stores/lobby';
import { useNicknameStore } from '@/stores/nickname';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import type { RoomSummary } from '@/shared/types';

export function useLobby() {
  const store = useLobbyStore();
  const router = useRouter();
  const requireNickname = useNicknameStore((s) => s.requireNickname);

  useEffect(() => {
    const socket = getSocket();
    const { setRooms, addRoom, updateRoom, removeRoom } = useLobbyStore.getState();

    // lobby:join — LOBBY_ROOM 재가입 (방에서 나온 후 로비 페이지로 돌아올 때 포함)
    // useSocket.ts 에서 초기 연결 시에도 lobby:join을 보내지만, 방에서 나온 뒤
    // 랭킹 등 다른 페이지 거쳐 로비로 돌아올 때는 서버가 자동 rejoin해줌.
    const onConnect = () => socket.emit('lobby:join');
    if (socket.connected) {
      socket.emit('lobby:join');
    } else {
      socket.on('connect', onConnect);
    }

    socket.on('lobby:rooms', setRooms);
    socket.on('lobby:room:created', addRoom);
    socket.on('lobby:room:updated', updateRoom);
    socket.on('lobby:room:removed', removeRoom);

    return () => {
      socket.off('connect', onConnect);
      socket.off('lobby:rooms', setRooms);
      socket.off('lobby:room:created', addRoom);
      socket.off('lobby:room:updated', updateRoom);
      socket.off('lobby:room:removed', removeRoom);
      // lobby:leave를 보내지 않음 — 페이지 이동 시에도 LOBBY_ROOM 유지.
      // 방 입장 시에는 서버가 socket.leave(LOBBY_ROOM)을 직접 처리.
    };
  }, []);

  const joinRoom = useCallback((room: RoomSummary, onPrivate: () => void) => {
    requireNickname(() => {
      if (room.roomType === 'private') {
        onPrivate();
        return;
      }
      getSocket().emit('room:join', { roomId: room.id }, (res) => {
        if (res.success) {
          useLobbyChatStore.getState().clearAll();
          router.push(`/room/${room.id}`);
        } else {
          toast.error(res.error ?? '입장에 실패했습니다.');
        }
      });
    });
  }, [requireNickname, router]);

  const spectateRoom = useCallback((room: RoomSummary, onPrivate: () => void) => {
    requireNickname(() => {
      if (room.roomType === 'private') {
        onPrivate();
        return;
      }
      getSocket().emit('spectate:join', { roomId: room.id }, (res) => {
        if (res.success) {
          useLobbyChatStore.getState().clearAll();
          router.push(`/room/${room.id}`);
        } else {
          toast.error(res.error ?? '관전에 실패했습니다.');
        }
      });
    });
  }, [requireNickname, router]);

  return { ...store, joinRoom, spectateRoom };
}
