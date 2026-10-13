'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '@/classic-era/lib/socket';

export function useMySocketId() {
  const [myId, setMyId] = useState<string | undefined>(() => getSocket().id);

  useEffect(() => {
    const socket = getSocket();
    const sync = () => setMyId(socket.id);
    sync();
    socket.on('connect', sync);
    return () => { socket.off('connect', sync); };
  }, []);

  return myId;
}
