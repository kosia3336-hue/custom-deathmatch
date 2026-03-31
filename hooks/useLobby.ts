'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useLobbyStore } from '@/stores/lobby';
import { useNicknameStore } from '@/stores/nickname';
import type { RoomSummary } from '@/shared/types';

export function useLobby() {
  const store = useLobbyStore();
  const router = useRouter();
  const requireNickname = useNicknameStore((s) => s.requireNickname);

  useEffect(() => {
    const socket = getSocket();
    const { setRooms, addRoom, updateRoom, removeRoom } = useLobbyStore.getState();

    socket.emit('lobby:join');

    socket.on('lobby:rooms', setRooms);
    socket.on('lobby:room:created', addRoom);
    socket.on('lobby:room:updated', updateRoom);
    socket.on('lobby:room:removed', removeRoom);

    return () => {
      socket.off('lobby:rooms', setRooms);
      socket.off('lobby:room:created', addRoom);
      socket.off('lobby:room:updated', updateRoom);
      socket.off('lobby:room:removed', removeRoom);
      socket.emit('lobby:leave');
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
          router.push(`/room/${room.id}`);
        } else {
          toast.error(res.error ?? '관전에 실패했습니다.');
        }
      });
    });
  }, [requireNickname, router]);

  return { ...store, joinRoom, spectateRoom };
}
