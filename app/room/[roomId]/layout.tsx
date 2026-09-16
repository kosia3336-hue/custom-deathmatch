'use client';

import { ReactNode, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useRoomStore } from '@/stores/room';
import { useDockState } from '@/hooks/useDockState';
import { ROOM_CHAT_DOCK_ID } from '@/components/room/RoomChatDockPanel';
import { RoomLayoutContext, type GameHud } from '@/contexts/RoomLayoutContext';
import { PLAY_MODE_LABEL } from '@/shared/types';
import { RankQueueDesktopChip } from '@/components/rank/RankQueueFloatingIndicator';

export default function RoomLayout({ children }: { children: ReactNode }) {
  const room = useRoomStore((s) => s.room);

  const [headerLeft, setHeaderLeftState] = useState<ReactNode>(null);
  const [headerRight, setHeaderRightState] = useState<ReactNode>(null);
  const [headerBelow, setHeaderBelowState] = useState<ReactNode>(null);
  const [footer, setFooterState] = useState<ReactNode>(null);
  const [footerHidden, setFooterHiddenState] = useState(false);
  const [hud, setHudState] = useState<GameHud | null>(null);

  // 대기실에서 채팅창을 왼쪽·오른쪽에 붙이면 본문이 넓어지므로 상단 바도 같은 폭으로 맞춘다
  const pathname = usePathname();
  const chatDock = useDockState(ROOM_CHAT_DOCK_ID);
  const isWaitingRoom = /^\/room\/[^/]+$/.test(pathname ?? '');
  const isDevPlay = (pathname ?? '').startsWith('/dev/');
  const sideDocked =
    chatDock.mode === 'docked' && (chatDock.edge === 'left' || chatDock.edge === 'right');
  const headerWidth = isDevPlay
    ? 'max-w-6xl'
    : isWaitingRoom && sideDocked
      ? 'max-w-2xl md:max-w-5xl'
      : 'max-w-2xl';

  const setHeaderLeft = useCallback((content: ReactNode) => setHeaderLeftState(content), []);
  const setHeaderRight = useCallback((content: ReactNode) => setHeaderRightState(content), []);
  const setHeaderBelow = useCallback((content: ReactNode) => setHeaderBelowState(content), []);
  const setFooter = useCallback((content: ReactNode) => setFooterState(content), []);
  const setFooterHidden = useCallback((hidden: boolean) => setFooterHiddenState(hidden), []);
  const setHud = useCallback((v: GameHud | null) => setHudState(v), []);

  return (
    <RoomLayoutContext.Provider
      value={{
        setHeaderLeft,
        setHeaderRight,
        setHeaderBelow,
        setFooter,
        setFooterHidden,
        setHud,
        hud,
      }}
    >
      <div className="flex min-h-screen flex-col bg-cdm-page">
        {/* 공통 헤더 */}
        <div className="ink-scope sticky top-0 z-(--cdm-z-sticky) border-b border-cdm-ink-border bg-cdm-ink/95 backdrop-blur">
          <div className={`mx-auto flex ${headerWidth} items-center justify-between gap-2 px-4 py-3 md:px-6`}>
            <div className="min-w-0 flex-1">
              {/*
                게임 화면은 이 자리를 라운드·차례·타이머로 바꿔 쓴다. 방 제목과
                플레이 모드는 'i' 안으로 들어갔다 — 판이 도는 동안 계속 읽을
                정보가 아니라 한 번 확인하면 되는 것이라서다.
              */}
              {headerLeft ??
                (room ? (
                  <>
                    <h1 className="truncate text-base font-bold text-cdm-fg md:text-lg">
                      {room.title}
                    </h1>
                    <p className="text-xs text-cdm-fg-muted md:text-sm">
                      {room.gameName}
                      {' · '}
                      {PLAY_MODE_LABEL[room.playMode]}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-5 w-40 animate-pulse rounded bg-cdm-bg-elev-2" />
                    <div className="h-3.5 w-24 animate-pulse rounded bg-cdm-bg-elev-1" />
                  </div>
                ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <span className="hidden md:flex items-center">
                <RankQueueDesktopChip />
              </span>
              {headerRight}
            </div>
          </div>

          {/*
            라운드 진행 현황. 상단 바에 붙여 한 덩어리로 읽히게 한다 —
            따로 떼면 무대 높이를 그만큼 먹는다.
          */}
          {headerBelow && <div className={`mx-auto ${headerWidth} px-4 pb-2 md:px-6`}>{headerBelow}</div>}
        </div>

        {/* 페이지 콘텐츠 */}
        <div className="flex flex-1 flex-col">{children}</div>

        {/* 공통 푸터 */}
        {footer && !footerHidden && (
          <div className="sticky bottom-0 z-(--cdm-z-sticky) border-t border-cdm-border bg-cdm-bg/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 md:gap-3">
              {footer}
            </div>
          </div>
        )}
      </div>
    </RoomLayoutContext.Provider>
  );
}
