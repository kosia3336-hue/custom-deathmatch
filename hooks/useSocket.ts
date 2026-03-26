'use client';

import { useEffect } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';

export function useSocket() {
  useEffect(() => {
    const s = connectSocket();

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

  return getSocket();
}
