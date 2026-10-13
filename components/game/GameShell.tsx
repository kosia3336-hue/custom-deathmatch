'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGameAudio } from '@/hooks/useGameAudio';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { getSkinTheme } from '@/lib/skins/registry';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getGameProgress, getGameStatus } from '@/lib/gameProgress';
import { useEventRoomStore } from '@/stores/eventRoom';
import { useSmsEventRoomStore } from '@/stores/smsEventRoom';
import { useGuildWarStore } from '@/stores/guildWar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useRoomChatUnread } from '@/hooks/useRoomChatUnread';
import RoomInfoSheet, { InfoRow } from '@/components/room/RoomInfoSheet';
import { SoundSettings } from '@/components/cdm/SoundSettings';
import ChatNotificationSettings from '@/components/room/ChatNotificationSettings';
import { TimeExpiryModal } from './TimeExpiryModal';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { Icon, UnreadBadge } from '@/components/cdm';
import { GameHudLeft, ElapsedTime } from '@/components/game/GameTopBar';
import { GameRulesModal } from '@/components/game/GameRulesModal';
import GameRulesButton from './GameRulesButton';
import { cn } from '@/lib/utils';
import { ANONYMOUS_NICKNAME } from '@/lib/anonymousOpponents';
import { GAME_IDS } from '@/shared/types/game';
import { useGameDesktop, useGameToolsController, type GameTool } from '@/contexts/GameToolsContext';
import { ProgressRing } from '@/components/cdm/ProgressRing';
import GameToolsWorkspace from './GameToolsWorkspace';
import GameHistoryAction from './GameHistoryAction';
import { gamePanelSkinClass } from './GamePanelSkin';
import {
  useGameChatChannel,
  GameRoomChatBody,
  GameRoomChatActions,
  GameChatSheet,
} from './GameRoomChat';

/*
  상단 바 단추 — 그림 아래에 이름을 적는다.

  그림만 두었더니 무엇인지 눌러 봐야 알 수 있었다. 글자는 최소 11px 로 두고 줄간격을
  죽여, 단추가 커져 상단 바가 밀리지 않게 한다.
*/
const HEADER_BTN =
  'flex flex-col items-center gap-0.5 rounded-cdm-md px-1.5 py-1 text-cdm-ink-fg-muted transition-colors hover:bg-white/10 hover:text-white';
const HEADER_BTN_LABEL = 'text-[11px] leading-none font-medium';
import { useGameUndo } from '@/hooks/useGameUndo';
import { useReconnectCountdowns } from '@/hooks/useReconnectCountdowns';

interface Props {
  children: React.ReactNode;
}

