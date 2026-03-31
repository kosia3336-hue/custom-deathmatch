'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import PlayerSlot from '@/components/room/PlayerSlot';
import RoomInfo from '@/components/room/RoomInfo';
import ChatButton from '@/components/room/ChatButton';
import InviteButton from '@/components/room/InviteButton';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useRoom } from '@/hooks/useRoom';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useNicknameStore } from '@/stores/nickname';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { cn } from '@/lib/utils';

export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const inviteToken = searchParams.get('invite');

  const { room, countdown } = useRoom(roomId);
  const myId = useMySocketId();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const { setHeaderRight, setFooter } = useRoomLayout();

  const [joined, setJoined] = useState(false);
  const [showKick, setShowKick] = useState<string | null>(null);
  const [showLeave, setShowLeave] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [spectatePassword, setSpectatePassword] = useState('');
  const [spectatePasswordError, setSpectatePasswordError] = useState('');
  const [showSpectatePassword, setShowSpectatePassword] = useState(false);
  const [spectatePasswordLoading, setSpectatePasswordLoading] = useState(false);
  const socket = getSocket();

  const isHost = !!myId && room?.hostId === myId;
  const isSpectator = !!myId && (room?.spectators.some((s) => s.id === myId) ?? false);
  const me = room?.players.find((p) => p.id === myId);

  const joinAsSpectator = useCallback((password?: string) => {
    socket.emit('spectate:join', { roomId, password }, (sRes) => {
      if (sRes.success) {
        setJoined(true);
        setShowSpectatePassword(false);
      } else {
        setSpectatePasswordLoading(false);
        if (showSpectatePassword) {
          setSpectatePasswordError(sRes.error ?? '비밀번호가 틀렸습니다.');
        } else {
          toast.error(sRes.error ?? '관전 입장에 실패했습니다.');
          router.push('/');
        }
      }
    });
  }, [socket, roomId, router, showSpectatePassword]);

  useEffect(() => {
    if (joined) return;

    requireNickname(() => {
      socket.emit(
        'room:join',
        { roomId, inviteToken: inviteToken ?? undefined },
        (res) => {
          if (res.success) {
            setJoined(true);
          } else if (
            res.error === '이미 게임이 진행 중입니다.' ||
            res.error === '방이 가득 찼습니다.'
          ) {
            if (res.isPrivate) {
              setShowSpectatePassword(true);
            } else {
              joinAsSpectator();
            }
          } else {
            toast.error(res.error ?? '입장에 실패했습니다.');
            router.push('/');
          }
        },
      );
    });
  }, [joined, roomId, inviteToken, requireNickname, router, socket, joinAsSpectator]);

  useEffect(() => {
    const handleStarted = () => router.push(`/room/${roomId}/play`);
    const handleKicked = (data: { reason: string }) => {
      toast.error(data.reason);
      router.push('/');
    };
    const handleDisbanded = (data: { reason: string }) => {
      toast.info(data.reason);
      router.push('/');
    };

    socket.on('room:game:started', handleStarted);
    socket.on('kicked', handleKicked);
    socket.on('room:disbanded', handleDisbanded);
    return () => {
      socket.off('room:game:started', handleStarted);
      socket.off('kicked', handleKicked);
      socket.off('room:disbanded', handleDisbanded);
    };
  }, [roomId, router, socket]);

  useEffect(() => {
    if (room?.status === 'playing') {
      router.push(`/room/${roomId}/play`);
    }
  }, [room?.status, roomId, router]);

  const handleLeave = useCallback(() => {
    socket.emit('room:leave');
    useRoomStore.getState().reset();
    router.push('/');
  }, [socket, router]);

  const handleReady = useCallback(() => {
    const currentMe = useRoomStore.getState().room?.players.find((p) => p.id === myId);
    socket.emit(currentMe?.isReady ? 'room:unready' : 'room:ready');
  }, [socket, myId]);

  const handleStart = useCallback(() => socket.emit('room:start'), [socket]);

  const handleKick = (targetId: string) => {
    socket.emit('room:kick', { targetId });
    setShowKick(null);
  };

  const handleDelegate = (targetId: string) => {
    socket.emit('room:delegate', { targetId });
  };

  const handleSwapColors = () => {
    socket.emit('room:swap:colors');
  };

  const handleToSpectate = () => {
    socket.emit('room:to:spectate', (res) => {
      if (!res.success) toast.error(res.error ?? '전환에 실패했습니다.');
    });
  };

  const handleToPlayer = () => {
    socket.emit('spectate:to:player', (res) => {
      if (!res.success) toast.error(res.error ?? '전환에 실패했습니다.');
    });
  };

  /* ── 헤더 오른쪽 슬롯 ── */
  useEffect(() => {
    setHeaderRight(
      <>
        <button
          onClick={() => setShowRoomInfo(true)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors md:px-3"
          title="방 정보"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden text-sm font-medium md:inline">방 정보</span>
        </button>
        <ChatButton scope="room" scrollClassName="min-h-[240px] max-h-[340px] md:min-h-[420px] md:max-h-[520px]" />
        <Button variant="danger" size="sm" onClick={() => setShowLeave(true)}>
          나가기
        </Button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight]);

  /* ── 푸터 슬롯 ── */
  useEffect(() => {
    setFooter(
      <>
        {isSpectator && (
          <span className="mr-auto rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-500 md:text-sm">
            👁️ 관전 중
          </span>
        )}
        <InviteButton roomId={roomId} />
        {!isSpectator && (
          isHost ? (
            <Button onClick={handleStart}>게임 시작</Button>
          ) : (
            <Button
              variant={me?.isReady ? 'secondary' : 'primary'}
              onClick={handleReady}
            >
              {me?.isReady ? '준비 취소' : '준비 완료'}
            </Button>
          )
        )}
      </>,
    );
    return () => setFooter(null);
  }, [setFooter, isSpectator, isHost, me?.isReady, roomId, handleStart, handleReady]);

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const emptySlots = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:p-6">
        {/* 플레이어 슬롯 */}
        <div className="space-y-3">
          {room.playMode === 'multi' && room.players.length === 2 && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
              <span className="text-xs font-medium text-gray-500">흑/백 순서</span>
              {isHost && (
                <button
                  onClick={handleSwapColors}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  title="흑/백 교체"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  교체
                </button>
              )}
            </div>
          )}
          {room.players.map((p, i) => (
            <PlayerSlot
              key={p.id}
              player={p}
              isMe={p.id === myId}
              isHostView={isHost}
              colorLabel={room.playMode === 'multi' && room.players.length === 2
                ? (i === 0 ? '흑' : '백')
                : undefined}
              onKick={(id) => setShowKick(id)}
              onDelegate={handleDelegate}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            isSpectator ? (
              <button
                key={`empty-${i}`}
                onClick={handleToPlayer}
                className="flex h-16 w-full items-center justify-center rounded-xl border-2 border-dashed border-indigo-300 text-sm text-indigo-400 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
              >
                + 플레이어로 참여
              </button>
            ) : (
              <PlayerSlot key={`empty-${i}`} isMe={false} isHostView={false} />
            )
          ))}
        </div>

        {/* 관전자 영역 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">
              관전{room.spectators.length > 0 ? ` ${room.spectators.length}명` : ''}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-2">
            {room.spectators.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3',
                  s.id === myId
                    ? 'border-indigo-200 bg-indigo-50'
                    : 'border-gray-200 bg-white',
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm select-none">
                  👁️
                </div>
                <span className="flex-1 text-sm text-gray-600">{s.nickname}</span>
                {s.id === myId && (
                  <span className="text-xs font-medium text-indigo-500">나</span>
                )}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">관전</span>
              </div>
            ))}

            {!isSpectator && !isHost && (
              <button
                onClick={handleToSpectate}
                className="flex h-14 w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                👁️ 관전하기
              </button>
            )}

            {room.spectators.length === 0 && (isSpectator || isHost) && (
              <div className="flex h-14 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
                관전자 없음
              </div>
            )}
          </div>
        </div>

        {/* 카운트다운 오버레이 */}
        <AnimatePresence>
          {countdown !== null && countdown > 0 && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                key={countdown}
                className="text-8xl font-black text-white"
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {countdown}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 관전 비밀번호 모달 */}
      <Modal open={showSpectatePassword} onClose={() => router.push('/')} closable={false} title="비밀방 관전">
        <p className="mb-4 text-sm text-gray-500">관전하려면 비밀번호를 입력하세요.</p>
        <Input
          type="password"
          value={spectatePassword}
          onChange={(e) => { setSpectatePassword(e.target.value); setSpectatePasswordError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !spectatePasswordLoading) {
              setSpectatePasswordLoading(true);
              joinAsSpectator(spectatePassword);
            }
          }}
          error={spectatePasswordError}
          placeholder="비밀번호"
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => router.push('/')}>취소</Button>
          <Button
            loading={spectatePasswordLoading}
            onClick={() => {
              setSpectatePasswordLoading(true);
              joinAsSpectator(spectatePassword);
            }}
          >
            관전
          </Button>
        </div>
      </Modal>

      {/* 방 정보 모달 */}
      <Modal open={showRoomInfo} onClose={() => setShowRoomInfo(false)} title="방 정보">
        <RoomInfo room={room} />
      </Modal>


      {/* 나가기 모달 */}
      <Modal open={showLeave} onClose={() => setShowLeave(false)} closable={false}>
        <p className="mb-6 text-sm text-gray-600">정말 방을 나가시겠습니까?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLeave(false)}>취소</Button>
          <Button variant="danger" onClick={handleLeave}>나가기</Button>
        </div>
      </Modal>

      {/* 강퇴 모달 */}
      <Modal open={!!showKick} onClose={() => setShowKick(null)} closable={false}>
        <p className="mb-2 text-sm text-gray-600">
          {room.players.find((p) => p.id === showKick)?.nickname}님을 강퇴할까요?
        </p>
        <p className="mb-6 text-xs text-gray-400">강퇴된 유저는 재입장 불가합니다.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowKick(null)}>취소</Button>
          <Button variant="danger" onClick={() => showKick && handleKick(showKick)}>강퇴하기</Button>
        </div>
      </Modal>
    </>
  );
}
