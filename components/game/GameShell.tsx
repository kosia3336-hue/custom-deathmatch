'use client';

import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useState } from 'react';
import { formatTime } from '@/lib/utils';

interface Props {
  roomId: string;
  children: React.ReactNode;
}

export default function GameShell({ roomId, children }: Props) {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const gameState = useRoomStore((s) => s.gameState);
  const nickname = useNicknameStore((s) => s.nickname);
  const [showLeave, setShowLeave] = useState(false);

  const elapsed = gameState ? Date.now() - gameState.startedAt : 0;

  const handleLeave = () => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/');
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* 상단 바 */}
      <div className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-indigo-600">{room?.gameName}</span>
          <span className="text-sm text-gray-500">{room?.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums text-gray-500">{formatTime(elapsed)}</span>
          <Button size="sm" variant="ghost" onClick={() => setShowLeave(true)}>나가기</Button>
        </div>
      </div>

      {/* 게임 영역 */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* 하단 바 */}
      <div className="flex h-10 items-center justify-between border-t border-gray-200 bg-white px-4">
        <span className="text-sm font-medium text-gray-700">{nickname}</span>
        <div className="flex items-center gap-3">
          {room && (
            <span className="text-xs text-gray-500">
              👁️ {room.spectators.length}명 관전 중
            </span>
          )}
        </div>
      </div>

      <Modal open={showLeave} onClose={() => setShowLeave(false)} title="정말 나가시겠습니까?" closable={false}>
        <p className="mb-6 text-sm text-gray-500">게임 도중 나가면 게임 모듈의 규칙에 따라 처리됩니다.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLeave(false)}>계속하기</Button>
          <Button variant="danger" onClick={handleLeave}>나가기</Button>
        </div>
      </Modal>
    </div>
  );
}
