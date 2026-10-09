'use client';

import { useState, forwardRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import { Button } from '@/components/cdm/Button';

/**
 * 로비 채팅 입력 바.
 * - 게스트(닉네임 없음)는 입력 불가 — 안내 메시지 + 로그인 버튼
 * - 길이 200자, Enter 전송 (기존 RoomChat 동일)
 */
export const LobbyChatInput = forwardRef<HTMLInputElement>((_props, ref) => {
  const nickname = useNicknameStore((s) => s.nickname);
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const [input, setInput] = useState('');

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || !nickname) return;
    getSocket().emit('chat:send', { message: trimmed, scope: 'lobby' });
    setInput('');
  };

  if (!nickname) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-cdm-border bg-cdm-bg-elev-1 px-4 py-3 text-xs text-cdm-fg-muted">
        <span>로그인 후 채팅에 참여할 수 있습니다.</span>
        <Button size="sm" variant="primary" onClick={() => requireNickname(() => undefined)}>
          로그인
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 gap-2 border-t border-cdm-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* iOS 는 16px 미만 입력칸에 포커스하면 화면을 확대한다 — 좁은 화면은 16px(text-base) */}
      <input
        ref={ref}
        className="min-w-0 flex-1 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-base md:text-sm outline-none focus:border-cdm-primary placeholder:text-cdm-fg-subtle"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="메시지 입력..."
        maxLength={200}
      />
      <Button size="sm" onClick={send} disabled={!input.trim()} className="shrink-0">
        전송
      </Button>
    </div>
  );
});

LobbyChatInput.displayName = 'LobbyChatInput';
