'use client';

import { useEffect } from 'react';
import { connectSocket, getSocket } from '@/classic-era/lib/socket';
import { useNicknameStore } from '@/classic-era/stores/nickname';

export function useSocket() {
  useEffect(() => {
    const s = connectSocket();

    const saved = localStorage.getItem('classic-nickname');
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
