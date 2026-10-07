'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/cdm';
import type { IconName } from '@/components/cdm/Icon';
import { RoomChatBody } from './RoomChat';
import { LobbyChatList } from '@/components/lobby/LobbyChatList';
import { LobbyChatInput } from '@/components/lobby/LobbyChatInput';
import { OnlineUsersList } from '@/components/lobby/OnlineUsersList';
import { useRoomStore } from '@/stores/room';
import { useGuildWarStore } from '@/stores/guildWar';
import { useNicknameStore } from '@/stores/nickname';
import { GUILD_WAR_ROOM_ID } from '@shared/types/ring-the-bell';
import type { ChatScope } from '@/shared/types';
import { cn } from '@/lib/utils';

type WaitingRoomChatChannel = 'users' | 'room' | 'guild_war' | 'lobby';
interface ChatChannelChoice {
  id: WaitingRoomChatChannel;
  label: string;
  icon: IconName;
}

/** 창 제목과 본문이 같은 채널 상태를 공유한다. 권한이 사라진 채널은 방으로 복귀한다. */
export function useWaitingRoomChatChannels() {
  const [selected, setChannel] = useState<WaitingRoomChatChannel>('room');
  const canSeeUsers = useNicknameStore((s) => s.nickname) === '천하';
  const isGuildWar = useRoomStore((s) => s.room?.id === GUILD_WAR_ROOM_ID);
  const war = useGuildWarStore((s) => s.state);
  const showGuild = isGuildWar && war != null && war.seatBlock !== 'no_guild';
  const choices = useMemo<ChatChannelChoice[]>(
    () => [
      ...(canSeeUsers ? [{ id: 'users' as const, label: '접속자', icon: 'me' as const }] : []),
      { id: 'room', label: '방 채팅', icon: 'chat' },
      ...(showGuild
        ? [{ id: 'guild_war' as const, label: '길드 채팅', icon: 'guild' as const }]
        : []),
      { id: 'lobby', label: '로비', icon: 'home' },
    ],
    [canSeeUsers, showGuild],
  );
  const channel = choices.some((choice) => choice.id === selected) ? selected : 'room';
  if (channel !== selected) setChannel(channel);
  return useMemo(() => ({ channel, setChannel, choices }), [channel, choices]);
}
type WaitingRoomChatChannels = ReturnType<typeof useWaitingRoomChatChannels>;

/** 대기실 채팅 제목. 아이콘과 인원수는 제목에 붙이지 않는다. */
function ChatChannelTitle({
  channel,
  choices,
}: {
  channel: WaitingRoomChatChannel;
  choices: ChatChannelChoice[];
}) {
  return <span>{choices.find((choice) => choice.id === channel)?.label}</span>;
}
export function WaitingRoomChatTitle({ channels }: { channels: WaitingRoomChatChannels }) {
  return <ChatChannelTitle channel={channels.channel} choices={channels.choices} />;
}

/** 방에서는 로비로, 로비에서는 방으로 전환한다. 길드/접속자 선택은 별도 유지한다. */
function ChatChannelToggle({
  channel,
  choices,
  onChange,
}: {
  channel: WaitingRoomChatChannel;
  choices: ChatChannelChoice[];
  onChange: (channel: WaitingRoomChatChannel) => void;
}) {
  const target = choices.find((choice) => choice.id === (channel === 'room' ? 'lobby' : 'room'));
  const extras = choices.filter((choice) => choice.id !== 'room' && choice.id !== 'lobby');
  return (
    <div role="group" aria-label="채팅 채널" className="flex shrink-0 items-center gap-1">
      {target && (
        <button
          type="button"
          aria-label={`${target.id === 'lobby' ? '로비 채팅' : '방 채팅'}으로 전환`}
          title={`${target.id === 'lobby' ? '로비 채팅' : '방 채팅'}으로 전환`}
          onClick={() => onChange(target.id)}
          className="rounded-cdm-md border-cdm-border text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg focus-visible:outline-cdm-primary flex min-h-8 items-center justify-center gap-1.5 border px-2 py-1 text-[11px] transition-colors focus-visible:outline-2"
        >
          <Icon name="swap" />
          <span>{target.id === 'lobby' ? '로비 채팅으로 전환' : '방 채팅으로 전환'}</span>
        </button>
      )}
      {extras.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-label={choice.label}
          aria-pressed={channel === choice.id}
          title={choice.label}
          onClick={() => onChange(choice.id)}
          className={cn(
            'rounded-cdm-md flex h-8 w-8 items-center justify-center',
            channel === choice.id
              ? 'bg-cdm-primary/15 text-cdm-primary'
              : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-1',
          )}
        >
          <Icon name={choice.icon} />
        </button>
      ))}
    </div>
  );
}
export function WaitingRoomChatActions({ channels }: { channels: WaitingRoomChatChannels }) {
  return (
    <ChatChannelToggle
      channel={channels.channel}
      choices={channels.choices}
      onChange={channels.setChannel}
    />
  );
}

/** 채널 전환·도킹 중에도 각각의 입력 초안과 스크롤 위치를 유지한다. */
export function WaitingRoomChatContent({
  channels,
  scope,
  active,
}: {
  channels: WaitingRoomChatChannels;
  scope: ChatScope;
  active: boolean;
}) {
  const lobbyInputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (!active || channels.channel !== 'lobby') return;
    const timer = setTimeout(() => lobbyInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [active, channels.channel]);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {channels.choices.map((choice) => (
        <div
          key={choice.id}
          id={`${id}-${choice.id}`}
          role="region"
          aria-label={choice.label}
          hidden={channels.channel !== choice.id}
          className={cn(
            'min-h-0 flex-1 flex-col overflow-hidden',
            channels.channel === choice.id ? 'flex' : 'hidden',
          )}
        >
          {choice.id === 'users' && <OnlineUsersList />}
          {choice.id === 'room' && (
            <RoomChatBody scope={scope} scrollClassName="flex-1 min-h-[120px] max-h-none" />
          )}
          {choice.id === 'guild_war' && (
            <RoomChatBody scope="guild_war" scrollClassName="flex-1 min-h-[120px] max-h-none" />
          )}
          {choice.id === 'lobby' && (
            <>
              <LobbyChatList />
              <LobbyChatInput ref={lobbyInputRef} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
