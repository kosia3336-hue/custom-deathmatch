'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { getSkinMeta } from '@/lib/skins/registry';
import { useNicknameStore } from '@/stores/nickname';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ChatButton from '@/components/room/ChatButton';
import { BgmButton } from '@/components/cdm/BgmButton';
import { ReportModal } from '@/components/cdm/ReportModal';
import { GameRulesModal } from '@/components/game/GameRulesModal';
import { formatTime, cn } from '@/lib/utils';
import { GAME_IDS } from '@/shared/types/game';
import type { GameUndoProposal } from '@/shared/types/events';

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="text-sm tabular-nums text-cdm-fg-muted">{formatTime(elapsed)}</span>;
}

function CountdownTimer() {
  const { remaining, timeLimitSeconds } = useTurnTimer();
  if (remaining === null || timeLimitSeconds === null) return null;

  const min = Math.floor(remaining / 60);
  const sec = Math.floor(remaining % 60);
  const display =
    remaining <= 10 && remaining > 0
      ? remaining.toFixed(1)
      : `${min}:${sec.toString().padStart(2, '0')}`;

  const isCritical = remaining <= 5;
  const isDanger = remaining <= 10 && remaining > 5;
  const isWarning = remaining <= 30 && remaining > 10;

  return (
    <span
      className={cn(
        'font-mono font-bold tabular-nums text-sm',
        isWarning && 'text-amber-500',
        isDanger && 'text-red-500 animate-pulse',
        isCritical && 'text-red-600 animate-[pulse_0.5s_ease-in-out_infinite]',
        !isWarning && !isDanger && !isCritical && 'text-cdm-fg-muted',
      )}
    >
      {display}
    </span>
  );
}

interface Props {
  children: React.ReactNode;
}

