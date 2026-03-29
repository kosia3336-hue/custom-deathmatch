'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useLobbyStore } from '@/stores/lobby';

export function useLobby() {
  const store = useLobbyStore();

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

  return store;
}
