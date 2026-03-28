'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import type { Room, Player } from '@/shared/types';
import type { UpdateRoomSettings, ChatMessage, GameState, GameResult } from '@/shared/types';

export function useRoom(roomId: string) {
  const store = useRoomStore();

  useEffect(() => {
    const s = useRoomStore.getState();
    s.clearMessages();

    const socket = getSocket();

    const onRoomState = (room: Room) => useRoomStore.getState().setRoom(room);
    const onPlayerJoined = (player: Player) => useRoomStore.getState().addPlayer(player);
    const onPlayerLeft = ({ playerId, newHostId }: { playerId: string; newHostId?: string }) => {
      useRoomStore.getState().removePlayer(playerId);
      if (newHostId) useRoomStore.getState().setHost(newHostId);
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

  return store;
}
