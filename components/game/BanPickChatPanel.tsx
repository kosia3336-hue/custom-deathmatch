'use client';

import { cn } from '@/lib/utils';
import { GameRoomChatActions, GameRoomChatBody, useGameChatChannel } from './GameRoomChat';

/**
 * 밴픽 넓은 화면 — 오른쪽 사이드바 맨 위에 펴 두는 방 채팅.
 * 편의기능 창으로 따로 붙이면 채팅과 사이드바가 세로줄을 하나씩 차지해서, 한 줄에 위아래로 쌓는다.
 * 좁은 화면은 상단 바 채팅 아이콘(시트)을 그대로 쓴다.
 */
export function BanPickChatPanel({ className }: { className?: string }) {
  const channels = useGameChatChannel();
  return (
    <section
      aria-label="방 채팅"
      className={cn(
        'border-cdm-border bg-cdm-bg rounded-cdm-lg flex min-h-0 flex-col overflow-hidden border',
        className,
      )}
    >
      <header className="border-cdm-border flex shrink-0 items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <h3 className="text-cdm-fg text-xs font-bold">
          {channels.channel === 'room' ? '방 채팅' : '길드 채팅'}
        </h3>
        <GameRoomChatActions channels={channels} />
      </header>
      <GameRoomChatBody channels={channels} />
    </section>
  );
}
