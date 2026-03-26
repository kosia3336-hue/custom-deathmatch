'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import type { Room, Player } from '@/shared/types';
import type { UpdateRoomSettings, ChatMessage, GameState, GameResult } from '@/shared/types';

export function useRoom(roomId: string) {
  const store = useRoomStore();

  useEffect(() => {
    store.clearMessages();

    const socket = getSocket();

    const onRoomState = (room: Room) => store.setRoom(room);
    const onPlayerJoined = (player: Player) => store.addPlayer(player);
    const onPlayerLeft = ({ playerId, newHostId }: { playerId: string; newHostId?: string }) => {
      store.removePlayer(playerId);
      if (newHostId) store.setHost(newHostId);
    };
    const onPlayerReady = ({ playerId }: { playerId: string }) => store.setPlayerReady(playerId, true);
    const onPlayerUnready = ({ playerId }: { playerId: string }) => store.setPlayerReady(playerId, false);
    const onPlayerKicked = ({ playerId }: { playerId: string }) => store.removePlayer(playerId);
    const onHostChanged = ({ newHostId }: { newHostId: string }) => store.setHost(newHostId);
    const onCountdown = ({ count }: { count: number }) => store.setCountdown(count);
    const onGameStarted = () => store.setCountdown(null);
    const onSettingsUpdated = (settings: UpdateRoomSettings) => store.updateSettings(settings);
    const onDisbanded = () => store.reset();
    const onChatMessage = (msg: ChatMessage) => store.addMessage(msg);
    const onGameState = (state: GameState) => store.setGameState(state);
    const onGameEnded = (result: GameResult) => store.setGameResult(result);

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
