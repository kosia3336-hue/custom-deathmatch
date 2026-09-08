'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getSocket, getOrCreateSessionToken } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import type { GameTimeExpiry } from '@/shared/types/events';
import type { Room, Player, ChatMessage, GameState, GameResult, RankGameEndedPayload } from '@/shared/types';

export function useRoom(roomId: string) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    useRoomStore.getState().clearMessages();
    // 방 진입 시 로비 채팅도 초기화 (방어적 — useLobby/RankVsOverlay에서 이미 처리되지만,
    // 새로고침으로 직접 /room/[id] 진입한 경우를 커버)
    useLobbyChatStore.getState().clearAll();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onRoomState = (room: Room) => {
      if (room.id !== roomId) return;
      const myId = getOrCreateSessionToken();
      const isSpectator = room.spectators.some((s) => s.id === myId);
      useRoomStore.getState().setRoom(room);
      useRoomStore.getState().setSpectator(isSpectator);
    };
    const onPlayerJoined = (player: Player) => useRoomStore.getState().addPlayer(player);
    const onPlayerLeft = ({ playerId, nickname, newHostId }: { playerId: string; nickname: string; newHostId?: string }) => {
      useRoomStore.getState().removePlayer(playerId);
      if (newHostId) useRoomStore.getState().setHost(newHostId);
      toast.info(`${nickname} 님이 나갔습니다.`);
    };
    const onPlayerReady = ({ playerId }: { playerId: string }) => useRoomStore.getState().setPlayerReady(playerId, true);
    const onPlayerUnready = ({ playerId }: { playerId: string }) => useRoomStore.getState().setPlayerReady(playerId, false);
    const onPlayerKicked = ({ playerId }: { playerId: string }) => useRoomStore.getState().removePlayer(playerId);
    const onHostChanged = ({ newHostId }: { newHostId: string }) => useRoomStore.getState().setHost(newHostId);
    const onCountdown = ({ count }: { count: number }) => useRoomStore.getState().setCountdown(count);
    const onGameStarted = () => { useRoomStore.getState().setCountdown(null); useRoomStore.getState().setTimeExpiry(null); };
    const onSettingsUpdated = (room: Room) => useRoomStore.getState().updateSettings(room);
    const onDisbanded = () => { useRoomStore.getState().reset(); };
    const onChatMessage = (msg: ChatMessage) => {
      if (msg.scope === 'lobby' || msg.scope === 'guild') return;
      useRoomStore.getState().addMessage(msg);
    };
    const onGameState = (state: GameState) => {
      if (state.roomId !== roomId) return;
      useRoomStore.getState().setGameState(state);
    };
    const onGameEnded = (result: GameResult) => { useRoomStore.getState().setGameResult(result); };
    const onTimeExpiry = (value: GameTimeExpiry | null) => {
      if (value && value.roomId !== roomId) return;
      useRoomStore.getState().setTimeExpiry(value);
    };
    const onRankGameEnded = (payload: RankGameEndedPayload) => {
      useRoomStore.getState().setRankGameEnded(payload);
    };
    const onSocketError = (data: { message?: string }) => {
      if (data?.message) toast.error(data.message);
    };

    // 재연결 관련 핸들러
    const onPlayerReconnecting = ({ playerId, nickname, secondsLeft }: { playerId: string; nickname: string; secondsLeft: number }) => {
      useRoomStore.getState().addReconnectingPlayer({ playerId, nickname, secondsLeft });
    };
    const onPlayerReconnected = ({ playerId, nickname }: { playerId: string; nickname: string }) => {
      useRoomStore.getState().removeReconnectingPlayer(playerId);
      toast.success(`${nickname} 님이 재연결되었습니다.`);
    };
    const onSessionRestored = ({ nickname }: { nickname: string; roomId?: string }) => {
      // 닉네임 스토어 복원 (서버가 room:state + game:state를 이미 함께 전송)
      useNicknameStore.getState().setNickname(nickname);
      toast.success('연결이 복구되었습니다.');
    };

    socket.on('room:state', onRoomState);
    socket.on('room:player:joined', onPlayerJoined);
    socket.on('room:player:left', onPlayerLeft);
    socket.on('room:player:ready', onPlayerReady);
    socket.on('room:player:unready', onPlayerUnready);
    socket.on('room:player:kicked', onPlayerKicked);
    socket.on('room:host:changed', onHostChanged);
    socket.on('room:countdown', onCountdown);
    socket.on('room:game:started', onGameStarted);
    socket.on('room:settings:updated', onSettingsUpdated);
    socket.on('room:disbanded', onDisbanded);
    socket.on('chat:message', onChatMessage);
    socket.on('game:state', onGameState);
    socket.on('game:ended', onGameEnded);
    socket.on('game:time-expiry', onTimeExpiry);
    socket.on('rank:game:ended', onRankGameEnded);
    socket.on('error', onSocketError);
    socket.on('player:reconnecting', onPlayerReconnecting);
    socket.on('player:reconnected', onPlayerReconnected);
    socket.on('session:restored', onSessionRestored);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('room:player:joined', onPlayerJoined);
      socket.off('room:player:left', onPlayerLeft);
      socket.off('room:player:ready', onPlayerReady);
      socket.off('room:player:unready', onPlayerUnready);
      socket.off('room:player:kicked', onPlayerKicked);
      socket.off('room:host:changed', onHostChanged);
      socket.off('room:countdown', onCountdown);
      socket.off('room:game:started', onGameStarted);
      socket.off('room:settings:updated', onSettingsUpdated);
      socket.off('room:disbanded', onDisbanded);
      socket.off('chat:message', onChatMessage);
      socket.off('game:state', onGameState);
      socket.off('game:ended', onGameEnded);
      socket.off('game:time-expiry', onTimeExpiry);
      socket.off('rank:game:ended', onRankGameEnded);
      socket.off('error', onSocketError);
      socket.off('player:reconnecting', onPlayerReconnecting);
      socket.off('player:reconnected', onPlayerReconnected);
      socket.off('session:restored', onSessionRestored);
    };
  }, [roomId]);

  return {
    room: useRoomStore((s) => s.room),
    gameState: useRoomStore((s) => s.gameState),
    gameResult: useRoomStore((s) => s.gameResult),
    countdown: useRoomStore((s) => s.countdown),
  };
}