export default function GameShell({ children }: Props) {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const gameState = useRoomStore((s) => s.gameState);
  const nickname = useNicknameStore((s) => s.nickname);
  const reconnectingPlayers = useRoomStore((s) => s.reconnectingPlayers);
  const { setHeaderRight, setFooter } = useRoomLayout();
  const [showLeave, setShowLeave] = useState(false);
  const [leaveMode, setLeaveMode] = useState<'leave' | 'resign'>('leave');
  const [showPlayers, setShowPlayers] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(null);
  const [undoProposal, setUndoProposal] = useState<GameUndoProposal | null>(null);
  const [undoWaiting, setUndoWaiting] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const isRankedRoom = room?.isRanked === true;
  const gameStateSigRef = useRef<string | null>(null);
  const [reconnectTimers, setReconnectTimers] = useState<Record<string, number>>({});

  const startedAt = gameState?.startedAt;
  /* 전체 화면 배경 이미지가 있는 스킨 — skin-bg-<theme> 클래스로 셸 배경 적용 */
  const skinMeta = getSkinMeta(gameState?.activeSkin);
  const skinTheme = skinMeta && ['candy', 'meow'].includes(skinMeta.theme) ? skinMeta.theme : null;

  const handleLeave = () => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/');
  };

  const handleResign = () => {
    getSocket().emit('game:resign');
    setShowLeave(false);
    // 서버가 game:ended를 방송하면 PlayPage가 결과화면으로 자동 이동
  };

  /* ── 브라우저 뒤로가기 가로채기 ── */
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setLeaveMode('leave');
      setShowLeave(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /* ── 헤더 오른쪽 슬롯: 타이머 + 채팅 + 나가기 ── */
  useEffect(() => {
    setHeaderRight(
      <>
        {isRankedRoom && (
          <span className="rounded-cdm-md bg-cdm-highlight/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cdm-highlight">
            랭크
          </span>
        )}
        <CountdownTimer />
        {startedAt !== undefined && <ElapsedTimer startedAt={startedAt} />}
        <BgmButton />
        <Button size="sm" variant="ghost" onClick={() => setShowRules(true)}>
          룰
        </Button>
        <ChatButton scope="room" scrollClassName="min-h-[240px] max-h-[340px] md:min-h-[420px] md:max-h-[520px]" />
        <Button size="sm" variant="ghost" onClick={() => { setLeaveMode('leave'); setShowLeave(true); }}>
          나가기
        </Button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, startedAt, isRankedRoom]);

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

  // 재연결 대기 카운트다운 (플레이어별 독립 타이머)
  useEffect(() => {
    if (reconnectingPlayers.length === 0) {
      setReconnectTimers({});
      return;
    }
    // 새로 추가된 플레이어는 초기값 설정
    setReconnectTimers((prev) => {
      const next = { ...prev };
      reconnectingPlayers.forEach((p) => {
        if (!(p.playerId in next)) next[p.playerId] = p.secondsLeft;
      });
      // 이미 재연결된 플레이어 제거
      Object.keys(next).forEach((id) => {
        if (!reconnectingPlayers.some((p) => p.playerId === id)) delete next[id];
      });
      return next;
    });
  }, [reconnectingPlayers]);

  useEffect(() => {
    if (Object.keys(reconnectTimers).length === 0) return;
    const id = setInterval(() => {
      setReconnectTimers((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((pid) => {
          next[pid] = Math.max(0, (next[pid] ?? 1) - 1);
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [reconnectTimers]);

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
    const isEventRoom =
      room?.gameId === GAME_IDS.INDIAN_POKER_EVENT ||
      room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT;
    const showUndo = !isSpectator && !!room && !isRankedRoom && !isEventRoom;

    setFooter(
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 md:gap-3">
        <span className="text-sm font-medium text-cdm-fg sm:mr-auto">{nickname}</span>
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
          {room?.playMode === 'multi' && !isSpectator && !isEventRoom && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              className={cn('min-h-11 min-w-18 sm:min-h-8')}
              onClick={() => { setLeaveMode('resign'); setShowLeave(true); }}
            >
              항복
            </Button>
          )}
          {room && (
            <button
              type="button"
              onClick={() => setShowPlayers(true)}
              className="min-h-11 px-1 text-xs text-cdm-fg-muted transition-colors hover:text-cdm-fg sm:min-h-0"
            >
              {room.spectators.length}명 관전 중
            </button>
          )}
        </div>
      </div>,
    );
    return () => setFooter(null);
  }, [setFooter, nickname, room, isSpectator, undoWaiting, isRankedRoom]);

  return (
    <>
      <div
        className={`relative flex-1 overflow-hidden ${
          skinTheme ? `skin-bg-${skinTheme}` : ''
        }`}
      >
        {children}
        {/* 재연결 대기 오버레이 */}
        {reconnectingPlayers.length > 0 && (
          <div className="absolute inset-0 z-(--cdm-z-overlay) flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-cdm-xl bg-cdm-bg p-6 text-center shadow-(--cdm-shadow-lg)">
              {reconnectingPlayers.length === 1 ? (
                <>
                  <h3 className="mb-1 text-lg font-bold text-cdm-fg">
                    {reconnectingPlayers[0].nickname} 님 연결이 끊어졌습니다
                  </h3>
                  <p className="mb-4 text-sm text-cdm-fg-muted">재연결 대기 중...</p>
                  <div className="mb-4 text-3xl font-bold tabular-nums text-cdm-primary">
                    {reconnectTimers[reconnectingPlayers[0].playerId] ?? reconnectingPlayers[0].secondsLeft}초
                  </div>
                  <p className="text-xs text-cdm-fg-subtle">
                    시간이 초과되면 상대방이 기권 처리됩니다.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mb-3 text-lg font-bold text-cdm-fg">
                    두 플레이어 모두 연결이 끊어졌습니다
                  </h3>
                  <p className="mb-4 text-sm text-cdm-fg-muted">재연결 대기 중...</p>
                  <div className="mb-4 space-y-2">
                    {reconnectingPlayers.map((p) => (
                      <div key={p.playerId} className="flex items-center justify-between rounded-cdm-md bg-cdm-bg-elev-1 px-4 py-2">
                        <span className="text-sm font-medium text-cdm-fg">{p.nickname}</span>
                        <span className="text-lg font-bold tabular-nums text-cdm-primary">
                          {reconnectTimers[p.playerId] ?? p.secondsLeft}초
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-cdm-fg-subtle">
                    30초 초과 시 해당 플레이어 기권 처리됩니다.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <GameRulesModal
        gameId={room?.gameId ?? null}
        open={showRules}
        onClose={() => setShowRules(false)}
      />

      <Modal open={showPlayers} onClose={() => setShowPlayers(false)} title="참여자 목록" className="w-full max-w-xs">
        <ul className="space-y-2">
          {room?.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-cdm-fg">
              <span className="h-2 w-2 rounded-full bg-cdm-primary shrink-0" />
              <span className="flex-1">{p.nickname}</span>
              {p.memberId && p.nickname !== nickname && (
                <button
                  type="button"
                  onClick={() => {
                    setReportTarget({ memberId: p.memberId!, nickname: p.nickname });
                    setShowPlayers(false);
                  }}
                  className="text-xs text-cdm-fg-subtle hover:text-cdm-danger"
                >
                  신고
                </button>
              )}
            </li>
          ))}
          {room?.spectators.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-cdm-fg-muted">
              <span className="h-2 w-2 rounded-full bg-cdm-fg-subtle shrink-0" />
              <span className="flex-1">{p.nickname}</span>
              <span className="text-xs">(관전)</span>
              {p.memberId && p.nickname !== nickname && (
                <button
                  type="button"
                  onClick={() => {
                    setReportTarget({ memberId: p.memberId!, nickname: p.nickname });
                    setShowPlayers(false);
                  }}
                  className="text-xs text-cdm-fg-subtle hover:text-cdm-danger"
                >
                  신고
                </button>
              )}
            </li>
          ))}
        </ul>
      </Modal>

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.memberId ?? null}
        targetNickname={reportTarget?.nickname}
        context="ingame"
        contextData={{ roomId: room?.id }}
      />

      <Modal
        open={showLeave}
        onClose={() => setShowLeave(false)}
        title={leaveMode === 'resign' ? '항복 (패배 처리)' : '나가기'}
        closable={false}
      >
        <p className="mb-6 text-sm text-cdm-fg-muted">
          {leaveMode === 'resign'
            ? '항복하면 패배로 처리되고 결과 화면으로 이동합니다.'
            : isRankedRoom && !isSpectator
              ? '나가면 패배로 처리됩니다. 로비로 이동합니다.'
              : '게임 도중 나가면 게임 모듈의 규칙에 따라 처리됩니다.'}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLeave(false)}>계속하기</Button>
          <Button variant="danger" onClick={leaveMode === 'resign' ? handleResign : handleLeave}>
            {leaveMode === 'resign' ? '항복' : '나가기'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!undoProposal} title="무르기 요청" closable={false} className="max-w-sm">
        {undoProposal && (
          <>
            <p className="mb-6 text-sm text-cdm-fg-muted">
              <span className="font-medium text-cdm-fg">{undoProposal.requesterNickname}</span>
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
