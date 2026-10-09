'use client';

import { ReactNode, useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useRoomStore } from '@/stores/room';
import { useDockState } from '@/hooks/useDockState';
import { ROOM_CHAT_DOCK_ID } from '@/components/room/RoomChatDockPanel';
import { RoomLayoutContext, type GameHud } from '@/contexts/RoomLayoutContext';
import { PLAY_MODE_LABEL } from '@/shared/types';
import { RankQueueDesktopChip } from '@/components/rank/RankQueueFloatingIndicator';
import RankedRoomBadge from '@/components/room/RankedRoomBadge';
import { useMySocketId } from '@/hooks/useMySocketId';
import { rankedRoomMatchup } from '@/lib/rankedRoomTitle';

export default function RoomLayout({ children }: { children: ReactNode }) {
  const room = useRoomStore((s) => s.room);
  const myId = useMySocketId();

  const [headerLeft, setHeaderLeftState] = useState<ReactNode>(null);
  const [headerRight, setHeaderRightState] = useState<ReactNode>(null);
  const [headerBelow, setHeaderBelowState] = useState<ReactNode>(null);
  const [headerGuide, setHeaderGuideState] = useState<ReactNode>(null);
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
  const setHeaderGuide = useCallback((content: ReactNode) => setHeaderGuideState(content), []);
  const setFooter = useCallback((content: ReactNode) => setFooterState(content), []);
  const setFooterHidden = useCallback((hidden: boolean) => setFooterHiddenState(hidden), []);
  const setHud = useCallback((v: GameHud | null) => setHudState(v), []);

  // 헤더/푸터를 갱신해도 게임 모듈과 편의 패널에 새 context를 전파하지 않는다.
  // 패널 등록 → 헤더 갱신 → context 변경 → 패널 재등록 순환을 끊는다.
  const context = useMemo(
    () => ({
      setHeaderLeft,
      setHeaderRight,
      setHeaderBelow,
      setHeaderGuide,
      setFooter,
      setFooterHidden,
      setHud,
      hud,
    }),
    [
      setHeaderLeft,
      setHeaderRight,
      setHeaderBelow,
      setHeaderGuide,
      setFooter,
      setFooterHidden,
      setHud,
      hud,
    ],
  );

  return (
    <RoomLayoutContext.Provider value={context}>
      <div className="bg-cdm-page flex min-h-screen flex-col">
        {/* 공통 헤더 */}
        <div className="ink-scope border-cdm-ink-border bg-cdm-ink/95 sticky top-0 z-(--cdm-z-sticky) border-b backdrop-blur">
          <div
            className={`mx-auto flex ${headerWidth} items-center justify-between gap-2 px-4 py-3 md:px-6`}
          >
            <div className="min-w-0 flex-1">
              {/*
                게임 화면은 이 자리를 라운드·차례·타이머로 바꿔 쓴다. 방 제목과
                플레이 모드는 'i' 안으로 들어갔다 — 판이 도는 동안 계속 읽을
                정보가 아니라 한 번 확인하면 되는 것이라서다.
              */}
              {headerLeft ??
                (room ? (
                  <>
                    <h1 className="text-cdm-fg flex min-w-0 items-center gap-1.5 text-base font-bold md:text-lg">
                      {room.isRanked && <RankedRoomBadge />}
                      <span className="min-w-0 truncate">
                        {room.isRanked ? rankedRoomMatchup(room, myId) : room.title}
                      </span>
                    </h1>
                    <p className="text-cdm-fg-muted text-xs md:text-sm">
                      {room.gameName}
                      {' · '}
                      {PLAY_MODE_LABEL[room.playMode]}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="bg-cdm-bg-elev-2 h-5 w-40 animate-pulse rounded" />
                    <div className="bg-cdm-bg-elev-1 h-3.5 w-24 animate-pulse rounded" />
                  </div>
                ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <span className="hidden items-center md:flex">
                <RankQueueDesktopChip />
              </span>
              {headerRight}
            </div>
          </div>

          {/*
            라운드 진행 현황. 상단 바에 붙여 한 덩어리로 읽히게 한다 —
            따로 떼면 무대 높이를 그만큼 먹는다.
          */}
          {(headerGuide || headerBelow) && (
            <div className={`mx-auto ${headerWidth} space-y-1 px-4 pb-2 md:px-6`}>
              {headerGuide}
              {headerBelow}
            </div>
          )}
        </div>

        {/* 페이지 콘텐츠 */}
        <div className="flex flex-1 flex-col">{children}</div>

        {/* 공통 푸터 */}
        {footer && !footerHidden && (
          <div className="border-cdm-border bg-cdm-bg/90 sticky bottom-0 z-(--cdm-z-sticky) border-t px-4 py-3 backdrop-blur md:px-6">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 md:gap-3">
              {footer}
            </div>
          </div>
        )}
      </div>
    </RoomLayoutContext.Provider>
  );
}
