'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';

/** 보고 있는 수 직전까지 깔아 둔 솔로 방을 연다. */
export function ReviewPlayButton({
  gameId,
  gameName,
  actions,
  disabled,
}: {
  gameId: string;
  gameName: string;
  actions: unknown[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function start() {
    if (disabled || pending) return;
    setPending(true);
    getSocket().emit(
      'room:create',
      {
        gameId,
        title: `복기 ${gameName}`.slice(0, 30),
        playMode: 'solo',
        roomType: 'public',
        maxPlayers: 1,
        gameOptions: { review: { actions } },
      },
      (res) => {
        setPending(false);
        if (res.success && res.roomId) {
          router.push(`/room/${res.roomId}/play`);
          return;
        }
        toast.error(res.error ?? '복기 방을 만들지 못했습니다.');
      },
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || pending}
      className="border-cdm-primary bg-cdm-primary-soft text-cdm-primary rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-cdm-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? '여는 중' : '복기하기'}
    </button>
  );
}
