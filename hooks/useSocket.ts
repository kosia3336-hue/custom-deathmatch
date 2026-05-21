'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore, type RankMatchedPayload } from '@/stores/rankMatch';
import { useSessionTakeoverStore } from '@/stores/sessionTakeover';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { useEventRoomStore } from '@/stores/eventRoom';
import { useEventChipsStore } from '@/stores/eventChips';
import type { ChatMessage, IPEMetaPayload, IPEChipChangedPayload } from '@/shared/types';
import type { OnlineUser } from '@/shared/types/events';

/** 루트에서 한 번만 호출하면 됨 (`SocketProvider`). 반환값 없음 — 소켓은 `getSocket()`. */
export function useSocket(): void {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // 로그인 여부와 무관하게 소켓 연결 (비로그인 = 게스트, 로비 방 목록만 수신 가능)
      if (cancelled) return;
      const s = await connectSocket();

      // 초기 연결 시 LOBBY_ROOM 참여 (모든 페이지에서 온라인 유저 업데이트 수신)
      s.emit('lobby:join');

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

    const onRankMatched = (data: RankMatchedPayload) => {
      useRankMatchStore.getState().setMatched(data);
    };

    s.on('rank:queue:matched', onRankMatched);
    s.on('session:restored', onSessionRestored);
    s.on('session:replaced', onSessionReplaced);
    s.on('connect_error', onConnectError);

    return () => {
      s.off('rank:queue:matched', onRankMatched);
      s.off('session:restored', onSessionRestored);
      s.off('session:replaced', onSessionReplaced);
      s.off('connect_error', onConnectError);
    };
  }, [router]);

  // v2.1: 로비 채팅 + 접속자 현황 — 글로벌 수신 + 라이프사이클 초기화
  useEffect(() => {
    const s = getSocket();

    const onLobbyChat = (msg: ChatMessage) => {
      if (msg.scope !== 'lobby') return;
      useLobbyChatStore.getState().addMessage(msg);
    };

    // lobby:users:online 글로벌 리스너 — 모든 페이지에서 실시간 업데이트
    const onOnlineUsers = (data: { users: OnlineUser[] }) => {
      useOnlineUsersStore.getState().setUsers(data.users);
    };

    const onDisconnect = () => {
      useLobbyChatStore.getState().clearAll();
    };

    const onReconnect = () => {
      // 재연결 시 LOBBY_ROOM 재가입 + 채팅 초기화
      s.emit('lobby:join');
      useLobbyChatStore.getState().clearAll();
    };

    const onSessionReplacedClear = () => {
      useLobbyChatStore.getState().clearAll();
    };

    // 이벤트 룸 — 글로벌 메타 + 칩 변동 (모든 페이지에서 GNB·로비 동기화)
    const onEventMeta = (m: IPEMetaPayload) => {
      useEventRoomStore.getState().setMeta(m);
    };
    const onEventChipChanged = (p: IPEChipChangedPayload) => {
      if (typeof p.newBalance === 'number') {
        useEventChipsStore.getState().setBalance(p.newBalance);
      }
    };

    s.on('chat:message', onLobbyChat);
    s.on('lobby:users:online', onOnlineUsers);
    s.on('disconnect', onDisconnect);
    s.on('connect', onReconnect);
    s.on('session:replaced', onSessionReplacedClear);
    s.on('event:meta:changed', onEventMeta);
    s.on('event:chip:changed', onEventChipChanged);

    return () => {
      s.off('chat:message', onLobbyChat);
      s.off('lobby:users:online', onOnlineUsers);
      s.off('disconnect', onDisconnect);
      s.off('connect', onReconnect);
      s.off('session:replaced', onSessionReplacedClear);
      s.off('event:meta:changed', onEventMeta);
      s.off('event:chip:changed', onEventChipChanged);
    };
  }, []);
}
