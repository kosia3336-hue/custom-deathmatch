'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { getSocket } from '@/classic-era/lib/socket';
import { useRoomStore } from '@/classic-era/stores/room';
import { useNicknameStore } from '@/classic-era/stores/nickname';
import { cn } from '@/classic-era/lib/utils';
import Button from '@/classic-era/components/ui/Button';
import type { ChatScope, ChatMessage } from '@/classic-era/shared/types';

// useSyncExternalStore 셀렉터가 매 호출마다 새 참조를 반환하면 무한 루프가 생기므로
// 안정적인 빈 배열 참조를 모듈 스코프에 선언
const EMPTY_SPECTATORS: { id: string }[] = [];

interface Props {
  scope: ChatScope;
  scrollClassName?: string;
}

export default function RoomChat({ scope, scrollClassName }: Props) {
  const allMessages = useRoomStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.scope === scope || m.scope === 'room'),
    [allMessages, scope],
  );
  const spectators = useRoomStore((s) => s.room?.spectators ?? EMPTY_SPECTATORS);
  const nickname = useNicknameStore((s) => s.nickname);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim() || !nickname) return;
    getSocket().emit('chat:send', { message: input.trim(), scope });
    setInput('');
  };

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
      <div ref={scrollRef} className={cn('flex-1 space-y-1 overflow-y-auto p-4 min-h-[120px] max-h-[250px]', scrollClassName)}>
        {messages.map((m) => (
          <ChatBubble key={m.id} m={m} spectators={spectators} />
        ))}
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">메시지가 없습니다</p>
        )}
      </div>
      <div className="flex gap-2 border-t border-gray-100 p-3">
        <input
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="메시지 입력..."
          maxLength={200}
        />
        <Button size="sm" onClick={send}>전송</Button>
      </div>
    </div>
  );
}

function ChatBubble({
  m,
  spectators,
}: {
  m: ChatMessage;
  spectators: { id: string }[];
}) {
  if (m.isSystem) {
    return (
      <div className="text-sm">
        <span className="text-xs text-gray-400">[시스템] {m.message}</span>
      </div>
    );
  }
  return (
    <div className="text-sm">
      <span className="font-medium text-indigo-600">{m.senderNickname}</span>
      {spectators.some((s) => s.id === m.sender) && (
        <span className="ml-1 text-xs text-gray-400">👁️</span>
      )}
      <span className="text-gray-600">: {m.message}</span>
    </div>
  );
}
