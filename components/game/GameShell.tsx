'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ChatButton from '@/components/room/ChatButton';
import { formatTime, cn } from '@/lib/utils';
import { GAME_IDS } from '@/shared/types/game';
import type { GameUndoProposal } from '@/shared/types/events';

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
  const [undoProposal, setUndoProposal] = useState<GameUndoProposal | null>(null);
  const [undoWaiting, setUndoWaiting] = useState(false);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameStateSigRef = useRef<string | null>(null);

  const startedAt = gameState?.startedAt;

  const handleLeave = () => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/');
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

  useEffect(() => {
    const s = getSocket();
    const onProposal = (p: GameUndoProposal) => setUndoProposal(p);
    const onDeclined = () => {
      setUndoWaiting(false);
      toast.message('상대가 무르기를 거절했습니다.');
    };
    // 무르기 요청이 서버에서 거부된 경우 (권한 없음, 이미 진행 중 등)
    const onError = (data: { message: string }) => {
      if (undoWaiting) {
        setUndoWaiting(false);
      }
      if (data?.message) toast.error(data.message);
    };
    s.on('game:undo:proposal', onProposal);
    s.on('game:undo:declined', onDeclined);
    s.on('error', onError);
    return () => {
      s.off('game:undo:proposal', onProposal);
      s.off('game:undo:declined', onDeclined);
      s.off('error', onError);
    };
  }, [undoWaiting]);

  const gameStateSig = gameState
    ? `${gameState.turnNumber}-${gameState.turnStartedAt ?? ''}-${gameState.message}`
    : null;

  useEffect(() => {
    if (!undoWaiting) {
      gameStateSigRef.current = gameStateSig;
      return;
    }
    if (gameStateSig && gameStateSig !== gameStateSigRef.current) {
      setUndoWaiting(false);
      gameStateSigRef.current = gameStateSig;
    }
  }, [gameStateSig, undoWaiting]);

  /* ── 푸터 슬롯: 닉네임 + 무르기 + 관전자 수 ── */
  useEffect(() => {
    const showUndo = !isSpectator && !!room;

    setFooter(
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 md:gap-3">
        <span className="text-sm font-medium text-gray-700 sm:mr-auto">{nickname}</span>
        <div className="flex items-center justify-end gap-2 sm:justify-start">
          {showUndo && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={undoWaiting}
              className={cn('min-h-11 min-w-18 sm:min-h-8')}
              onClick={() => {
                const s = getSocket();
                if (room?.playMode === 'multi') {
                  setUndoWaiting(true);
                }
                s.emit('game:undo:request');
              }}
            >
              무르기
            </Button>
          )}
          {room && (
            <button
              type="button"
              onClick={() => setShowPlayers(true)}
              className="min-h-11 px-1 text-xs text-gray-500 transition-colors hover:text-gray-700 sm:min-h-0"
            >
              👁️ {room.spectators.length}명 관전 중
            </button>
          )}
        </div>
      </div>,
    );
    return () => setFooter(null);
  }, [setFooter, nickname, room, isSpectator, undoWaiting]);

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

      <Modal open={!!undoProposal} title="무르기 요청" closable={false} className="max-w-sm">
        {undoProposal && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{undoProposal.requesterNickname}</span>
              님이 무르기를 요청했습니다. 받으시겠습니까?
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => {
                  getSocket().emit('game:undo:decline', { requestId: undoProposal.requestId });
                  setUndoProposal(null);
                }}
              >
                거절
              </Button>
              <Button
                className="min-h-11 w-full sm:w-auto"
                onClick={() => {
                  getSocket().emit('game:undo:accept', { requestId: undoProposal.requestId });
                  setUndoProposal(null);
                }}
              >
                수락
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
