'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { RoomChatBody } from '@/components/room/RoomChat';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useGameSpectatorCount } from '@/hooks/useGameSpectatorCount';
import { useRoomStore } from '@/stores/room';
import { useGuildWarStore } from '@/stores/guildWar';
import { GUILD_WAR_ROOM_ID } from '@shared/types/ring-the-bell';
import GameChatParticipants from './GameChatParticipants';

/** 인게임은 방 채널만 제공한다. 길드전의 비공개 길드 채널은 별도로 유지한다. */
export function useGameChatChannel() {
  const isGuildWar = useRoomStore((s) => s.room?.id === GUILD_WAR_ROOM_ID);
  const seatBlock = useGuildWarStore((s) => s.state?.seatBlock);
  const hasGuild = isGuildWar && seatBlock != null && seatBlock !== 'no_guild';
  const [selected, setChannel] = useState<'room' | 'guild_war'>('room');
  const channel = hasGuild ? selected : 'room';
  if (channel !== selected) setChannel(channel);
  return useMemo(() => ({ channel, setChannel, hasGuild }), [channel, hasGuild]);
}
type GameChatChannel = ReturnType<typeof useGameChatChannel>;

export function GameRoomChatBody({ channels }: { channels: GameChatChannel }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        hidden={channels.channel !== 'room'}
        className={channels.channel === 'room' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
      >
        <RoomChatBody scope="room" scrollClassName="flex-1 min-h-[120px] max-h-none" />
      </div>
      {channels.hasGuild && (
        <div
          hidden={channels.channel !== 'guild_war'}
          className={channels.channel === 'guild_war' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        >
          <RoomChatBody scope="guild_war" scrollClassName="flex-1 min-h-[120px] max-h-none" />
        </div>
      )}
    </div>
  );
}

export function GameRoomChatActions({
  channels,
  active = true,
}: {
  channels: GameChatChannel;
  active?: boolean;
}) {
  const room = useRoomStore((s) => s.room);
  const myId = useMySocketId();
  const spectatorCount = useGameSpectatorCount();
  return (
    <div className="flex shrink-0 items-center">
      {channels.hasGuild && (
        <button
          type="button"
          className="rounded-cdm-md text-cdm-fg-muted hover:bg-cdm-bg-elev-1 px-2 py-1.5 text-xs"
          onClick={() => channels.setChannel(channels.channel === 'room' ? 'guild_war' : 'room')}
        >
          {channels.channel === 'room' ? '길드 채팅' : '방 채팅'}
        </button>
      )}
      <GameChatParticipants
        room={room}
        myId={myId}
        spectatorCount={spectatorCount}
        active={active}
      />
    </div>
  );
}

export function GameChatSheet({
  open,
  onClose,
  channels,
}: {
  open: boolean;
  onClose: () => void;
  channels: GameChatChannel;
}) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) useRoomStore.getState().clearChatUnread();
  }, [open]);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="방 채팅"
      headerTitle={channels.channel === 'room' ? '방 채팅' : '길드 채팅'}
      headerRight={<GameRoomChatActions channels={channels} active={open} />}
      bodyClassName="px-0"
    >
      <div className="flex h-[52dvh] flex-col">
        <GameRoomChatBody channels={channels} />
      </div>
    </BottomSheet>
  );
}
