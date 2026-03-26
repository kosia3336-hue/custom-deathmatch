'use client';

import { useState, useRef, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import type { ChatScope } from '@/shared/types';

interface Props {
  scope: ChatScope;
  scrollClassName?: string;
}

export default function RoomChat({ scope, scrollClassName }: Props) {
  const messages = useRoomStore((s) => s.messages).filter((m) => m.scope === scope || m.scope === 'room');
  const spectators = useRoomStore((s) => s.room?.spectators ?? []);
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
      <div className="border-b border-gray-100 px-4 py-2">
        <span className="text-sm font-medium text-gray-700">채팅</span>
      </div>
      <div ref={scrollRef} className={cn('flex-1 overflow-y-auto p-4 space-y-1 min-h-[120px] max-h-[250px]', scrollClassName)}>
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            {m.isSystem ? (
              <span className="text-xs text-gray-400">[시스템] {m.message}</span>
            ) : (
              <>
                <span className="font-medium text-indigo-600">{m.senderNickname}</span>
                {spectators.some((s) => s.id === m.sender) && (
                  <span className="ml-1 text-xs text-gray-400">👁️</span>
                )}
                <span className="text-gray-600">: {m.message}</span>
              </>
            )}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-6">메시지가 없습니다</p>
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
