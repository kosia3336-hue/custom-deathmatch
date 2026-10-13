'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/classic-era/lib/socket';
import { useRoomStore } from '@/classic-era/stores/room';
import type { Room, Player } from '@/classic-era/shared/types';
import type { UpdateRoomSettings, ChatMessage, GameState, GameResult } from '@/classic-era/shared/types';

export function useRoom(roomId: string) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    useRoomStore.getState().clearMessages();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onRoomState = (room: Room) => useRoomStore.getState().setRoom(room);
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
    const onGameStarted = () => useRoomStore.getState().setCountdown(null);
    const onSettingsUpdated = (settings: UpdateRoomSettings) => useRoomStore.getState().updateSettings(settings);
    const onDisbanded = () => useRoomStore.getState().reset();
    const onChatMessage = (msg: ChatMessage) => useRoomStore.getState().addMessage(msg);
    const onGameState = (state: GameState) => useRoomStore.getState().setGameState(state);
    const onGameEnded = (result: GameResult) => useRoomStore.getState().setGameResult(result);

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
    };
  }, [roomId]);

  return {
    room: useRoomStore((s) => s.room),
    gameState: useRoomStore((s) => s.gameState),
    gameResult: useRoomStore((s) => s.gameResult),
    countdown: useRoomStore((s) => s.countdown),
  };
}
