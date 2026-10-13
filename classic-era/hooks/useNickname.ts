'use client';

import { useCallback } from 'react';
import { getSocket } from '@/classic-era/lib/socket';
import { useNicknameStore } from '@/classic-era/stores/nickname';

export function useNickname() {
  const { nickname, showModal, setNickname, openModal, closeModal, requireNickname } =
    useNicknameStore();

  const submitNickname = useCallback(
    (name: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const socket = getSocket();
        socket.emit('nickname:set', { nickname: name }, (res) => {
          if (res.success && res.nickname) {
            setNickname(res.nickname);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error });
          }
        });
      });
    },
    [setNickname],
  );

  return { nickname, showModal, openModal, closeModal, requireNickname, submitNickname };
}
