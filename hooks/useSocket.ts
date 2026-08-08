'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { connectSocket, getSocket } from '@/lib/socket';
import { notifyRankMatched } from '@/lib/rankMatchNotify';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore, type RankMatchedPayload } from '@/stores/rankMatch';
import { useSessionTakeoverStore } from '@/stores/sessionTakeover';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useGuildChatStore } from '@/stores/guildChat';
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

    async function bootstrap() {
      // 로그인 여부와 무관하게 소켓 연결 (비로그인 = 게스트, 로비 방 목록만 수신 가능)
      if (cancelled) return;
      const s = await connectSocket();

      // 초기 연결 시 LOBBY_ROOM 참여 (모든 페이지에서 온라인 유저 업데이트 수신)
      s.emit('lobby:join');

      s.on('session:new', onSessionNew);
      s.on('session:exists', onSessionExists);
    }

    bootstrap();

    return () => {
      cancelled = true;
      // socket 객체 자체는 모듈 싱글톤이므로 listener 만 정리 (페이지 이동 시 유지).
      // 핸들러를 지정해 해제한다 — 이벤트 이름만 넘기면 lib/socket.ts 가 등록한
      // 토큰 재발급 리스너까지 함께 제거된다.
      const s = getSocket();
      s.off('session:new', onSessionNew);
      s.off('session:exists', onSessionExists);
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
      // 매칭은 탭이 뒤에 있을 때 잡히는 경우가 많다 — 효과음이 켜져 있으면 소리로도 알린다
      notifyRankMatched();
    };

    /**
     * 재연결 시 랭크 큐 복귀.
     *
     * 서버는 소켓이 끊기는 즉시 큐에서 제거한다(rankQueueStore.removeBySocket).
     * 모바일에서 백그라운드로 가면 소켓이 죽으므로, 돌아왔을 때 클라이언트는
     * '매칭 중' 으로 보이는데 서버는 이미 잊은 상태가 된다. 큐에 있던 상태면
     * 다시 넣어 준다.
     */
    const onReconnectRequeue = () => {
      if (!useRankMatchStore.getState().queuing) return;
      s.emit('rank:queue:join', (res: { success: boolean; error?: string }) => {
        if (res.success) return;
        // 운영 시간 종료 등으로 복귀 실패 — 대기 중 UI 를 걷어내고 알린다
        useRankMatchStore.getState().setQueuing(false);
        toast.error(res.error ?? '랭크 대기열 복귀에 실패했습니다. 다시 시작해 주세요.');
      });
    };

    s.on('rank:queue:matched', onRankMatched);
    s.on('connect', onReconnectRequeue);
    s.on('session:restored', onSessionRestored);
    s.on('session:replaced', onSessionReplaced);
    s.on('connect_error', onConnectError);

    return () => {
      s.off('rank:queue:matched', onRankMatched);
      s.off('connect', onReconnectRequeue);
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
      useGuildChatStore.getState().clearAll();
    };

    const onReconnect = () => {
      // 재연결 시 LOBBY_ROOM 재가입 + 채팅 초기화
      s.emit('lobby:join');
      useLobbyChatStore.getState().clearAll();
      useGuildChatStore.getState().clearAll();
    };

    const onSessionReplacedClear = () => {
      useLobbyChatStore.getState().clearAll();
      useGuildChatStore.getState().clearAll();
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
