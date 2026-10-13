'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/classic-era/lib/socket';
import { useRoomStore } from '@/classic-era/stores/room';
import { useNicknameStore } from '@/classic-era/stores/nickname';
import { useRoomLayout } from '@/classic-era/contexts/RoomLayoutContext';
import Button from '@/classic-era/components/ui/Button';
import Modal from '@/classic-era/components/ui/Modal';
import ChatButton from '@/classic-era/components/room/ChatButton';
import { formatTime } from '@/classic-era/lib/utils';

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
  const [showPlayers, setShowPlayers] = useState(false);

  const startedAt = gameState?.startedAt;

  const handleLeave = () => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/classic');
  };

  /* ── 브라우저 뒤로가기 가로채기 ── */
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setShowLeave(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /* ── 헤더 오른쪽 슬롯: 타이머 + 채팅 + 나가기 ── */
  useEffect(() => {
    setHeaderRight(
      <>
        {startedAt !== undefined && <ElapsedTimer startedAt={startedAt} />}
        <ChatButton scope="game" scrollClassName="min-h-[240px] max-h-[340px] md:min-h-[420px] md:max-h-[520px]" />
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
          <button
            onClick={() => setShowPlayers(true)}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            👁️ {room.spectators.length}명 관전 중
          </button>
        )}
      </>,
    );
    return () => setFooter(null);
  }, [setFooter, nickname, room]);

  return (
    <>
      <div className="flex-1 overflow-hidden">{children}</div>

      <Modal open={showPlayers} onClose={() => setShowPlayers(false)} title="참여자 목록" className="w-full max-w-xs">
        <ul className="space-y-2">
          {room?.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-gray-800">
              <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
              <span>{p.nickname}</span>
              {p.isHost && <span className="text-xs text-amber-500">👑</span>}
            </li>
          ))}
          {room?.spectators.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-gray-400">
              <span className="h-2 w-2 rounded-full bg-gray-300 shrink-0" />
              <span>{p.nickname}</span>
              <span className="text-xs">(관전)</span>
            </li>
          ))}
        </ul>
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
