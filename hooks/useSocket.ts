'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import { useSessionTakeoverStore } from '@/stores/sessionTakeover';

export function useSocket() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // 로그인 여부와 무관하게 소켓 연결 (비로그인 = 게스트, 로비 방 목록만 수신 가능)
      if (cancelled) return;
      const s = await connectSocket();

      // v2: 서버가 session:new 에 닉네임을 실어 보냄
      // 닉네임 없음 = 게스트 연결 → stale 로컬스토리지 닉네임 제거
      const onSessionNew = ({ nickname }: { nickname: string }) => {
        if (nickname) {
          useNicknameStore.getState().setNickname(nickname);
        } else {
          useNicknameStore.setState({ nickname: null });
          try { localStorage.removeItem('nickname'); } catch { /* ignore */ }
        }
      };

      const onSessionExists = (data: { nickname: string; roomId?: string }) => {
        useSessionTakeoverStore.getState().setPending(data);
      };

      s.on('session:new', onSessionNew);
      s.on('session:exists', onSessionExists);
    }

    bootstrap();

    return () => {
      cancelled = true;
      // socket 객체 자체는 모듈 싱글톤이므로 listener 만 정리 (페이지 이동 시 유지)
      const s = getSocket();
      s.off('session:new');
      s.off('session:exists');
    };
  }, []);

  useEffect(() => {
    const s = getSocket();

    const onSessionRestored = ({ nickname, roomId }: { nickname: string; roomId?: string }) => {
      if (nickname) useNicknameStore.getState().setNickname(nickname);
      if (roomId && !window.location.pathname.startsWith('/room/')) {
        router.push(`/room/${roomId}`);
      }
    };

    const onSessionReplaced = () => {
      s.disconnect();
      router.replace('/disconnected');
    };

    const onConnectError = (err: Error) => {
      // 인증 실패 등은 페이지 단(proxy.ts) 가드가 이미 처리. 여기선 콘솔만.
      console.warn('[socket] connect_error:', err.message);
    };

    s.on('session:restored', onSessionRestored);
    s.on('session:replaced', onSessionReplaced);
    s.on('connect_error', onConnectError);

    return () => {
      s.off('session:restored', onSessionRestored);
      s.off('session:replaced', onSessionReplaced);
      s.off('connect_error', onConnectError);
    };
  }, [router]);

  return getSocket();
}