export default function GameShell({ children }: Props) {
  useGameAudio();
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const isBanPick = room?.gameId === GAME_IDS.BAN_PICK;
  const isRankedBanPick = isBanPick && room?.isRanked === true;
  const timeExpiry = useRoomStore((s) => s.timeExpiry);
  const gameState = useRoomStore((s) => s.gameState);
  const skinTheme = getSkinTheme(gameState?.activeSkin, room?.gameId ?? '');
  const reconnectingPlayers = useRoomStore((s) => s.reconnectingPlayers);
  const { setHeaderLeft, setHeaderRight, setFooter, setFooterHidden, hud } = useRoomLayout();
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const channels = useGameChatChannel();
  const messagesLen = useRoomStore((s) => s.messages.length);
  /*
    일반 밴픽·카운터매치는 넓은 화면에서 채팅을 오른쪽 사이드바에 직접 그린다.
    랭크 밴픽은 상단 방 채팅 버튼으로 공통 시트를 연다.
    (BanPickChatPanel). 여기서 창으로도 띄우면 채팅과 사이드바가 세로줄을 하나씩 차지한다.
  */
  const desktopScreen = useGameDesktop();
  const chatInBanPickSidebar = isBanPick && desktopScreen && !isRankedBanPick;
  const extraTools = useMemo<GameTool[]>(
    () => [
      ...(chatInBanPickSidebar || isRankedBanPick
        ? []
        : [
            {
              id: 'chat',
              title: '방 채팅',
              defaultOrder: -10,
              content: <GameRoomChatBody channels={channels} />,
              headerTitle: channels.channel === 'room' ? '방 채팅' : '길드 채팅',
              headerActions: <GameRoomChatActions channels={channels} skin={skinTheme} />,
              minBodyHeight: 220,
              preferredBodyHeight: 330,
              resizable: true,
            },
          ]),
      ...(hud?.memo
        ? [{ id: 'reference', title: '편의기능', content: hud.memo, preferredBodyHeight: 300 }]
        : []),
    ],
    [hud?.memo, channels, skinTheme, chatInBanPickSidebar, isRankedBanPick],
  );
  const tools = useGameToolsController(room?.gameId ?? 'game', extraTools);
  const desktopChatVisible = tools.desktop && !isRankedBanPick;
  const chatUnread = useRoomChatUnread(showChat || desktopChatVisible);
  useEffect(() => {
    if (desktopChatVisible) useRoomStore.getState().clearChatUnread();
  }, [desktopChatVisible, messagesLen]);
  const [showLeave, setShowLeave] = useState(false);
  const [leaveMode, setLeaveMode] = useState<'leave' | 'resign'>('leave');
  const myId = useMySocketId();
  const [showRules, setShowRules] = useState(false);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const isRankedRoom = room?.isRanked === true;
  /* 상단 바(무르기)와 설정 시트가 함께 쓰므로 헤더를 그리기 전에 정해 둔다. */
  const isEventRoom =
    room?.gameId === GAME_IDS.INDIAN_POKER_EVENT ||
    room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT ||
    room?.gameId === GAME_IDS.RING_THE_BELL;
  const showRulesShortcut = !!room && !isEventRoom && !isRankedRoom && !isBanPick;
  const showUndo =
    !isSpectator &&
    !!room &&
    !isRankedRoom &&
    !isEventRoom &&
    !isBanPick &&
    room.playMode !== 'tutorial';
  const showResign = room?.playMode === 'multi' && !isSpectator && !isEventRoom;
  const gameStateSig = gameState
    ? `${gameState.turnNumber}-${gameState.turnStartedAt ?? ''}-${gameState.message}`
    : null;
  const { undoProposal, setUndoProposal, undoWaiting, requestUndo } = useGameUndo(
    room?.id,
    room?.playMode,
    gameStateSig,
  );
  const reconnectTimers = useReconnectCountdowns(reconnectingPlayers);

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
  const warState = useGuildWarStore((s) => s.state);
  const isGuildWar = room?.gameId === GAME_IDS.RING_THE_BELL;
  const eventRound =
    room?.gameId === GAME_IDS.INDIAN_POKER_EVENT
      ? eventState?.gameData.handNumber
      : room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT
        ? smsState?.gameData.roundNumber
        : isGuildWar
          ? warState?.state.setIndex
          : undefined;
  const round =
    hud?.round ??
    (eventRound != null ? (isGuildWar ? `세트 ${eventRound}` : `${eventRound}R`) : progress);
  const order = isGuildWar ? hud?.order : (hud?.order ?? getGameStatus(gameState, myId));
  /* ── 상단 바 왼쪽: 라운드 · 차례 · 남은 시간 ── */
  useEffect(() => {
    setHeaderLeft(
      <GameHudLeft
        round={
          isRankedBanPick ? (
            <>
              <span className="lg:hidden">{round}</span>
              <span className="hidden lg:inline" data-ranked-banpick-title>
                랭크 게임 · {room.players.map((player) => player.nickname).join(' vs ')}
              </span>
            </>
          ) : (
            round
          )
        }
        order={order}
        onOpenInfo={() => setShowInfo(true)}
      />,
    );
    return () => setHeaderLeft(null);
  }, [setHeaderLeft, round, order, isRankedBanPick, room?.players]);

  // 상단 우측: 메모 · 방 채팅 · 게임 룰 · 무르기 · 설정
  const hasMemo = hud?.memo != null;
  useEffect(() => {
    setHeaderRight(
      <>
        {hud?.headerAction}
        <GameHistoryAction tools={tools.tools} desktop={tools.desktop} skin={skinTheme} />
        {hasMemo && (
          <button
            type="button"
            onClick={() => setShowMemo(true)}
            aria-label="메모"
            title="라운드 기록·메모"
            className={cn(HEADER_BTN, 'lg:hidden')}
          >
            <Icon name="memo" />
            <span className={HEADER_BTN_LABEL}>메모</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowChat(true)}
          aria-label="방 채팅"
          title="방 채팅"
          className={cn(
            HEADER_BTN,
            'relative',
            isRankedBanPick ? 'lg:flex-row lg:gap-1.5' : 'lg:hidden',
          )}
        >
          <Icon name="chat" />
          <span className={HEADER_BTN_LABEL}>방 채팅</span>
          <UnreadBadge
            count={chatUnread}
            label={`안 읽은 채팅 ${chatUnread}건`}
            className="absolute -top-0.5 -right-0.5"
          />
        </button>
        {showRulesShortcut && <GameRulesButton onClick={() => setShowRules(true)} />}
        {showUndo && (
          <button
            type="button"
            onClick={requestUndo}
            disabled={undoWaiting}
            aria-label="무르기"
            title={undoWaiting ? '무르기 응답 대기 중…' : '무르기'}
            className={cn(HEADER_BTN, 'disabled:opacity-40')}
          >
            <Icon name="undo" />
            <span className={HEADER_BTN_LABEL}>무르기</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label="설정"
          title="설정"
          className={HEADER_BTN}
        >
          <Icon name="settings" />
          <span className={HEADER_BTN_LABEL}>설정</span>
        </button>
      </>,
    );
    return () => setHeaderRight(null);
  }, [
    setHeaderRight,
    hasMemo,
    chatUnread,
    hud?.headerAction,
    tools.tools,
    tools.desktop,
    skinTheme,
    showRulesShortcut,
    showUndo,
    isRankedBanPick,
    undoWaiting,
    requestUndo,
  ]);

  useEffect(() => {
    setFooter(null);
    setFooterHidden(true);
    return () => setFooterHidden(false);
  }, [setFooter, setFooterHidden]);

  return (
    <>
      <TimeExpiryModal
        expiry={timeExpiry?.roomId === room?.id ? timeExpiry : null}
        myId={myId}
        onDecision={(decision) => {
          if (!timeExpiry) return;
          const socket = getSocket();
          if (!socket.connected) {
            toast.error('서버에 다시 연결된 후 선택해 주세요.');
            return;
          }
          socket.emit('game:time-expiry:respond', { requestId: timeExpiry.requestId, decision });
        }}
      />
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <GameToolsWorkspace controller={tools} skin={skinTheme}>
          {children}
        </GameToolsWorkspace>
        {/* 재연결 대기 오버레이 */}
        {reconnectingPlayers.length > 0 && (
          <div className="absolute inset-0 z-(--cdm-z-overlay) flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="rounded-cdm-xl bg-cdm-bg mx-4 w-full max-w-sm p-6 text-center shadow-(--cdm-shadow-lg)">
              {reconnectingPlayers.length === 1 ? (
                <>
                  <h3 className="text-cdm-fg mb-1 text-lg font-bold">
                    {/* 익명(???)은 플레이어에게 '상대' 로 — "??? 님" 은 누구인지 알아보기 어렵다 */}
                    {!isSpectator && reconnectingPlayers[0].nickname === ANONYMOUS_NICKNAME
                      ? '상대'
                      : `${reconnectingPlayers[0].nickname} 님`}{' '}
                    연결이 끊어졌습니다
                  </h3>
                  <p className="text-cdm-fg-muted mb-4 text-sm">재연결 대기 중...</p>
                  <div className="mb-4 flex justify-center">
                    <ProgressRing
                      size={80}
                      label="재접속 남은 시간"
                      value={
                        ((reconnectTimers[reconnectingPlayers[0].playerId] ??
                          reconnectingPlayers[0].secondsLeft) /
                          30) *
                        100
                      }
                    >
                      <span className="text-lg font-bold">
                        {reconnectTimers[reconnectingPlayers[0].playerId] ??
                          reconnectingPlayers[0].secondsLeft}
                        초
                      </span>
                    </ProgressRing>
                  </div>
                  <p className="text-cdm-fg-subtle text-xs">
                    시간이 초과되면 상대방이 기권 처리됩니다.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-cdm-fg mb-3 text-lg font-bold">
                    두 플레이어 모두 연결이 끊어졌습니다
                  </h3>
                  <p className="text-cdm-fg-muted mb-4 text-sm">재연결 대기 중...</p>
                  <div className="mb-4 space-y-2">
                    {reconnectingPlayers.map((p) => (
                      <div
                        key={p.playerId}
                        className="rounded-cdm-md bg-cdm-bg-elev-1 flex items-center justify-between px-4 py-2"
                      >
                        <span className="text-cdm-fg text-sm font-medium">{p.nickname}</span>
                        <ProgressRing
                          size={48}
                          label={`${p.nickname} 재접속 남은 시간`}
                          value={((reconnectTimers[p.playerId] ?? p.secondsLeft) / 30) * 100}
                        >
                          <span className="text-[11px] font-bold">
                            {reconnectTimers[p.playerId] ?? p.secondsLeft}초
                          </span>
                        </ProgressRing>
                      </div>
                    ))}
                  </div>
                  <p className="text-cdm-fg-subtle text-xs">
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
      <BottomSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="설정"
        className={gamePanelSkinClass(skinTheme, true)}
      >
        <SoundSettings className="py-3" />
        <ChatNotificationSettings />
        <ul className="divide-cdm-border divide-y">
          {!showRulesShortcut && !isBanPick && (
            <SettingRow
              label="게임 룰"
              onClick={() => {
                setShowSettings(false);
                setShowRules(true);
              }}
            />
          )}
          {/* 무르기는 상단 바로 꺼냈다 — 판 도중에 자주 쓰는데 시트를 열어야 해서 묻혀 있었다 */}
          {showResign && (
            <SettingRow
              label="항복"
              danger
              onClick={() => {
                setShowSettings(false);
                setLeaveMode('resign');
                setShowLeave(true);
              }}
            />
          )}
          <SettingRow
            label="나가기"
            danger
            onClick={() => {
              setShowSettings(false);
              setLeaveMode('leave');
              setShowLeave(true);
            }}
          />
        </ul>
      </BottomSheet>

      {/* ── 정보 — 판이 도는 동안 안 읽어도 되는 것들. 대기실 'i' 와 같은 시트 ── */}
      <RoomInfoSheet
        open={showInfo}
        onClose={() => setShowInfo(false)}
        room={room}
        myId={myId}
        extraRows={
          <InfoRow label="진행된 시간" value={<ElapsedTime startedAt={gameState?.startedAt} />} />
        }
        showParticipants={false}
      />

      {/* ── 메모 — 좁은 화면에서 라운드 기록·상대 추리. 넓은 화면은 GameFrame aside ── */}
      {hud?.memo != null && (
        <BottomSheet
          open={showMemo}
          onClose={() => setShowMemo(false)}
          title="메모"
          className={gamePanelSkinClass(skinTheme, true)}
        >
          {hud.memo}
        </BottomSheet>
      )}

      <GameChatSheet
        open={showChat && (!tools.desktop || isRankedBanPick)}
        onClose={() => setShowChat(false)}
        channels={channels}
        skin={skinTheme}
      />

      <Modal
        open={showLeave}
        onClose={() => setShowLeave(false)}
        title={leaveMode === 'resign' ? '항복 (패배 처리)' : '나가기'}
        closable={false}
      >
        <p className="text-cdm-fg-muted mb-6 text-sm">
          {leaveMode === 'resign'
            ? '항복하면 패배로 처리되고 결과 화면으로 이동합니다.'
            : isRankedRoom && !isSpectator
              ? '나가면 패배로 처리됩니다. 로비로 이동합니다.'
              : '게임 도중 나가면 게임 모듈의 규칙에 따라 처리됩니다.'}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLeave(false)}>
            계속하기
          </Button>
          <Button variant="danger" onClick={leaveMode === 'resign' ? handleResign : handleLeave}>
            {leaveMode === 'resign' ? '항복' : '나가기'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={showUndo && !!undoProposal}
        title="무르기 요청"
        closable={false}
        className="max-w-sm"
      >
        {undoProposal && (
          <>
            <p className="text-cdm-fg-muted mb-6 text-sm">
              <span className="text-cdm-fg font-medium">{undoProposal.requesterNickname}</span>
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
  label,
  hint,
  badge,
  danger,
  disabled,
  onClick,
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
        className="hover:bg-cdm-bg-elev-1 flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn('truncate text-sm', danger ? 'text-cdm-accent' : 'text-cdm-fg')}>
            {label}
          </span>
          {badge != null && <UnreadBadge count={badge} />}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {hint && <span className="text-cdm-fg-subtle text-xs">{hint}</span>}
          <Icon name="chevronRight" size="sm" className="text-cdm-fg-subtle" />
        </span>
      </button>
    </li>
  );
}
