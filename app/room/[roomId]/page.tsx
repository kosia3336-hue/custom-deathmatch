'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import PlayerSlot from '@/components/room/PlayerSlot';
import RoomInfoSheet from '@/components/room/RoomInfoSheet';
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
import { isCheonhaNickname } from '@/shared/cheonha';
import { AI_PLAYER_ID } from '@/shared/types';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { cn } from '@/lib/utils';

/*
  대기실.

  초대·시작(준비) 버튼은 헤더 바로 아래에 둔다 — 들어오자마자 할 일이라 맨 아래 푸터까지
  눈을 내리지 않게. 방장은 플레이어 메뉴(넘기기·관전으로·강퇴)와 관전자 줄(자리로 올리기·강퇴)로
  자리를 관리한다.
*/
export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const inviteToken = searchParams.get('invite');

  const { room, countdown } = useRoom(roomId);
  const myId = useMySocketId();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const { setHeaderRight, setFooterHidden } = useRoomLayout();

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
  const isRanked = room?.isRanked === true;

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
          router.push('/lobby');
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
            if (res.isPrivate && !isCheonhaNickname(useNicknameStore.getState().nickname)) {
              setShowSpectatePassword(true);
            } else {
              joinAsSpectator();
            }
          } else {
            toast.error(res.error ?? '입장에 실패했습니다.');
            router.push('/lobby');
          }
        },
      );
    });
  }, [joined, roomId, inviteToken, requireNickname, router, socket, joinAsSpectator]);

  useEffect(() => {
    const handleStarted = () => router.push(`/room/${roomId}/play`);
    const handleKicked = (data: { reason: string }) => {
      toast.error(data.reason);
      router.push('/lobby');
    };
    const handleDisbanded = (data: { reason: string }) => {
      toast.info(data.reason);
      router.push('/lobby');
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

  const openRoomSettings = useCallback(() => {
    setFooterHidden(true);
    setShowRoomSettings(true);
  }, [setFooterHidden]);

  const closeRoomSettings = useCallback(() => {
    setShowRoomSettings(false);
    setFooterHidden(false);
  }, [setFooterHidden]);

  // 카운트다운 시작 시 설정 모달 닫기
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      closeRoomSettings();
    }
  }, [countdown, closeRoomSettings]);

  const handleLeave = useCallback(() => {
    socket.emit('room:leave');
    useRoomStore.getState().reset();
    router.push('/lobby');
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

  const handleSetTurnOrder = useCallback((mode: 'first' | 'second' | 'random') => {
    socket.emit('room:set:turn-order', { mode });
  }, [socket]);

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

  /* 방장 — 다른 플레이어를 관전석으로, 관전자를 빈 자리로 */
  const handleMoveToSpectator = (targetId: string) => {
    socket.emit('room:move:to:spectate', { targetId }, (res) => {
      if (!res.success) toast.error(res.error ?? '관전석으로 옮기지 못했습니다.');
    });
  };

  const handleMoveToPlayer = (targetId: string) => {
    socket.emit('room:move:to:player', { targetId }, (res) => {
      if (!res.success) toast.error(res.error ?? '자리로 올리지 못했습니다.');
    });
  };

  /* ── 헤더 오른쪽 슬롯: 방 정보 · 설정(방장) · 채팅 · 나가기 ── */
  useEffect(() => {
    setHeaderRight(
      <>
        <button
          onClick={() => setShowRoomInfo(true)}
          className="flex items-center gap-1.5 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-cdm-fg-muted hover:bg-cdm-bg-elev-1 transition-colors md:px-3"
          title="방 정보"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden text-sm font-medium md:inline">방 정보</span>
        </button>
        {isHost && (
          <button
            onClick={openRoomSettings}
            className="flex items-center gap-1.5 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-cdm-fg-muted hover:bg-cdm-bg-elev-1 transition-colors md:px-3"
            title="설정 변경"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden text-sm font-medium md:inline">설정 변경</span>
          </button>
        )}
        <ChatButton scope="room" />
        <Button variant="danger" size="sm" onClick={() => setShowLeave(true)}>
          나가기
        </Button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, isHost, openRoomSettings]);

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-cdm-bg-elev-2 border-t-cdm-primary" />
      </div>
    );
  }

  const emptySlots = Math.max(0, room.maxPlayers - room.players.length);
  const waitingOthers = room.players.filter((p) => !p.isHost && p.id !== AI_PLAYER_ID);
  const startHint =
    room.players.length < 2
      ? '상대를 기다리는 중'
      : waitingOthers.every((p) => p.isReady)
        ? '모두 준비 완료'
        : '준비를 기다리는 중';
  const kickTarget =
    room.players.find((p) => p.id === showKick) ?? room.spectators.find((s) => s.id === showKick);

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:p-6">
        {/* 행동 — 초대 · 시작(방장) / 준비(참가자) */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-cdm-lg border border-dashed border-cdm-border-strong p-3">
          {isSpectator && (
            <span className="rounded-full bg-cdm-bg-elev-2 px-3 py-1.5 text-xs text-cdm-fg-muted">
              관전 중
            </span>
          )}
          <InviteButton roomId={roomId} />
          {!isSpectator &&
            (isHost ? (
              <Button onClick={handleStart} className="min-w-32">
                게임 시작
              </Button>
            ) : (
              <Button
                variant={me?.isReady ? 'secondary' : 'primary'}
                onClick={handleReady}
                className="min-w-32"
              >
                {me?.isReady ? '준비 취소' : '준비 완료'}
              </Button>
            ))}
          {!isSpectator && isHost && (
            <span className="w-full text-center text-xs text-cdm-fg-muted sm:w-auto">{startHint}</span>
          )}
        </div>

        {/* 플레이어 슬롯 */}
        <div className={cn('grid gap-3', room.maxPlayers === 2 && 'sm:grid-cols-2')}>
          {room.players.map((p) => (
            <PlayerSlot
              key={p.id}
              player={p}
              isMe={p.id === myId}
              isHostView={isHost}
              onKick={(id) => setShowKick(id)}
              onDelegate={handleDelegate}
              onMoveToSpectator={isRanked ? undefined : handleMoveToSpectator}
              isGameStarted={room.status !== 'waiting'}
              onReport={(memberId, nickname) => setReportTarget({ memberId, nickname })}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) =>
            isSpectator ? (
              <button
                key={`empty-${i}`}
                onClick={handleToPlayer}
                className="flex h-24 w-full items-center justify-center rounded-cdm-lg border-2 border-dashed border-cdm-primary text-sm text-cdm-primary transition-colors hover:border-cdm-primary-strong hover:bg-cdm-primary-soft"
              >
                + 플레이어로 참여
              </button>
            ) : (
              <PlayerSlot key={`empty-${i}`} isMe={false} isHostView={false} />
            ),
          )}
        </div>

        {/* 선후공 — 2인 대기 중. 방장은 고르고, 나머지는 현재 설정(랜덤 포함)을 본다 */}
        {room.players.length === 2 && room.status === 'waiting' && (() => {
          const mode = room.turnOrderMode;
          if (!isHost) {
            const label =
              mode === 'random'
                ? '랜덤 (게임 시작 시 추첨)'
                : room.players[0].id === myId
                  ? '내가 선공'
                  : '내가 후공';
            return (
              <div className="flex items-center gap-2 px-1 pt-3">
                <span className="shrink-0 text-xs text-cdm-fg-muted">선후공</span>
                <span
                  className={cn(
                    'rounded-cdm-md border px-2.5 py-1 text-xs font-medium',
                    mode === 'random'
                      ? 'border-cdm-primary/40 bg-cdm-primary-soft text-cdm-primary'
                      : 'border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg',
                  )}
                >
                  {label}
                </span>
              </div>
            );
          }
          const hostIsFirst = room.players[0].id === myId;
          const activeMode = mode === 'random' ? 'random' : hostIsFirst ? 'first' : 'second';
          return (
            <div className="flex items-center gap-2 px-1 pt-3">
              <span className="shrink-0 text-xs text-cdm-fg-muted">선후공</span>
              <div className="flex flex-1 overflow-hidden rounded-cdm-md border border-cdm-border">
                {(['first', 'random', 'second'] as const).map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleSetTurnOrder(btn)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-medium transition-colors',
                      activeMode === btn
                        ? 'bg-cdm-primary text-white'
                        : 'bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-2',
                    )}
                  >
                    {btn === 'first' ? '내가 선공' : btn === 'random' ? '랜덤' : '내가 후공'}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 관전자 영역 — 방장은 자리로 올리기 · 강퇴 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-cdm-border" />
            <span className="text-xs font-medium text-cdm-fg-muted">
              관전{room.spectators.length > 0 ? ` ${room.spectators.length}명` : ''}
            </span>
            <div className="h-px flex-1 bg-cdm-border" />
          </div>

          <div className="space-y-2">
            {room.spectators.map((s) => {
              const manageable = isHost && s.id !== myId;
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-cdm-lg border px-4 py-2.5',
                    s.id === myId
                      ? 'border-cdm-primary bg-cdm-primary-soft/40'
                      : 'border-cdm-border bg-cdm-bg-elev-1',
                  )}
                >
                  <span className="rounded-full bg-cdm-bg-elev-2 px-2 py-0.5 text-xs text-cdm-fg-muted">관전</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-cdm-fg">{s.nickname}</span>
                  {s.id === myId && (
                    <span className="text-xs font-medium text-cdm-fg-muted">(나)</span>
                  )}
                  {manageable && !isRanked && emptySlots > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => handleMoveToPlayer(s.id)}>
                      자리로 올리기
                    </Button>
                  )}
                  {manageable && (
                    <button
                      type="button"
                      onClick={() => setShowKick(s.id)}
                      className="rounded-cdm-md px-2 py-1 text-xs font-medium text-cdm-danger hover:bg-cdm-bg-elev-2"
                    >
                      강퇴
                    </button>
                  )}
                </div>
              );
            })}

            {!isSpectator && !isHost && (
              <button
                onClick={handleToSpectate}
                className="flex h-14 w-full items-center justify-center rounded-cdm-lg border-2 border-dashed border-cdm-border text-sm text-cdm-fg-muted transition-colors hover:border-cdm-border-strong hover:bg-cdm-bg-elev-1"
              >
                관전하기
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
      <Modal open={showSpectatePassword} onClose={() => router.push('/lobby')} closable={false} title="비밀방 관전">
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
          <Button variant="secondary" onClick={() => router.push('/lobby')}>취소</Button>
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

      {/* 방 정보 — 인게임 'i' 와 같은 시트 */}
      <RoomInfoSheet
        open={showRoomInfo}
        onClose={() => setShowRoomInfo(false)}
        room={room}
        myId={myId}
        onReport={(target) => {
          setReportTarget(target);
          setShowRoomInfo(false);
        }}
        footer={
          isHost ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => { setShowRoomInfo(false); openRoomSettings(); }}
            >
              설정 변경
            </Button>
          ) : undefined
        }
      />

      {/* 방 설정 변경 모달 (방장 전용) */}
      {isHost && (
        <RoomSettingsModal
          open={showRoomSettings}
          room={room}
          onClose={closeRoomSettings}
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

      {/* 강퇴 모달 — 플레이어·관전자 공통 */}
      <Modal open={!!showKick} onClose={() => setShowKick(null)} closable={false}>
        <p className="mb-2 text-sm text-cdm-fg-muted">{kickTarget?.nickname}님을 강퇴할까요?</p>
        <p className="mb-6 text-xs text-cdm-fg-subtle">강퇴된 유저는 이 방에 다시 들어오거나 관전할 수 없습니다.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowKick(null)}>취소</Button>
          <Button variant="danger" onClick={() => showKick && handleKick(showKick)}>강퇴하기</Button>
        </div>
      </Modal>
    </>
  );
}
