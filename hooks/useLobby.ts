'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useLobbyStore } from '@/stores/lobby';

export function useLobby() {
  const store = useLobbyStore();

  useEffect(() => {
    const socket = getSocket();

    socket.emit('lobby:join');

    const handleRooms = (rooms: Parameters<typeof store.setRooms>[0]) => store.setRooms(rooms);
    const handleCreated = (room: Parameters<typeof store.addRoom>[0]) => store.addRoom(room);
    const handleUpdated = (room: Parameters<typeof store.updateRoom>[0]) => store.updateRoom(room);
    const handleRemoved = (roomId: string) => store.removeRoom(roomId);

    socket.on('lobby:rooms', handleRooms);
    socket.on('lobby:room:created', handleCreated);
    socket.on('lobby:room:updated', handleUpdated);
    socket.on('lobby:room:removed', handleRemoved);

    return () => {
      socket.off('lobby:rooms', handleRooms);
      socket.off('lobby:room:created', handleCreated);
      socket.off('lobby:room:updated', handleUpdated);
      socket.off('lobby:room:removed', handleRemoved);
      socket.emit('lobby:leave');
    };
  }, []);

  return store;
}
