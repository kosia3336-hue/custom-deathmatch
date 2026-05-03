'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import PlayerSlot from '@/components/room/PlayerSlot';
import RoomInfo from '@/components/room/RoomInfo';
import { ReportModal } from '@/components/cdm/ReportModal';
import RoomSettingsModal from '@/components/room/RoomSettingsModal';
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
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(null);
  const [showLeave, setShowLeave] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [spectatePassword, setSpectatePassword] = useState('');
  const [spectatePasswordError, setSpectatePasswordError] = useState('');
  const [showSpectatePassword, setShowSpectatePassword] = useState(false);
  const [spectatePasswordLoading, setSpectatePasswordLoading] = useState(false);
  const showSpectatePasswordRef = useRef(false);
  const socket = getSocket();

  const isHost = !!myId && room?.hostId === myId;
  const isSpectator = !!myId && (room?.spectators.some((s) => s.id === myId) ?? false);
  const me = room?.players.find((p) => p.id === myId);

  useEffect(() => {
    showSpectatePasswordRef.current = showSpectatePassword;
  }, [showSpectatePassword]);

  const joinAsSpectator = useCallback((password?: string) => {
    socket.emit('spectate:join', { roomId, password }, (sRes) => {
      if (sRes.success) {
        setJoined(true);
        setShowSpectatePassword(false);
        setSpectatePasswordLoading(false);
      } else {
        setSpectatePasswordLoading(false);
        if (showSpectatePasswordRef.current) {
          setSpectatePasswordError(sRes.error ?? '비밀번호가 틀렸습니다.');
        } else {
          toast.error(sRes.error ?? '관전 입장에 실패했습니다.');
          router.push('/');
        }
      }
    });
  }, [socket, roomId, router]);

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
            res.errorCode === 'GAME_IN_PROGRESS' ||
            res.errorCode === 'ROOM_FULL'
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

  // 카운트다운 시작 시 설정 모달 닫기
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      setShowRoomSettings(false);
    }
  }, [countdown]);

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
          className="flex items-center gap-1.5 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-cdm-fg-muted hover:bg-cdm-bg-elev-1 transition-colors md:px-3"
          title="방 정보"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden text-sm font-medium md:inline">방 정보</span>
        </button>
        {isHost && (
          <button
            onClick={() => setShowRoomSettings(true)}
            className="flex items-center gap-1.5 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-cdm-fg-muted hover:bg-cdm-bg-elev-1 transition-colors md:px-3"
            title="설정 변경"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden text-sm font-medium md:inline">설정 변경</span>
          </button>
        )}
        <ChatButton scope="room" scrollClassName="min-h-[240px] max-h-[340px] md:min-h-[420px] md:max-h-[520px]" />
        <Button variant="danger" size="sm" onClick={() => setShowLeave(true)}>
          나가기
        </Button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, isHost]);

  /* ── 푸터 슬롯 ── */
  useEffect(() => {
    setFooter(
      <>
        {isSpectator && (
          <span className="mr-auto rounded-full bg-cdm-bg-elev-2 px-3 py-1.5 text-xs text-cdm-fg-muted md:text-sm">
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
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-cdm-bg-elev-2 border-t-cdm-primary" />
      </div>
    );
  }

  const emptySlots = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:p-6">
        {/* 플레이어 슬롯 */}
        <div className="space-y-3">
          {room.players.map((p) => (
            <PlayerSlot
              key={p.id}
              player={p}
              isMe={p.id === myId}
              isHostView={isHost}
              onKick={(id) => setShowKick(id)}
              onDelegate={handleDelegate}
              onSwapTurns={handleSwapColors}
              isGameStarted={room.status !== 'waiting'}
              onReport={(memberId, nickname) => setReportTarget({ memberId, nickname })}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            isSpectator ? (
              <button
                key={`empty-${i}`}
                onClick={handleToPlayer}
                className="flex h-16 w-full items-center justify-center rounded-cdm-lg border-2 border-dashed border-cdm-primary text-sm text-cdm-primary transition-colors hover:border-cdm-primary-strong hover:bg-cdm-primary-soft"
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
            <div className="h-px flex-1 bg-cdm-border" />
            <span className="text-xs font-medium text-cdm-fg-muted">
              👁️ 관전{room.spectators.length > 0 ? ` ${room.spectators.length}명` : ''}
            </span>
            <div className="h-px flex-1 bg-cdm-border" />
          </div>

          <div className="space-y-2">
            {room.spectators.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-cdm-lg border px-4 py-3',
                  s.id === myId
                    ? 'border-cdm-primary bg-cdm-primary-soft/40'
                    : 'border-cdm-border bg-cdm-bg-elev-1',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cdm-bg-elev-2 text-sm select-none">
                  👁️
                </span>
                <span className="flex-1 text-sm text-cdm-fg">{s.nickname}</span>
                {s.id === myId && (
                  <span className="text-xs font-medium text-cdm-fg-muted">(나)</span>
                )}
                <span className="rounded-full bg-cdm-bg-elev-2 px-2 py-0.5 text-xs text-cdm-fg-muted">관전</span>
              </div>
            ))}

            {!isSpectator && !isHost && (
              <button
                onClick={handleToSpectate}
                className="flex h-14 w-full items-center justify-center rounded-cdm-lg border-2 border-dashed border-cdm-border text-sm text-cdm-fg-muted transition-colors hover:border-cdm-border-strong hover:bg-cdm-bg-elev-1"
              >
                👁️ 관전하기
              </button>
            )}

            {room.spectators.length === 0 && (isSpectator || isHost) && (
              <div className="flex h-14 items-center justify-center rounded-cdm-lg border-2 border-dashed border-cdm-border text-sm text-cdm-fg-subtle">
                관전자 없음
              </div>
            )}
          </div>
        </div>

        {/* 카운트다운 오버레이 */}
        <AnimatePresence>
          {countdown !== null && countdown > 0 && (
            <motion.div
              className="fixed inset-0 z-(--cdm-z-overlay) flex items-center justify-center bg-black/60"
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
        <p className="mb-4 text-sm text-cdm-fg-muted">관전하려면 비밀번호를 입력하세요.</p>
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
        {isHost && (
          <div className="mt-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => { setShowRoomInfo(false); setShowRoomSettings(true); }}
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              설정 변경
            </Button>
          </div>
        )}
      </Modal>

      {/* 방 설정 변경 모달 (방장 전용) */}
      {isHost && (
        <RoomSettingsModal
          open={showRoomSettings}
          room={room}
          onClose={() => setShowRoomSettings(false)}
        />
      )}


      {/* 나가기 모달 */}
      <Modal open={showLeave} onClose={() => setShowLeave(false)} closable={false}>
        <p className="mb-6 text-sm text-cdm-fg-muted">정말 방을 나가시겠습니까?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLeave(false)}>취소</Button>
          <Button variant="danger" onClick={handleLeave}>나가기</Button>
        </div>
      </Modal>

      {/* 신고 모달 */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.memberId ?? null}
        targetNickname={reportTarget?.nickname}
        context="room"
        contextData={{ roomId }}
      />

      {/* 강퇴 모달 */}
      <Modal open={!!showKick} onClose={() => setShowKick(null)} closable={false}>
        <p className="mb-2 text-sm text-cdm-fg-muted">
          {room.players.find((p) => p.id === showKick)?.nickname}님을 강퇴할까요?
        </p>
        <p className="mb-6 text-xs text-cdm-fg-subtle">강퇴된 유저는 재입장 불가합니다.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowKick(null)}>취소</Button>
          <Button variant="danger" onClick={() => showKick && handleKick(showKick)}>강퇴하기</Button>
        </div>
      </Modal>
    </>
  );
}
