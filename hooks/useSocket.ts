'use client';

import { useEffect, useRef } from 'react';
import { connectSocket, getSocket, type TypedSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    const s = connectSocket();
    socketRef.current = s;

    const saved = sessionStorage.getItem('nickname');
    if (saved) {
      s.emit('nickname:set', { nickname: saved }, (res) => {
        if (res.success && res.nickname) {
          useNicknameStore.getState().setNickname(res.nickname);
        }
      });
    }

    return () => {
      // don't disconnect on unmount — socket persists across pages
    };
  }, []);

  return socketRef.current ?? getSocket();
}
