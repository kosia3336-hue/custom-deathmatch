'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import RoomChat from '@/components/room/RoomChat';
import { formatTime } from '@/lib/utils';

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="text-sm tabular-nums text-gray-500">{formatTime(elapsed)}</span>;
}

interface Props {
  children: React.ReactNode;
}

export default function GameShell({ children }: Props) {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const gameState = useRoomStore((s) => s.gameState);
  const nickname = useNicknameStore((s) => s.nickname);
  const { setHeaderRight, setFooter } = useRoomLayout();
  const [showLeave, setShowLeave] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const startedAt = gameState?.startedAt;

  const handleLeave = () => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/');
  };

  /* ── 헤더 오른쪽 슬롯: 타이머 + 채팅 + 나가기 ── */
  useEffect(() => {
    setHeaderRight(
      <>
        {startedAt !== undefined && <ElapsedTimer startedAt={startedAt} />}
        <button
          onClick={() => setShowChat(true)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors md:px-3"
          title="채팅"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="hidden text-sm font-medium md:inline">채팅</span>
        </button>
        <Button size="sm" variant="ghost" onClick={() => setShowLeave(true)}>
          나가기
        </Button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, startedAt]);

  /* ── 푸터 슬롯: 닉네임 + 관전자 수 ── */
  useEffect(() => {
    setFooter(
      <>
        <span className="mr-auto text-sm font-medium text-gray-700">{nickname}</span>
        {room && (
          <span className="text-xs text-gray-500">
            👁️ {room.spectators.length}명 관전 중
          </span>
        )}
      </>,
    );
    return () => setFooter(null);
  }, [setFooter, nickname, room]);

  return (
    <>
      <div className="flex-1 overflow-hidden">{children}</div>

      <Modal
        open={showChat}
        onClose={() => setShowChat(false)}
        title="채팅"
        className="w-full max-w-sm md:max-w-lg"
      >
        <RoomChat scope="game" scrollClassName="min-h-[240px] max-h-[340px] md:min-h-[420px] md:max-h-[520px]" />
      </Modal>

      <Modal open={showLeave} onClose={() => setShowLeave(false)} title="정말 나가시겠습니까?" closable={false}>
        <p className="mb-6 text-sm text-gray-500">게임 도중 나가면 게임 모듈의 규칙에 따라 처리됩니다.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLeave(false)}>계속하기</Button>
          <Button variant="danger" onClick={handleLeave}>나가기</Button>
        </div>
      </Modal>
    </>
  );
}
