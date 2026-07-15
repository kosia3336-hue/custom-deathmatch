'use client';

import { getSocket, getOrCreateSessionToken } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import Button from '@/components/ui/Button';

export default function GameModulePlaceholder() {
  const gameState = useRoomStore((s) => s.gameState);
  const room = useRoomStore((s) => s.room);
  const isHost = room?.hostId === getOrCreateSessionToken();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <h2 className="text-xl font-bold text-gray-900">게임 모듈 영역</h2>
        <p className="mt-2 text-sm text-gray-500">
          {gameState?.message ?? '게임 모듈이 이 영역에 로드됩니다.'}
        </p>
        {gameState && (
          <p className="mt-1 text-xs text-gray-400">
            턴: {gameState.turnNumber}
          </p>
        )}
      </div>
      {isHost && (
        <Button
          variant="danger"
          onClick={() => getSocket().emit('game:end')}
        >
          게임 종료 (테스트)
        </Button>
      )}
    </div>
  );
}
