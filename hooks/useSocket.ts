'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import { useSessionTakeoverStore } from '@/stores/sessionTakeover';

export function useSocket() {
  const router = useRouter();

  useEffect(() => {
    const s = connectSocket();

    // nickname:set은 session:new(신규 세션 확정) 때만 전송
    // session:restored / session:exists 케이스에선 서버가 이미 닉네임을 알고 있으므로 불필요
    const onSessionNew = () => {
      const saved = localStorage.getItem('nickname');
      if (saved) {
        s.emit('nickname:set', { nickname: saved }, (res) => {
          if (res.success && res.nickname) {
            useNicknameStore.getState().setNickname(res.nickname);
          }
        });
      }
    };

    const onSessionExists = (data: { nickname: string; roomId?: string }) => {
      useSessionTakeoverStore.getState().setPending(data);
    };

    s.on('session:new', onSessionNew);
    s.on('session:exists', onSessionExists);

    return () => {
      s.off('session:new', onSessionNew);
      s.off('session:exists', onSessionExists);
      // don't disconnect on unmount — socket persists across pages
    };
  }, []);

  useEffect(() => {
    const s = getSocket();

    const onSessionRestored = ({ nickname, roomId }: { nickname: string; roomId?: string }) => {
      if (nickname) useNicknameStore.getState().setNickname(nickname);
      // router.push() 사용 — window.location.href는 풀 리로드 → 새 소켓 생성 → 무한 루프
      if (roomId && !window.location.pathname.startsWith('/room/')) {
        router.push(`/room/${roomId}`);
      }
    };

    const onSessionReplaced = () => {
      s.disconnect();
      router.replace('/disconnected');
    };

    s.on('session:restored', onSessionRestored);
    s.on('session:replaced', onSessionReplaced);

    return () => {
      s.off('session:restored', onSessionRestored);
      s.off('session:replaced', onSessionReplaced);
    };
  }, [router]);

  return getSocket();
}
