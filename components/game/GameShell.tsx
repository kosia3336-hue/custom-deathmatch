'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { getSkinMeta } from '@/lib/skins/registry';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getGameProgress, getGameStatus } from '@/lib/gameProgress';
import { useEventRoomStore } from '@/stores/eventRoom';
import { useSmsEventRoomStore } from '@/stores/smsEventRoom';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { RoomChatSheet, useRoomChatUnread } from '@/components/room/ChatButton';
import RoomInfoSheet, { InfoRow } from '@/components/room/RoomInfoSheet';
import { SoundSettings } from '@/components/cdm/SoundSettings';
import { TimeExpiryModal } from './TimeExpiryModal';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { Icon, UnreadBadge } from '@/components/cdm';
import { GameHudLeft, ElapsedTime } from '@/components/game/GameTopBar';
import { ReportModal } from '@/components/cdm/ReportModal';
import { GameRulesModal } from '@/components/game/GameRulesModal';
import { cn } from '@/lib/utils';
import { GAME_IDS } from '@/shared/types/game';
import type { GameUndoProposal, GameTimeExpiry } from '@/shared/types/events';

interface Props {
  children: React.ReactNode;
}

export default function GameShell({ children }: Props) {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const timeExpiry = useRoomStore((s) => s.timeExpiry);
  const gameState = useRoomStore((s) => s.gameState);
  const reconnectingPlayers = useRoomStore((s) => s.reconnectingPlayers);
  const { setHeaderLeft, setHeaderRight, setFooter, setFooterHidden, hud } = useRoomLayout();
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const chatUnread = useRoomChatUnread(showChat);
  const [showLeave, setShowLeave] = useState(false);
  const [leaveMode, setLeaveMode] = useState<'leave' | 'resign'>('leave');
  const myId = useMySocketId();
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(null);
  const [undoProposal, setUndoProposal] = useState<GameUndoProposal | null>(null);
  const [undoWaiting, setUndoWaiting] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const isRankedRoom = room?.isRanked === true;
  const gameStateSigRef = useRef<string | null>(null);
  const [reconnectTimers, setReconnectTimers] = useState<Record<string, number>>({});

  /* 전체 화면 배경 이미지가 있는 스킨 — skin-bg-<theme> 클래스로 셸 배경 적용 */
  const skinMeta = getSkinMeta(gameState?.activeSkin);
  const skinTheme = skinMeta
    && skinMeta.gameId === room?.gameId
    && ['candy', 'meow', 'four-card', 'spring-rain', 'ink-wash'].includes(skinMeta.theme)
    ? skinMeta.theme
    : null;

  const handleLeave = () => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/lobby');
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

  const progress = getGameProgress(room?.gameId, gameState);
  const eventState = useEventRoomStore((s) => s.state);
  const smsState = useSmsEventRoomStore((s) => s.state);
  const eventRound = room?.gameId === GAME_IDS.INDIAN_POKER_EVENT ? eventState?.gameData.handNumber
    : room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT ? smsState?.gameData.roundNumber : undefined;
  const round = hud?.round ?? (eventRound != null ? `${eventRound}R` : progress);
  const order = hud?.order ?? getGameStatus(gameState, myId);
  const spectatorCount = room?.gameId === GAME_IDS.INDIAN_POKER_EVENT ? eventState?.spectatorCount ?? 0
    : room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT ? smsState?.spectatorCount ?? 0 : room?.spectators.length ?? 0;

  /* ── 상단 바 왼쪽: 라운드 · 차례 · 남은 시간 ── */
  useEffect(() => {
    setHeaderLeft(
      <GameHudLeft
        round={round}
        spectators={spectatorCount}
        order={order}
        ranked={isRankedRoom}
        onOpenInfo={() => setShowInfo(true)}
      />,
    );
    return () => setHeaderLeft(null);
  }, [setHeaderLeft, round, order, isRankedRoom, spectatorCount]);

  // 상단 우측: 메모 · 채팅(미읽음) · 설정
  const hasMemo = hud?.memo != null;
  useEffect(() => {
    setHeaderRight(
      <>
        {hasMemo && (
          <button
            type="button"
            onClick={() => setShowMemo(true)}
            aria-label="메모"
            title="라운드 기록·메모"
            className="rounded-cdm-md p-2 text-cdm-ink-fg-muted transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Icon name="memo" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowChat(true)}
          aria-label="채팅"
          title="채팅"
          className="relative rounded-cdm-md p-2 text-cdm-ink-fg-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="chat" />
          <UnreadBadge
            count={chatUnread}
            label={`안 읽은 채팅 ${chatUnread}건`}
            className="absolute -top-0.5 -right-0.5"
          />
        </button>
        <button type="button" onClick={() => setShowSettings(true)} aria-label="설정" title="설정" className="rounded-cdm-md p-2 text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white"><Icon name="settings" /></button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, hasMemo, chatUnread]);

  useEffect(() => {
    const s = getSocket();
    const onProposal = (p: GameUndoProposal) => setUndoProposal(p);
    const onTimeExpiry = (value: GameTimeExpiry | null) => {
      if (!value) return;
      setUndoProposal(null);
      setUndoWaiting(false);
    };
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
    s.on('game:time-expiry', onTimeExpiry);
    s.on('game:undo:declined', onDeclined);
    s.on('error', onError);
    return () => {
      s.off('game:undo:proposal', onProposal);
      s.off('game:time-expiry', onTimeExpiry);
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

  const isEventRoom = room?.gameId === GAME_IDS.INDIAN_POKER_EVENT || room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT;
  const showUndo = !isSpectator && !!room && !isRankedRoom && !isEventRoom && room.playMode !== 'tutorial';
  const showResign = room?.playMode === 'multi' && !isSpectator && !isEventRoom;
  useEffect(() => {
    setFooter(null);
    setFooterHidden(true);
    return () => setFooterHidden(false);
  }, [setFooter, setFooterHidden]);

  return (
    <>
      <TimeExpiryModal expiry={timeExpiry?.roomId === room?.id ? timeExpiry : null} myId={myId} onDecision={(decision) => {
        if (!timeExpiry) return;
        const socket = getSocket();
        if (!socket.connected) { toast.error('서버에 다시 연결된 후 선택해 주세요.'); return; }
        socket.emit('game:time-expiry:respond', { requestId: timeExpiry.requestId, decision });
      }} />
      <div
        className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden ${
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

      {/* ── 설정 — 예전 상단 바에 흩어져 있던 것들 ── */}
      <BottomSheet open={showSettings} onClose={() => setShowSettings(false)} title="설정">
        <SoundSettings className="py-3" />
        <ul className="divide-y divide-cdm-border">
          <SettingRow label="게임 규칙" onClick={() => { setShowSettings(false); setShowRules(true); }} />
          {showUndo && <SettingRow label={undoWaiting ? '무르기 응답 대기 중…' : '무르기'} disabled={undoWaiting} onClick={() => {
            if (room?.playMode === 'multi') setUndoWaiting(true);
            getSocket().emit('game:undo:request');
            setShowSettings(false);
          }} />}
          {showResign && <SettingRow label="항복" danger onClick={() => { setShowSettings(false); setLeaveMode('resign'); setShowLeave(true); }} />}
          <SettingRow
            label="나가기"
            danger
            onClick={() => { setShowSettings(false); setLeaveMode('leave'); setShowLeave(true); }}
          />
        </ul>
      </BottomSheet>

      {/* ── 정보 — 판이 도는 동안 안 읽어도 되는 것들. 대기실 'i' 와 같은 시트 ── */}
      <RoomInfoSheet
        open={showInfo}
        onClose={() => setShowInfo(false)}
        room={room}
        myId={myId}
        extraRows={<InfoRow label="진행된 시간" value={<ElapsedTime startedAt={gameState?.startedAt} />} />}
        onReport={(target) => {
          setReportTarget(target);
          setShowInfo(false);
        }}
      />

      {/* ── 메모 — 좁은 화면에서 라운드 기록·상대 추리. 넓은 화면은 GameFrame aside ── */}
      {hud?.memo != null && (
        <BottomSheet open={showMemo} onClose={() => setShowMemo(false)} title="메모">
          {hud.memo}
        </BottomSheet>
      )}

      <RoomChatSheet open={showChat} onClose={() => setShowChat(false)} scope="room" />

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

/**
 * 설정 한 줄. 줄 전체가 버튼이고 오른쪽 끝에 '>' 만 둔다.
 *
 * 예전에는 '보기' '열기' '참가자 보기' 처럼 줄마다 다른 글자가 붙은 버튼이
 * 있었다. 세 줄이 세 가지 말을 하니 무엇이 다른 일인지 읽어야 알 수 있었다.
 * 여는 동작은 전부 같으므로 표시도 하나로 둔다 — 다른 것은 왼쪽 이름뿐이다.
 */
function SettingRow({
  label, hint, badge, danger, disabled, onClick,
}: {
  label: string;
  hint?: string;
  badge?: number;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-cdm-bg-elev-1"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn('truncate text-sm', danger ? 'text-cdm-accent' : 'text-cdm-fg')}>
            {label}
          </span>
          {badge != null && <UnreadBadge count={badge} />}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {hint && <span className="text-xs text-cdm-fg-subtle">{hint}</span>}
          <Icon name="chevronRight" size="sm" className="text-cdm-fg-subtle" />
        </span>
      </button>
    </li>
  );
}
